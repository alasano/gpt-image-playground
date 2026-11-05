'use client';

import { EditingForm, type EditRegionMode, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { PasswordDialog } from '@/components/password-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { calculateApiCost, type ApiUsage, type CostDetails } from '@/lib/cost-utils';
import { db, type ImageRecord } from '@/lib/db';
import {
    DEFAULT_COMPLEXITY,
    DEFAULT_GPT_IMAGE_MODEL,
    DEFAULT_SVG_WRITER_MODEL,
    EDIT_INPUT_FORMATS,
    GIF_FRAME_COUNT,
    GIF_FRAME_DURATION_MS,
    MAX_EDIT_IMAGES,
    MODEL_CAPABILITIES,
    getMimeType,
    getStreamingBlockedReason,
    type GptImageModel,
    type HistoryGptImageModel,
    type ImageBackground,
    type ImageComplexity,
    type ImageMode,
    type ImageModeration,
    type ImageOutputFormat,
    type ImageQuality,
    type SvgReasoningEffort,
    type SvgWriterModel
} from '@/lib/models';
import { getPresetDimensions } from '@/lib/size-utils';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ImagesResponse } from 'openai/resources/images';
import * as React from 'react';

type HistoryImage = {
    filename: string;
};

export type HistoryMetadata = {
    timestamp: number;
    images: HistoryImage[];
    storageModeUsed?: 'fs' | 'indexeddb';
    durationMs: number;
    quality: ImageQuality;
    background: ImageBackground;
    moderation: ImageModeration;
    prompt: string;
    mode: ImageMode;
    costDetails: CostDetails | null;
    output_format?: ImageOutputFormat;
    /** Absent on entries written before the field existed; those were all produced by gpt-image-1. */
    model?: HistoryGptImageModel;
    /** Only recorded for models that accept it. */
    complexity?: ImageComplexity;
    /** Only recorded for GIF output. */
    frame_count?: number;
    frame_duration_ms?: number;
};

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;

const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

let effectiveStorageModeClient: 'fs' | 'indexeddb';

