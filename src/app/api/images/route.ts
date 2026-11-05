import {
    DEFAULT_GPT_IMAGE_MODEL,
    IMAGE_OUTPUT_FORMATS,
    isGptImageModel,
    type ImageBackground,
    type ImageComplexity,
    type ImageMode,
    type ImageModeration,
    type ImageOutputFormat,
    type ImageQuality,
    type SvgReasoningEffort
} from '@/lib/models';
import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';

// Streaming event types
type StreamingEvent = {
    type: 'partial_image' | 'completed' | 'error' | 'done';
    index?: number;
    partial_image_index?: number;
    b64_json?: string;
    filename?: string;
    path?: string;
    output_format?: string;
    usage?: OpenAI.Images.ImagesResponse['usage'];
    images?: Array<{
        filename: string;
        b64_json: string;
        path?: string;
        output_format: string;
    }>;
    error?: string;
};

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
});

const outputDir = path.resolve(process.cwd(), 'generated-images');

// Validate and normalize output format
function validateOutputFormat(format: unknown): ImageOutputFormat {
    const normalized = String(format || 'png').toLowerCase();

    // Handle jpg -> jpeg normalization
    const mapped = normalized === 'jpg' ? 'jpeg' : normalized;

    if (IMAGE_OUTPUT_FORMATS.includes(mapped as ImageOutputFormat)) {
        return mapped as ImageOutputFormat;
    }

    return 'png'; // default fallback
}

// Request fields shared by the generations and edits endpoints, read once from the multipart body.
// Value validation beyond shape is left to OpenAI, whose 400 messages are surfaced to the client.
function readImageParams(formData: FormData) {
    const n = parseInt((formData.get('n') as string) || '1', 10);
    const output_format = validateOutputFormat(formData.get('output_format'));
    const compression = parseInt(formData.get('output_compression') as string, 10);
    const complexity = formData.get('complexity') as ImageComplexity | null;
    return {
        n: Math.max(1, Math.min(n || 1, 10)),
        size: (formData.get('size') as string) || 'auto',
        quality: (formData.get('quality') as ImageQuality | null) || 'auto',
        output_format,
        background: (formData.get('background') as ImageBackground | null) || 'auto',
        moderation: (formData.get('moderation') as ImageModeration | null) || 'auto',
        ...(complexity ? { complexity } : {}),
        ...((output_format === 'jpeg' || output_format === 'webp') && compression >= 0 && compression <= 100
            ? { output_compression: compression }
            : {}),
        ...(output_format === 'gif'
            ? {
                  frame_count: parseInt(formData.get('frame_count') as string, 10),
                  frame_duration_ms: parseInt(formData.get('frame_duration_ms') as string, 10)
              }
            : {})
    };
}

// `moderation_details` is an optional field of the API error body for blocked requests.
function moderationSuffix(error: unknown): string {
    if (!(error instanceof OpenAI.APIError)) return '';
    const details = (
        error.error as { moderation_details?: { moderation_stage?: string; categories?: string[] } } | undefined
    )?.moderation_details;
    if (!details) return '';
    const categories = details.categories?.length ? `: ${details.categories.join(', ')}` : '';
    return ` (blocked at the ${details.moderation_stage ?? 'unknown'} stage${categories})`;
}

// The SDK's ImageEditParams type omits `moderation`, but the edits endpoint accepts it (documented in the API
// reference; the API rejects unknown parameter names, so the field is parsed rather than ignored).
type EditParams = OpenAI.Images.ImageEditParams & { moderation?: ImageModeration };
type EditParamsStreaming = OpenAI.Images.ImageEditParamsStreaming & { moderation?: ImageModeration };