if (explicitModeClient === 'fs') {
    effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
    effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {
    effectiveStorageModeClient = 'indexeddb';
} else {
    effectiveStorageModeClient = 'fs';
}
console.log(
    `Client Effective Storage Mode: ${effectiveStorageModeClient} (Explicit: ${explicitModeClient || 'unset'}, Vercel Env: ${vercelEnvClient || 'N/A'})`
);

type ApiImageResponseItem = {
    filename: string;
    b64_json?: string;
    output_format: ImageOutputFormat;
    path?: string;
};

const EDIT_INPUT_MIME_TYPES = EDIT_INPUT_FORMATS.map(getMimeType);

/** Request fields that only some models or formats accept; also recorded in history. */
function getConditionalParams(
    model: GptImageModel,
    format: ImageOutputFormat,
    complexity: ImageComplexity,
    frameCount: number,
    frameDurationMs: number
) {
    return {
        ...(MODEL_CAPABILITIES[model].complexity && { complexity }),
        ...(format === 'gif' && { frame_count: frameCount, frame_duration_ms: frameDurationMs })
    };
}

export default function HomePage() {
    const [mode, setMode] = React.useState<ImageMode>('generate');
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [generationStartTime, setGenerationStartTime] = React.useState<number | null>(null);
    const [isSendingToEdit, setIsSendingToEdit] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [latestImageBatch, setLatestImageBatch] = React.useState<{ path: string; filename: string }[] | null>(null);
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [lastApiCallArgs, setLastApiCallArgs] = React.useState<[GenerationFormData | EditingFormData] | null>(null);
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState<boolean>(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState<boolean>(false);

    const allDbImages = useLiveQuery<ImageRecord[] | undefined>(() => db.images.toArray(), []);

    const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
    const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
    const [editPrompt, setEditPrompt] = React.useState('');
    const [editN, setEditN] = React.useState([1]);
    const [editSize, setEditSize] = React.useState<EditingFormData['size']>('auto');
    const [editCustomWidth, setEditCustomWidth] = React.useState<number>(1024);
    const [editCustomHeight, setEditCustomHeight] = React.useState<number>(1024);
    const [editQuality, setEditQuality] = React.useState<EditingFormData['quality']>('auto');
    const [editOutputFormat, setEditOutputFormat] = React.useState<EditingFormData['output_format']>('png');
    const [editCompression, setEditCompression] = React.useState([100]);
    const [editBackground, setEditBackground] = React.useState<EditingFormData['background']>('auto');
    const [editModeration, setEditModeration] = React.useState<EditingFormData['moderation']>('auto');
    const [editComplexity, setEditComplexity] = React.useState<ImageComplexity>(DEFAULT_COMPLEXITY);
    const [editFrameCount, setEditFrameCount] = React.useState<number>(GIF_FRAME_COUNT.default);
    const [editFrameDurationMs, setEditFrameDurationMs] = React.useState<number>(GIF_FRAME_DURATION_MS.default);
    const [editRegionMode, setEditRegionMode] = React.useState<EditRegionMode>('mask');
    const [editBrushSize, setEditBrushSize] = React.useState([20]);
    const [editShowRegionEditor, setEditShowRegionEditor] = React.useState(false);
    const [editRegionFile, setEditRegionFile] = React.useState<File | null>(null);
    const [editIsRegionSaved, setEditIsRegionSaved] = React.useState(false);
    const [editOriginalImageSize, setEditOriginalImageSize] = React.useState<{ width: number; height: number } | null>(
        null
    );
    const [editDrawnPoints, setEditDrawnPoints] = React.useState<DrawnPoint[]>([]);
    const [editRegionPreviewUrl, setEditRegionPreviewUrl] = React.useState<string | null>(null);

    const [genModel, setGenModel] = React.useState<GenerationFormData['model']>(DEFAULT_GPT_IMAGE_MODEL);
    const [genPrompt, setGenPrompt] = React.useState('');
    const [genN, setGenN] = React.useState([1]);
    const [genSize, setGenSize] = React.useState<GenerationFormData['size']>('auto');
    const [genCustomWidth, setGenCustomWidth] = React.useState<number>(1024);
    const [genCustomHeight, setGenCustomHeight] = React.useState<number>(1024);
    const [genQuality, setGenQuality] = React.useState<GenerationFormData['quality']>('auto');
    const [genOutputFormat, setGenOutputFormat] = React.useState<GenerationFormData['output_format']>('png');
    const [genCompression, setGenCompression] = React.useState([100]);
    const [genBackground, setGenBackground] = React.useState<GenerationFormData['background']>('auto');
    const [genModeration, setGenModeration] = React.useState<GenerationFormData['moderation']>('auto');
    const [genComplexity, setGenComplexity] = React.useState<ImageComplexity>(DEFAULT_COMPLEXITY);
    const [genFrameCount, setGenFrameCount] = React.useState<number>(GIF_FRAME_COUNT.default);
    const [genFrameDurationMs, setGenFrameDurationMs] = React.useState<number>(GIF_FRAME_DURATION_MS.default);
    const [genSvgModel, setGenSvgModel] = React.useState<SvgWriterModel>(DEFAULT_SVG_WRITER_MODEL);
    const [genSvgEffort, setGenSvgEffort] = React.useState<SvgReasoningEffort | null>(null);

    const [editModel, setEditModel] = React.useState<EditingFormData['model']>(DEFAULT_GPT_IMAGE_MODEL);

    // Streaming state (shared between generate and edit modes)
    const [enableStreaming, setEnableStreaming] = React.useState(false);
    const [partialImages, setPartialImages] = React.useState<1 | 2 | 3>(2);
    // Streaming preview images (base64 data URLs for partial images during streaming)
    const [streamingPreviewImages, setStreamingPreviewImages] = React.useState<Map<number, string>>(new Map());

    const getImageSrc = React.useCallback(
        (filename: string): string | undefined => {
            const cached = blobUrlCacheRef.current.get(filename);
            if (cached) return cached;

            const record = allDbImages?.find((img) => img.filename === filename);
            if (record?.blob) {
                const url = URL.createObjectURL(record.blob);
                blobUrlCacheRef.current.set(filename, url);
                return url;
            }

            return undefined;
        },
        [allDbImages]
    );

    React.useEffect(() => {
        const cache = blobUrlCacheRef.current;
        return () => {
            cache.forEach((url) => URL.revokeObjectURL(url));
            cache.clear();
        };
    }, []);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        let cancelled = false;

        queueMicrotask(() => {
            if (cancelled) return;

            try {
                const storedHistory = localStorage.getItem('openaiImageHistory');
                if (storedHistory) {
                    const parsedHistory: HistoryMetadata[] = JSON.parse(storedHistory);
                    if (Array.isArray(parsedHistory)) {
                        setHistory(parsedHistory);
                    } else {
                        console.warn('Invalid history data found in localStorage.');
                        localStorage.removeItem('openaiImageHistory');
                    }
                }
            } catch (e) {
                console.error('Failed to load or parse history from localStorage:', e);
                localStorage.removeItem('openaiImageHistory');
            }
            setIsInitialLoad(false);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        const fetchAuthStatus = async () => {
            try {
                const response = await fetch('/api/auth-status');
                if (!response.ok) {
                    throw new Error('Failed to fetch auth status');
                }
                const data = await response.json();
                setIsPasswordRequiredByBackend(data.passwordRequired);
            } catch (error) {
                console.error('Error fetching auth status:', error);
                setIsPasswordRequiredByBackend(false);
            }
        };

        fetchAuthStatus();

        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;

            const storedHash = localStorage.getItem('clientPasswordHash');
            if (storedHash) {
                setClientPasswordHash(storedHash);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem('openaiImageHistory', JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        let cancelled = false;

        queueMicrotask(() => {
            if (cancelled) return;

            const storedPref = localStorage.getItem('imageGenSkipDeleteConfirm');
            if (storedPref === 'true') {
                setSkipDeleteConfirmation(true);
            } else if (storedPref === 'false') {
                setSkipDeleteConfirmation(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        localStorage.setItem('imageGenSkipDeleteConfirm', String(skipDeleteConfirmation));
    }, [skipDeleteConfirmation]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (mode !== 'edit' || !event.clipboardData) {
                return;
            }

            if (editImageFiles.length >= MAX_EDIT_IMAGES) {
                alert(`Cannot paste: Maximum of ${MAX_EDIT_IMAGES} images reached.`);
                return;
            }

            const items = event.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (EDIT_INPUT_MIME_TYPES.includes(items[i].type)) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();

                        const previewUrl = URL.createObjectURL(file);

                        setEditImageFiles((prevFiles) => [...prevFiles, file]);
                        setEditSourceImagePreviewUrls((prevUrls) => [...prevUrls, previewUrl]);

                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [mode, editImageFiles.length]);

    async function sha256Client(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    const handleSavePassword = async (password: string) => {
        if (!password.trim()) {
            setError('Password cannot be empty.');
            return;
        }
        try {
            const hash = await sha256Client(password);
            localStorage.setItem('clientPasswordHash', hash);
            setClientPasswordHash(hash);
            setError(null);
            setIsPasswordDialogOpen(false);
            if (passwordDialogContext === 'retry' && lastApiCallArgs) {
                await handleApiCall(...lastApiCallArgs);
            }
        } catch (e) {
            console.error('Error hashing password:', e);
            setError('Failed to save password due to a hashing error.');
        }
    };

    const handleOpenPasswordDialog = () => {
        setPasswordDialogContext('initial');
        setIsPasswordDialogOpen(true);
    };

    // Shared tail for streamed and non-streamed responses: persist blobs (indexeddb mode), show the batch, record history.
    const processApiImages = async (
        images: ApiImageResponseItem[],
        usage: ApiUsage | undefined,
        durationMs: number,
        svgUsage?: ImagesResponse.SvgUsage
    ) => {
        const isGenerate = mode === 'generate';
        const currentModel = isGenerate ? genModel : editModel;
        const outputFormat = isGenerate ? genOutputFormat : editOutputFormat;
        const newHistoryEntry: HistoryMetadata = {
            timestamp: Date.now(),
            images: images.map((img) => ({ filename: img.filename })),
            storageModeUsed: effectiveStorageModeClient,
            durationMs,
            quality: isGenerate ? genQuality : editQuality,
            background: isGenerate ? genBackground : editBackground,
            moderation: isGenerate ? genModeration : editModeration,
            output_format: outputFormat,
            prompt: isGenerate ? genPrompt : editPrompt,
            mode,
            costDetails: calculateApiCost(usage, currentModel, svgUsage && { model: genSvgModel, usage: svgUsage }),
            model: currentModel,
            ...(isGenerate
                ? getConditionalParams(genModel, genOutputFormat, genComplexity, genFrameCount, genFrameDurationMs)
                : getConditionalParams(
                      editModel,
                      editOutputFormat,
                      editComplexity,
                      editFrameCount,
                      editFrameDurationMs
                  ))
        };

        let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[];
        if (effectiveStorageModeClient === 'indexeddb') {
            newImageBatchPromises = images.map(async (img) => {
                if (!img.b64_json) {
                    console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
                    return null;
                }
                try {
                    const byteCharacters = atob(img.b64_json);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);

                    const actualMimeType = getMimeType(img.output_format);
                    const blob = new Blob([byteArray], { type: actualMimeType });

                    await db.images.put({ filename: img.filename, blob });

                    const blobUrl = URL.createObjectURL(blob);
                    blobUrlCacheRef.current.set(img.filename, blobUrl);

                    return { filename: img.filename, path: blobUrl };
                } catch (dbError) {
                    console.error(`Error saving blob ${img.filename} to IndexedDB:`, dbError);
                    setError(`Failed to save image ${img.filename} to local database.`);
                    return null;
                }
            });
        } else {
            newImageBatchPromises = images
                .filter((img) => !!img.path)
                .map((img) => Promise.resolve({ path: img.path!, filename: img.filename }));
        }

        const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as {
            path: string;
            filename: string;
        }[];

        setLatestImageBatch(processedImages);
        setImageOutputView(processedImages.length > 1 ? 'grid' : 0);
        setStreamingPreviewImages(new Map());
        setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
    };

    const handleApiCall = async (formData: GenerationFormData | EditingFormData) => {
        const startTime = Date.now();
        let durationMs = 0;

        setIsLoading(true);
        setGenerationStartTime(startTime);
        setError(null);
        setLatestImageBatch(null);
        setImageOutputView('grid');
        setStreamingPreviewImages(new Map());

        const apiFormData = new FormData();
        if (isPasswordRequiredByBackend && clientPasswordHash) {
            apiFormData.append('passwordHash', clientPasswordHash);
        } else if (isPasswordRequiredByBackend && !clientPasswordHash) {
            setError('Password is required. Please configure the password by clicking the lock icon.');
            setPasswordDialogContext('initial');
            setIsPasswordDialogOpen(true);
            setIsLoading(false);
            return;
        }
        apiFormData.append('mode', mode);

        // The streaming preference is shared by both forms; apply it only where the current request allows it.
        const isGenerateRequest = mode === 'generate';
        if (
            enableStreaming &&
            !getStreamingBlockedReason(
                isGenerateRequest ? genN[0] : editN[0],
                isGenerateRequest ? genOutputFormat : editOutputFormat
            )
        ) {
            apiFormData.append('stream', 'true');
            apiFormData.append('partial_images', partialImages.toString());
        }

        if (mode === 'generate') {
            const genData = formData as GenerationFormData;
            apiFormData.append('model', genModel);
            apiFormData.append('prompt', genPrompt);
            apiFormData.append('n', genN[0].toString());
            const genSizeToSend =
                genSize === 'custom'
                    ? `${genCustomWidth}x${genCustomHeight}`
                    : (getPresetDimensions(genSize) ?? genSize);
            apiFormData.append('size', genSizeToSend);
            apiFormData.append('quality', genQuality);
            apiFormData.append('output_format', genOutputFormat);
            if (
                (genOutputFormat === 'jpeg' || genOutputFormat === 'webp') &&
                genData.output_compression !== undefined
            ) {
                apiFormData.append('output_compression', genData.output_compression.toString());
            }
            apiFormData.append('background', genBackground);
            apiFormData.append('moderation', genModeration);
            Object.entries(
                getConditionalParams(genModel, genOutputFormat, genComplexity, genFrameCount, genFrameDurationMs)
            ).forEach(([key, value]) => apiFormData.append(key, String(value)));
            if (genOutputFormat === 'svg') {
                apiFormData.append('svg_model', genSvgModel);
                if (genSvgEffort) {
                    apiFormData.append('svg_reasoning_effort', genSvgEffort);
                }
            }
        } else {
            const editData = formData as EditingFormData;
            apiFormData.append('model', editModel);
            apiFormData.append('prompt', editPrompt);
            apiFormData.append('n', editN[0].toString());
            const editSizeToSend =
                editSize === 'custom'
                    ? `${editCustomWidth}x${editCustomHeight}`
                    : (getPresetDimensions(editSize) ?? editSize);
            apiFormData.append('size', editSizeToSend);
            apiFormData.append('quality', editQuality);
            apiFormData.append('output_format', editOutputFormat);
            if (
                (editOutputFormat === 'jpeg' || editOutputFormat === 'webp') &&
                editData.output_compression !== undefined
            ) {
                apiFormData.append('output_compression', editData.output_compression.toString());
            }
            apiFormData.append('background', editBackground);
            apiFormData.append('moderation', editModeration);
            Object.entries(
                getConditionalParams(editModel, editOutputFormat, editComplexity, editFrameCount, editFrameDurationMs)
            ).forEach(([key, value]) => apiFormData.append(key, String(value)));

            editImageFiles.forEach((file, index) => {
                apiFormData.append(`image_${index}`, file, file.name);
            });
            if (editRegionFile) {
                apiFormData.append(editRegionMode, editRegionFile, editRegionFile.name);
            }
        }

        try {
            const response = await fetch('/api/images', {
                method: 'POST',
                body: apiFormData
            });

            // Check if response is SSE (streaming)
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/event-stream')) {
                if (!response.body) {
                    throw new Error('Response body is null');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Process complete SSE events
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep incomplete event in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.slice(6);
                            try {
                                const event = JSON.parse(jsonStr);

                                if (event.type === 'partial_image') {
                                    // Update streaming preview with partial image
                                    const imageIndex = event.index ?? 0;
                                    const mimeType = getMimeType(
                                        mode === 'generate' ? genOutputFormat : editOutputFormat
                                    );
                                    const dataUrl = `data:${mimeType};base64,${event.b64_json}`;
                                    setStreamingPreviewImages((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(imageIndex, dataUrl);
                                        return newMap;
                                    });
                                } else if (event.type === 'error') {
                                    throw new Error(event.error || 'Streaming error occurred');
                                } else if (event.type === 'done') {
                                    // Finalize with all completed images
                                    durationMs = Date.now() - startTime;

                                    if (event.images && event.images.length > 0) {
                                        await processApiImages(event.images, event.usage, durationMs);
                                    }
                                }
                            } catch (parseError) {
                                console.error('Error parsing SSE event:', parseError);
                            }
                        }
                    }
                }

                return; // Exit early for streaming
            }

            // Non-streaming response handling (original code)
            const result = await response.json();

            if (!response.ok) {
                if (response.status === 401 && isPasswordRequiredByBackend) {
                    setError('Unauthorized: Invalid or missing password. Please try again.');
                    setPasswordDialogContext('retry');
                    setLastApiCallArgs([formData]);
                    setIsPasswordDialogOpen(true);

                    return;
                }
                throw new Error(result.error || `API request failed with status ${response.status}`);
            }

            if (result.images && result.images.length > 0) {
                durationMs = Date.now() - startTime;
                await processApiImages(result.images, result.usage, durationMs, result.svg_usage);
            } else {
                setLatestImageBatch(null);
                throw new Error('API response did not contain valid image data or filenames.');
            }
        } catch (err: unknown) {
            durationMs = Date.now() - startTime;
            console.error(`API Call Error after ${durationMs}ms:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);
            setLatestImageBatch(null);
            setStreamingPreviewImages(new Map());
        } finally {
            if (durationMs === 0) durationMs = Date.now() - startTime;
            setIsLoading(false);
            setGenerationStartTime(null);
        }
    };

    const handleHistorySelect = React.useCallback(
        (item: HistoryMetadata) => {
            const originalStorageMode = item.storageModeUsed || 'fs';

            const selectedBatchPromises = item.images.map(async (imgInfo) => {
                let path: string | undefined;
                if (originalStorageMode === 'indexeddb') {
                    path = getImageSrc(imgInfo.filename);
                } else {
                    path = `/api/image/${imgInfo.filename}`;
                }

                if (path) {
                    return { path, filename: imgInfo.filename };
                } else {
                    console.warn(
                        `Could not get image source for history item: ${imgInfo.filename} (mode: ${originalStorageMode})`
                    );
                    setError(`Image ${imgInfo.filename} could not be loaded.`);
                    return null;
                }
            });

            Promise.all(selectedBatchPromises).then((resolvedBatch) => {
                const validImages = resolvedBatch.filter(Boolean) as { path: string; filename: string }[];

                if (validImages.length !== item.images.length) {
                    setError(
                        'Some images from this history entry could not be loaded (they might have been cleared or are missing).'
                    );
                } else {
                    setError(null);
                }

                setLatestImageBatch(validImages.length > 0 ? validImages : null);
                setImageOutputView(validImages.length > 1 ? 'grid' : 0);
            });
        },
        [getImageSrc]
    );

    const handleClearHistory = React.useCallback(async () => {
        const confirmationMessage =
            effectiveStorageModeClient === 'indexeddb'
                ? 'Are you sure you want to clear the entire image history? In IndexedDB mode, this will also permanently delete all stored images. This cannot be undone.'
                : 'Are you sure you want to clear the entire image history? This cannot be undone.';

        if (window.confirm(confirmationMessage)) {
            setHistory([]);
            setLatestImageBatch(null);
            setImageOutputView('grid');
            setError(null);

            try {
                localStorage.removeItem('openaiImageHistory');

                if (effectiveStorageModeClient === 'indexeddb') {
                    await db.images.clear();
                    blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                    blobUrlCacheRef.current.clear();
                }
            } catch (e) {
                console.error('Failed during history clearing:', e);
                setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }, []);

    const handleSendToEdit = async (filename: string) => {
        if (isSendingToEdit) return;
        setIsSendingToEdit(true);
        setError(null);

        const alreadyExists = editImageFiles.some((file) => file.name === filename);
        if (mode === 'edit' && alreadyExists) {
            setIsSendingToEdit(false);
            return;
        }

        if (mode === 'edit' && editImageFiles.length >= MAX_EDIT_IMAGES) {
            setError(`Cannot add more than ${MAX_EDIT_IMAGES} images to the edit form.`);
            setIsSendingToEdit(false);
            return;
        }

        try {
            let blob: Blob | undefined;
            let mimeType: string = 'image/png';

            if (effectiveStorageModeClient === 'indexeddb') {
                const record = allDbImages?.find((img) => img.filename === filename);
                if (record?.blob) {
                    blob = record.blob;
                    mimeType = blob.type || mimeType;
                } else {
                    throw new Error(`Image ${filename} not found in local database.`);
                }
            } else {
                const response = await fetch(`/api/image/${filename}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.statusText}`);
                }
                blob = await response.blob();
                mimeType = response.headers.get('Content-Type') || mimeType;
            }

            if (!blob) {
                throw new Error(`Could not retrieve image data for ${filename}.`);
            }

            const newFile = new File([blob], filename, { type: mimeType });
            const newPreviewUrl = URL.createObjectURL(blob);

            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

            setEditImageFiles([newFile]);
            setEditSourceImagePreviewUrls([newPreviewUrl]);

            if (mode === 'generate') {
                setMode('edit');
            }
        } catch (err: unknown) {
            console.error('Error sending image to edit:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to send image to edit form.';
            setError(errorMessage);
        } finally {
            setIsSendingToEdit(false);
        }
    };

    const executeDeleteItem = React.useCallback(
        async (item: HistoryMetadata) => {
            if (!item) return;
            setError(null);

            const { images: imagesInEntry, storageModeUsed, timestamp } = item;
            const filenamesToDelete = imagesInEntry.map((img) => img.filename);

            try {
                if (storageModeUsed === 'indexeddb') {
                    await db.images.where('filename').anyOf(filenamesToDelete).delete();
                    filenamesToDelete.forEach((fn) => {
                        const url = blobUrlCacheRef.current.get(fn);
                        if (url) URL.revokeObjectURL(url);
                        blobUrlCacheRef.current.delete(fn);
                    });
                } else if (storageModeUsed === 'fs') {
                    const apiPayload: { filenames: string[]; passwordHash?: string } = {
                        filenames: filenamesToDelete
                    };
                    if (isPasswordRequiredByBackend && clientPasswordHash) {
                        apiPayload.passwordHash = clientPasswordHash;
                    }

                    const response = await fetch('/api/image-delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(apiPayload)
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || `API deletion failed with status ${response.status}`);
                    }
                }

                setHistory((prevHistory) => prevHistory.filter((h) => h.timestamp !== timestamp));
                setLatestImageBatch((prev) =>
                    prev && prev.some((img) => filenamesToDelete.includes(img.filename)) ? null : prev
                );
            } catch (e: unknown) {
                console.error('Error during item deletion:', e);
                setError(e instanceof Error ? e.message : 'An unexpected error occurred during deletion.');
            } finally {
                setItemToDeleteConfirm(null);
            }
        },
        [isPasswordRequiredByBackend, clientPasswordHash]
    );

    const handleRequestDeleteItem = React.useCallback(
        (item: HistoryMetadata) => {
            if (!skipDeleteConfirmation) {
                setDialogCheckboxStateSkipConfirm(skipDeleteConfirmation);
                setItemToDeleteConfirm(item);
            } else {
                executeDeleteItem(item);
            }
        },
        [skipDeleteConfirmation, executeDeleteItem]
    );

    const handleConfirmDeletion = React.useCallback(() => {
        if (itemToDeleteConfirm) {
            executeDeleteItem(itemToDeleteConfirm);
            setSkipDeleteConfirmation(dialogCheckboxStateSkipConfirm);
        }
    }, [itemToDeleteConfirm, executeDeleteItem, dialogCheckboxStateSkipConfirm]);

    const handleCancelDeletion = React.useCallback(() => {
        setItemToDeleteConfirm(null);
    }, []);

    return (
        <main className='flex min-h-screen flex-col items-center bg-black p-4 text-white md:p-8 lg:p-12'>
            <PasswordDialog
                isOpen={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
                onSave={handleSavePassword}
                title={passwordDialogContext === 'retry' ? 'Password Required' : 'Configure Password'}
                description={
                    passwordDialogContext === 'retry'
                        ? 'The server requires a password, or the previous one was incorrect. Please enter it to continue.'
                        : 'Set a password to use for API requests.'
                }
            />
            <div className='w-full max-w-screen-2xl space-y-6'>
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                    <div className='relative flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        <div className={mode === 'generate' ? 'block h-full w-full' : 'hidden'}>
                            <GenerationForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                model={genModel}
                                setModel={setGenModel}
                                prompt={genPrompt}
                                setPrompt={setGenPrompt}
                                n={genN}
                                setN={setGenN}
                                size={genSize}
                                setSize={setGenSize}
                                customWidth={genCustomWidth}
                                setCustomWidth={setGenCustomWidth}
                                customHeight={genCustomHeight}
                                setCustomHeight={setGenCustomHeight}
                                quality={genQuality}
                                setQuality={setGenQuality}
                                complexity={genComplexity}
                                setComplexity={setGenComplexity}
                                outputFormat={genOutputFormat}
                                setOutputFormat={setGenOutputFormat}
                                compression={genCompression}
                                setCompression={setGenCompression}
                                frameCount={genFrameCount}
                                setFrameCount={setGenFrameCount}
                                frameDurationMs={genFrameDurationMs}
                                setFrameDurationMs={setGenFrameDurationMs}
                                svg={{
                                    model: genSvgModel,
                                    setModel: setGenSvgModel,
                                    effort: genSvgEffort,
                                    setEffort: setGenSvgEffort
                                }}
                                background={genBackground}
                                setBackground={setGenBackground}
                                moderation={genModeration}
                                setModeration={setGenModeration}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                            />
                        </div>
                        <div className={mode === 'edit' ? 'block h-full w-full' : 'hidden'}>
                            <EditingForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading || isSendingToEdit}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                editModel={editModel}
                                setEditModel={setEditModel}
                                imageFiles={editImageFiles}
                                sourceImagePreviewUrls={editSourceImagePreviewUrls}
                                setImageFiles={setEditImageFiles}
                                setSourceImagePreviewUrls={setEditSourceImagePreviewUrls}
                                maxImages={MAX_EDIT_IMAGES}
                                editPrompt={editPrompt}
                                setEditPrompt={setEditPrompt}
                                editN={editN}
                                setEditN={setEditN}
                                editSize={editSize}
                                setEditSize={setEditSize}
                                editCustomWidth={editCustomWidth}
                                setEditCustomWidth={setEditCustomWidth}
                                editCustomHeight={editCustomHeight}
                                setEditCustomHeight={setEditCustomHeight}
                                editQuality={editQuality}
                                setEditQuality={setEditQuality}
                                editComplexity={editComplexity}
                                setEditComplexity={setEditComplexity}
                                editOutputFormat={editOutputFormat}
                                setEditOutputFormat={setEditOutputFormat}
                                editCompression={editCompression}
                                setEditCompression={setEditCompression}
                                editFrameCount={editFrameCount}
                                setEditFrameCount={setEditFrameCount}
                                editFrameDurationMs={editFrameDurationMs}
                                setEditFrameDurationMs={setEditFrameDurationMs}
                                editBackground={editBackground}
                                setEditBackground={setEditBackground}
                                editModeration={editModeration}
                                setEditModeration={setEditModeration}
                                editBrushSize={editBrushSize}
                                setEditBrushSize={setEditBrushSize}
                                editShowRegionEditor={editShowRegionEditor}
                                setEditShowRegionEditor={setEditShowRegionEditor}
                                editRegionMode={editRegionMode}
                                setEditRegionMode={setEditRegionMode}
                                editRegionFile={editRegionFile}
                                setEditRegionFile={setEditRegionFile}
                                editIsRegionSaved={editIsRegionSaved}
                                setEditIsRegionSaved={setEditIsRegionSaved}
                                editOriginalImageSize={editOriginalImageSize}
                                setEditOriginalImageSize={setEditOriginalImageSize}
                                editDrawnPoints={editDrawnPoints}
                                setEditDrawnPoints={setEditDrawnPoints}
                                editRegionPreviewUrl={editRegionPreviewUrl}
                                setEditRegionPreviewUrl={setEditRegionPreviewUrl}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                            />
                        </div>
                    </div>
                    <div className='flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        {error && (
                            <Alert variant='destructive' className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                                <AlertTitle className='text-red-200'>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <ImageOutput
                            imageBatch={latestImageBatch}
                            viewMode={imageOutputView}
                            onViewChange={setImageOutputView}
                            altText='Generated image output'
                            isLoading={isLoading || isSendingToEdit}
                            loadingStartTime={generationStartTime}
                            onSendToEdit={handleSendToEdit}
                            currentMode={mode}
                            baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
                            streamingPreviewImages={streamingPreviewImages}
                        />
                    </div>
                </div>

                <div className='min-h-[450px]'>
                    <HistoryPanel
                        history={history}
                        onSelectImage={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getImageSrc={getImageSrc}
                        onDeleteItemRequest={handleRequestDeleteItem}
                        itemPendingDeleteConfirmation={itemToDeleteConfirm}
                        onConfirmDeletion={handleConfirmDeletion}
                        onCancelDeletion={handleCancelDeletion}
                        deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                        onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                    />
                </div>
            </div>
        </main>
    );
}