async function ensureOutputDirExists() {
    try {
        await fs.access(outputDir);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            try {
                await fs.mkdir(outputDir, { recursive: true });
                console.log(`Created output directory: ${outputDir}`);
            } catch (mkdirError) {
                console.error(`Error creating output directory ${outputDir}:`, mkdirError);
                throw new Error('Failed to create image output directory.');
            }
        } else {
            console.error(`Error accessing output directory ${outputDir}:`, error);
            throw new Error(
                `Failed to access or ensure image output directory exists. Original error: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/images');

    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set.');
        return NextResponse.json({ error: 'Server configuration error: API key not found.' }, { status: 500 });
    }
    try {
        let effectiveStorageMode: 'fs' | 'indexeddb';
        const explicitMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
        const isOnVercel = process.env.VERCEL === '1';

        if (explicitMode === 'fs') {
            effectiveStorageMode = 'fs';
        } else if (explicitMode === 'indexeddb') {
            effectiveStorageMode = 'indexeddb';
        } else if (isOnVercel) {
            effectiveStorageMode = 'indexeddb';
        } else {
            effectiveStorageMode = 'fs';
        }
        console.log(
            `Effective Image Storage Mode: ${effectiveStorageMode} (Explicit: ${explicitMode || 'unset'}, Vercel: ${isOnVercel})`
        );

        if (effectiveStorageMode === 'fs') {
            await ensureOutputDirExists();
        }

        const formData = await request.formData();

        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = formData.get('passwordHash') as string | null;
            if (!clientPasswordHash) {
                console.error('Missing password hash.');
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                console.error('Invalid password hash.');
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        const mode = formData.get('mode') as ImageMode | null;
        const prompt = formData.get('prompt') as string | null;
        const model = formData.get('model') || DEFAULT_GPT_IMAGE_MODEL;

        console.log(`Mode: ${mode}, Model: ${model}, Prompt: ${prompt ? prompt.substring(0, 50) + '...' : 'N/A'}`);

        if (!mode || !prompt) {
            return NextResponse.json({ error: 'Missing required parameters: mode and prompt' }, { status: 400 });
        }
        if (!isGptImageModel(model)) {
            return NextResponse.json({ error: `Unsupported model: ${String(model)}` }, { status: 400 });
        }

        const { output_format, ...sharedParams } = readImageParams(formData);

        // Check for streaming mode
        const streamEnabled = formData.get('stream') === 'true';
        const partialImages = Math.max(1, Math.min(parseInt((formData.get('partial_images') as string) || '2', 10), 3));

        let result: OpenAI.Images.ImagesResponse;

        if (mode === 'generate') {
            const svgEffort = formData.get('svg_reasoning_effort') as SvgReasoningEffort | null;
            const baseParams: OpenAI.Images.ImageGenerateParams = {
                model,
                prompt,
                ...sharedParams,
                output_format,
                ...(output_format === 'svg' && {
                    svg: {
                        model: formData.get('svg_model') as string,
                        ...(svgEffort && { reasoning: { effort: svgEffort } })
                    }
                })
            };

            // Handle streaming mode for generation
            if (streamEnabled) {
                const streamParams: OpenAI.Images.ImageGenerateParamsStreaming = {
                    ...baseParams,
                    stream: true,
                    partial_images: partialImages
                };

                const stream = await openai.images.generate(streamParams);

                // Create SSE response
                const encoder = new TextEncoder();
                const timestamp = Date.now();

                const readableStream = new ReadableStream({
                    async start(controller) {
                        try {
                            const completedImages: Array<{
                                filename: string;
                                b64_json: string;
                                path?: string;
                                output_format: string;
                            }> = [];
                            let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;
                            let imageIndex = 0;

                            for await (const event of stream) {
                                if (event.type === 'image_generation.partial_image') {
                                    const partialEvent: StreamingEvent = {
                                        type: 'partial_image',
                                        index: imageIndex,
                                        partial_image_index: event.partial_image_index,
                                        b64_json: event.b64_json
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialEvent)}\n\n`));
                                } else if (event.type === 'image_generation.completed') {
                                    const currentIndex = imageIndex;
                                    const filename = `${timestamp}-${currentIndex}.${output_format}`;

                                    // Save to filesystem if in fs mode
                                    if (effectiveStorageMode === 'fs' && event.b64_json) {
                                        const buffer = Buffer.from(event.b64_json, 'base64');
                                        const filepath = path.join(outputDir, filename);
                                        await fs.writeFile(filepath, buffer);
                                        console.log(`Streaming: Saved image ${filename}`);
                                    }

                                    const imageData = {
                                        filename,
                                        b64_json: event.b64_json || '',
                                        output_format,
                                        ...(effectiveStorageMode === 'fs' ? { path: `/api/image/${filename}` } : {})
                                    };
                                    completedImages.push(imageData);

                                    const completedEvent: StreamingEvent = {
                                        type: 'completed',
                                        index: currentIndex,
                                        filename,
                                        b64_json: event.b64_json,
                                        path: effectiveStorageMode === 'fs' ? `/api/image/${filename}` : undefined,
                                        output_format
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(completedEvent)}\n\n`));

                                    imageIndex++;

                                    finalUsage = event.usage;
                                }
                            }

                            // Send final done event with all images and usage
                            const doneEvent: StreamingEvent = {
                                type: 'done',
                                images: completedImages,
                                usage: finalUsage
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
                            controller.close();
                        } catch (error) {
                            console.error('Streaming error:', error);
                            const errorEvent: StreamingEvent = {
                                type: 'error',
                                error:
                                    error instanceof Error
                                        ? error.message + moderationSuffix(error)
                                        : 'Streaming error occurred'
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                            controller.close();
                        }
                    }
                });

                return new Response(readableStream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        Connection: 'keep-alive'
                    }
                });
            }

            console.log('Calling OpenAI generate with params:', baseParams);
            result = await openai.images.generate(baseParams);
        } else if (mode === 'edit') {
            const imageFiles: File[] = [];
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('image_') && value instanceof File) {
                    imageFiles.push(value);
                }
            }

            if (imageFiles.length === 0) {
                return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
            }

            const maskFile = formData.get('mask') as File | null;
            const markupFile = formData.get('markup') as File | null;

            const baseEditParams: EditParams = {
                model,
                prompt,
                image: imageFiles,
                ...sharedParams,
                // The edit form never offers SVG.
                output_format: output_format as Exclude<ImageOutputFormat, 'svg'>,
                ...(maskFile ? { mask: maskFile } : {}),
                ...(markupFile ? { markup: markupFile } : {})
            };

            // Handle streaming mode for editing
            if (streamEnabled) {
                const streamEditParams: EditParamsStreaming = {
                    ...baseEditParams,
                    stream: true,
                    partial_images: partialImages
                };

                console.log('Calling OpenAI edit with streaming, params:', {
                    ...streamEditParams,
                    image: `[${imageFiles.map((f) => f.name).join(', ')}]`,
                    mask: maskFile ? maskFile.name : 'N/A',
                    markup: markupFile ? markupFile.name : 'N/A'
                });

                const stream = await openai.images.edit(streamEditParams);

                // Create SSE response for edit
                const encoder = new TextEncoder();
                const timestamp = Date.now();

                const readableStream = new ReadableStream({
                    async start(controller) {
                        try {
                            const completedImages: Array<{
                                filename: string;
                                b64_json: string;
                                path?: string;
                                output_format: string;
                            }> = [];
                            let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;
                            let imageIndex = 0;

                            for await (const event of stream) {
                                if (event.type === 'image_edit.partial_image') {
                                    const partialEvent: StreamingEvent = {
                                        type: 'partial_image',
                                        index: imageIndex,
                                        partial_image_index: event.partial_image_index,
                                        b64_json: event.b64_json
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialEvent)}\n\n`));
                                } else if (event.type === 'image_edit.completed') {
                                    const currentIndex = imageIndex;
                                    const filename = `${timestamp}-${currentIndex}.${output_format}`;

                                    // Save to filesystem if in fs mode
                                    if (effectiveStorageMode === 'fs' && event.b64_json) {
                                        const buffer = Buffer.from(event.b64_json, 'base64');
                                        const filepath = path.join(outputDir, filename);
                                        await fs.writeFile(filepath, buffer);
                                        console.log(`Streaming edit: Saved image ${filename}`);
                                    }

                                    const imageData = {
                                        filename,
                                        b64_json: event.b64_json || '',
                                        output_format,
                                        ...(effectiveStorageMode === 'fs' ? { path: `/api/image/${filename}` } : {})
                                    };
                                    completedImages.push(imageData);

                                    const completedEvent: StreamingEvent = {
                                        type: 'completed',
                                        index: currentIndex,
                                        filename,
                                        b64_json: event.b64_json,
                                        path: effectiveStorageMode === 'fs' ? `/api/image/${filename}` : undefined,
                                        output_format
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(completedEvent)}\n\n`));

                                    imageIndex++;

                                    finalUsage = event.usage;
                                }
                            }

                            // Send final done event with all images and usage
                            const doneEvent: StreamingEvent = {
                                type: 'done',
                                images: completedImages,
                                usage: finalUsage
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
                            controller.close();
                        } catch (error) {
                            console.error('Streaming edit error:', error);
                            const errorEvent: StreamingEvent = {
                                type: 'error',
                                error:
                                    error instanceof Error
                                        ? error.message + moderationSuffix(error)
                                        : 'Streaming error occurred'
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                            controller.close();
                        }
                    }
                });

                return new Response(readableStream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        Connection: 'keep-alive'
                    }
                });
            }

            console.log('Calling OpenAI edit with params:', {
                ...baseEditParams,
                image: `[${imageFiles.map((f) => f.name).join(', ')}]`,
                mask: maskFile ? maskFile.name : 'N/A',
                markup: markupFile ? markupFile.name : 'N/A'
            });
            result = await openai.images.edit(baseEditParams);
        } else {
            return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 });
        }

        console.log('OpenAI API call successful.');

        if (!result || !Array.isArray(result.data) || result.data.length === 0) {
            console.error('Invalid or empty data received from OpenAI API:', result);
            return NextResponse.json({ error: 'Failed to retrieve image data from API.' }, { status: 500 });
        }

        const savedImagesData = await Promise.all(
            result.data.map(async (imageData, index) => {
                if (!imageData.b64_json) {
                    console.error(`Image data ${index} is missing b64_json.`);
                    throw new Error(`Image data at index ${index} is missing base64 data.`);
                }
                const buffer = Buffer.from(imageData.b64_json, 'base64');
                const timestamp = Date.now();
                const filename = `${timestamp}-${index}.${output_format}`;

                if (effectiveStorageMode === 'fs') {
                    const filepath = path.join(outputDir, filename);
                    console.log(`Attempting to save image to: ${filepath}`);
                    await fs.writeFile(filepath, buffer);
                    console.log(`Successfully saved image: ${filename}`);
                } else {
                }

                const imageResult: { filename: string; b64_json: string; path?: string; output_format: string } = {
                    filename: filename,
                    b64_json: imageData.b64_json,
                    output_format
                };

                if (effectiveStorageMode === 'fs') {
                    imageResult.path = `/api/image/${filename}`;
                }

                return imageResult;
            })
        );

        console.log(`All images processed. Mode: ${effectiveStorageMode}`);

        return NextResponse.json({ images: savedImagesData, usage: result.usage, svg_usage: result.svg_usage });
    } catch (error: unknown) {
        console.error('Error in /api/images:', error);

        let errorMessage = 'An unexpected error occurred.';
        let status = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
            if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        } else if (typeof error === 'object' && error !== null) {
            if ('message' in error && typeof error.message === 'string') {
                errorMessage = error.message;
            }
            if ('status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        }

        return NextResponse.json({ error: errorMessage + moderationSuffix(error) }, { status });
    }
}
