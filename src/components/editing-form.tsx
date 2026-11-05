'use client';

import { ImageOptions, SLIDER_CLASS } from '@/components/image-options';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    EDIT_INPUT_FORMATS,
    GPT_IMAGE_MODELS,
    getMimeType,
    getStreamingBlockedReason,
    type GptImageModel,
    type ImageBackground,
    type ImageComplexity,
    type ImageMode,
    type ImageModeration,
    type ImageOutputFormat,
    type ImageQuality
} from '@/lib/models';
import { validateSizeSelection, type SizePreset } from '@/lib/size-utils';
import { Upload, Eraser, Save, Loader2, X, ScanEye, UploadCloud, Lock, LockOpen, HelpCircle } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

/** A mask marks the editable area with transparency; markup is a visible annotation layer the model reads. */
export type EditRegionMode = 'mask' | 'markup';

const MARKUP_STROKE_COLOR = '#ff0000';

export type EditingFormData = {
    prompt: string;
    n: number;
    size: SizePreset;
    customWidth: number;
    customHeight: number;
    quality: ImageQuality;
    output_format: ImageOutputFormat;
    output_compression?: number;
    background: ImageBackground;
    moderation: ImageModeration;
    imageFiles: File[];
    model: GptImageModel;
};

type EditingFormProps = {
    onSubmit: (data: EditingFormData) => void;
    isLoading: boolean;
    currentMode: ImageMode;
    onModeChange: (mode: ImageMode) => void;
    isPasswordRequiredByBackend: boolean | null;
    clientPasswordHash: string | null;
    onOpenPasswordDialog: () => void;
    editModel: EditingFormData['model'];
    setEditModel: React.Dispatch<React.SetStateAction<EditingFormData['model']>>;
    imageFiles: File[];
    sourceImagePreviewUrls: string[];
    setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
    setSourceImagePreviewUrls: React.Dispatch<React.SetStateAction<string[]>>;
    maxImages: number;
    editPrompt: string;
    setEditPrompt: React.Dispatch<React.SetStateAction<string>>;
    editN: number[];
    setEditN: React.Dispatch<React.SetStateAction<number[]>>;
    editSize: EditingFormData['size'];
    setEditSize: React.Dispatch<React.SetStateAction<EditingFormData['size']>>;
    editCustomWidth: number;
    setEditCustomWidth: React.Dispatch<React.SetStateAction<number>>;
    editCustomHeight: number;
    setEditCustomHeight: React.Dispatch<React.SetStateAction<number>>;
    editQuality: EditingFormData['quality'];
    setEditQuality: React.Dispatch<React.SetStateAction<EditingFormData['quality']>>;
    editComplexity: ImageComplexity;
    setEditComplexity: React.Dispatch<React.SetStateAction<ImageComplexity>>;
    editOutputFormat: EditingFormData['output_format'];
    setEditOutputFormat: React.Dispatch<React.SetStateAction<EditingFormData['output_format']>>;
    editCompression: number[];
    setEditCompression: React.Dispatch<React.SetStateAction<number[]>>;
    editFrameCount: number;
    setEditFrameCount: React.Dispatch<React.SetStateAction<number>>;
    editFrameDurationMs: number;
    setEditFrameDurationMs: React.Dispatch<React.SetStateAction<number>>;
    editBackground: EditingFormData['background'];
    setEditBackground: React.Dispatch<React.SetStateAction<EditingFormData['background']>>;
    editModeration: EditingFormData['moderation'];
    setEditModeration: React.Dispatch<React.SetStateAction<EditingFormData['moderation']>>;
    editBrushSize: number[];
    setEditBrushSize: React.Dispatch<React.SetStateAction<number[]>>;
    editShowRegionEditor: boolean;
    setEditShowRegionEditor: React.Dispatch<React.SetStateAction<boolean>>;
    editRegionMode: EditRegionMode;
    setEditRegionMode: React.Dispatch<React.SetStateAction<EditRegionMode>>;
    editRegionFile: File | null;
    setEditRegionFile: React.Dispatch<React.SetStateAction<File | null>>;
    editIsRegionSaved: boolean;
    setEditIsRegionSaved: React.Dispatch<React.SetStateAction<boolean>>;
    editOriginalImageSize: { width: number; height: number } | null;
    setEditOriginalImageSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
    editDrawnPoints: DrawnPoint[];
    setEditDrawnPoints: React.Dispatch<React.SetStateAction<DrawnPoint[]>>;
    editRegionPreviewUrl: string | null;
    setEditRegionPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
    enableStreaming: boolean;
    setEnableStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    partialImages: 1 | 2 | 3;
    setPartialImages: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
};

export function EditingForm({
    onSubmit,
    isLoading,
    currentMode,
    onModeChange,
    isPasswordRequiredByBackend,
    clientPasswordHash,
    onOpenPasswordDialog,
    editModel,
    setEditModel,
    imageFiles,
    sourceImagePreviewUrls,
    setImageFiles,
    setSourceImagePreviewUrls,
    maxImages,
    editPrompt,
    setEditPrompt,
    editN,
    setEditN,
    editSize,
    setEditSize,
    editCustomWidth,
    setEditCustomWidth,
    editCustomHeight,
    setEditCustomHeight,
    editQuality,
    setEditQuality,
    editComplexity,
    setEditComplexity,
    editOutputFormat,
    setEditOutputFormat,
    editCompression,
    setEditCompression,
    editFrameCount,
    setEditFrameCount,
    editFrameDurationMs,
    setEditFrameDurationMs,
    editBackground,
    setEditBackground,
    editModeration,
    setEditModeration,
    editBrushSize,
    setEditBrushSize,
    editShowRegionEditor,
    setEditShowRegionEditor,
    editRegionMode,
    setEditRegionMode,
    editRegionFile,
    setEditRegionFile,
    editIsRegionSaved,
    setEditIsRegionSaved,
    editOriginalImageSize,
    setEditOriginalImageSize,
    editDrawnPoints,
    setEditDrawnPoints,
    editRegionPreviewUrl,
    setEditRegionPreviewUrl,
    enableStreaming,
    setEnableStreaming,
    partialImages,
    setPartialImages
}: EditingFormProps) {
    const [firstImagePreviewUrl, setFirstImagePreviewUrl] = React.useState<string | null>(null);

    const showCompression = editOutputFormat === 'jpeg' || editOutputFormat === 'webp';
    const customSizeValidation = validateSizeSelection(
        editSize,
        editCustomWidth,
        editCustomHeight,
        editOutputFormat,
        editFrameCount,
        editN[0]
    );
    const customSizeInvalid = !customSizeValidation.valid;
    const streamingBlockedReason = getStreamingBlockedReason(editN[0], editOutputFormat);
    const streaming = enableStreaming && !streamingBlockedReason;
    const regionLabel = editRegionMode === 'markup' ? 'Markup' : 'Mask';
    const isGif = editOutputFormat === 'gif';

    // A saved file only fits the mode it was made for; the drawn strokes carry over.
    const handleRegionModeChange = React.useCallback(
        (value: string) => {
            setEditRegionMode(value as EditRegionMode);
            setEditRegionFile(null);
            setEditIsRegionSaved(false);
            setEditRegionPreviewUrl(null);
        },
        [setEditRegionMode, setEditRegionFile, setEditIsRegionSaved, setEditRegionPreviewUrl]
    );

    // The API rejects masks with GIF output; markup works.
    React.useEffect(() => {
        if (isGif && editRegionMode === 'mask') {
            handleRegionModeChange('markup');
        }
    }, [isGif, editRegionMode, handleRegionModeChange]);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const visualFeedbackCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const isDrawing = React.useRef(false);
    const lastPos = React.useRef<{ x: number; y: number } | null>(null);
    const regionInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (editOriginalImageSize) {
            if (!visualFeedbackCanvasRef.current) {
                visualFeedbackCanvasRef.current = document.createElement('canvas');
            }
            visualFeedbackCanvasRef.current.width = editOriginalImageSize.width;
            visualFeedbackCanvasRef.current.height = editOriginalImageSize.height;
        }
    }, [editOriginalImageSize]);

    // Masks and markup apply to the first image, so only a change of the first image resets them.
    const firstSourceUrl = sourceImagePreviewUrls[0];
    React.useEffect(() => {
        let cancelled = false;

        queueMicrotask(() => {
            if (cancelled) return;

            setEditRegionFile(null);
            setEditIsRegionSaved(false);
            setEditOriginalImageSize(null);
            setFirstImagePreviewUrl(null);
            setEditDrawnPoints([]);
            setEditRegionPreviewUrl(null);

            if (firstSourceUrl) {
                const img = new window.Image();
                img.onload = () => {
                    if (!cancelled) {
                        setEditOriginalImageSize({ width: img.width, height: img.height });
                    }
                };
                img.src = firstSourceUrl;
                setFirstImagePreviewUrl(firstSourceUrl);
            } else {
                setEditShowRegionEditor(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [
        firstSourceUrl,
        setEditRegionFile,
        setEditIsRegionSaved,
        setEditOriginalImageSize,
        setEditDrawnPoints,
        setEditRegionPreviewUrl,
        setEditShowRegionEditor
    ]);

    React.useEffect(() => {
        const displayCtx = canvasRef.current?.getContext('2d');
        const displayCanvas = canvasRef.current;
        const feedbackCanvas = visualFeedbackCanvasRef.current;

        if (!displayCtx || !displayCanvas || !feedbackCanvas || !editOriginalImageSize) return;

        const feedbackCtx = feedbackCanvas.getContext('2d');
        if (!feedbackCtx) return;

        feedbackCtx.clearRect(0, 0, feedbackCanvas.width, feedbackCanvas.height);
        feedbackCtx.fillStyle = 'red';
        editDrawnPoints.forEach((point) => {
            feedbackCtx.beginPath();
            feedbackCtx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
            feedbackCtx.fill();
        });

        displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.save();
        displayCtx.globalAlpha = 0.5;
        displayCtx.drawImage(feedbackCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.restore();
    }, [editDrawnPoints, editOriginalImageSize]);

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const addPoint = (x: number, y: number) => {
        setEditDrawnPoints((prevPoints) => [...prevPoints, { x, y, size: editBrushSize[0] }]);
        setEditIsRegionSaved(false);
        setEditRegionPreviewUrl(null);
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isDrawing.current = true;
        const currentPos = getMousePos(e);
        if (!currentPos) return;
        lastPos.current = currentPos;
        addPoint(currentPos.x, currentPos.y);
    };

    const drawLine = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current) return;
        e.preventDefault();
        const currentPos = getMousePos(e);
        if (!currentPos || !lastPos.current) return;

        const dist = Math.hypot(currentPos.x - lastPos.current.x, currentPos.y - lastPos.current.y);
        const angle = Math.atan2(currentPos.y - lastPos.current.y, currentPos.x - lastPos.current.x);
        const step = Math.max(1, editBrushSize[0] / 4);

        for (let i = step; i < dist; i += step) {
            const x = lastPos.current.x + Math.cos(angle) * i;
            const y = lastPos.current.y + Math.sin(angle) * i;
            addPoint(x, y);
        }
        addPoint(currentPos.x, currentPos.y);

        lastPos.current = currentPos;
    };

    const drawStroke = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    };

    const stopDrawing = () => {
        isDrawing.current = false;
        lastPos.current = null;
    };

    const handleClearRegion = () => {
        setEditDrawnPoints([]);
        setEditRegionFile(null);
        setEditIsRegionSaved(false);
        setEditRegionPreviewUrl(null);
    };

    const generateAndSaveRegion = () => {
        if (!editOriginalImageSize || editDrawnPoints.length === 0) {
            setEditRegionFile(null);
            setEditIsRegionSaved(false);
            setEditRegionPreviewUrl(null);
            return;
        }

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = editOriginalImageSize.width;
        offscreenCanvas.height = editOriginalImageSize.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');

        if (!offscreenCtx) return;

        if (editRegionMode === 'markup') {
            // Opaque strokes on a transparent layer the size of the first image.
            offscreenCtx.fillStyle = MARKUP_STROKE_COLOR;
        } else {
            // Opaque everywhere except the drawn areas, which become the editable region.
            offscreenCtx.fillStyle = '#000000';
            offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            offscreenCtx.globalCompositeOperation = 'destination-out';
        }
        editDrawnPoints.forEach((point) => {
            drawStroke(offscreenCtx, point.x, point.y, point.size);
        });

        try {
            const dataUrl = offscreenCanvas.toDataURL('image/png');
            setEditRegionPreviewUrl(dataUrl);
        } catch (e) {
            console.error('Error generating region preview data URL:', e);
            setEditRegionPreviewUrl(null);
        }

        offscreenCanvas.toBlob((blob) => {
            if (blob) {
                const regionFile = new File([blob], `generated-${editRegionMode}.png`, { type: 'image/png' });
                setEditRegionFile(regionFile);
                setEditIsRegionSaved(true);
            } else {
                console.error('Failed to generate region blob.');
                setEditIsRegionSaved(false);
                setEditRegionPreviewUrl(null);
            }
        }, 'image/png');
    };

    const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files);
            const totalFiles = imageFiles.length + newFiles.length;

            if (totalFiles > maxImages) {
                alert(`You can only select up to ${maxImages} images.`);
                const allowedNewFiles = newFiles.slice(0, maxImages - imageFiles.length);
                if (allowedNewFiles.length === 0) {
                    event.target.value = '';
                    return;
                }
                newFiles.splice(allowedNewFiles.length);
            }

            setImageFiles((prevFiles) => [...prevFiles, ...newFiles]);

            const newFilePromises = newFiles.map((file) => {
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(newFilePromises)
                .then((newUrls) => {
                    setSourceImagePreviewUrls((prevUrls) => [...prevUrls, ...newUrls]);
                })
                .catch((error) => {
                    console.error('Error reading new image files:', error);
                });

            event.target.value = '';
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setImageFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove));
        setSourceImagePreviewUrls((prevUrls) => prevUrls.filter((_, index) => index !== indexToRemove));
    };

    const handleRegionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !editOriginalImageSize) {
            event.target.value = '';
            return;
        }

        if (file.type !== 'image/png') {
            alert(`Invalid file type. Please upload a PNG file for the ${regionLabel.toLowerCase()}.`);
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            if (img.width !== editOriginalImageSize.width || img.height !== editOriginalImageSize.height) {
                alert(
                    `${regionLabel} dimensions (${img.width}x${img.height}) must match the source image dimensions (${editOriginalImageSize.width}x${editOriginalImageSize.height}).`
                );
                URL.revokeObjectURL(objectUrl);
                event.target.value = '';
                return;
            }

            setEditRegionFile(file);
            setEditIsRegionSaved(true);
            setEditDrawnPoints([]);

            reader.onloadend = () => {
                setEditRegionPreviewUrl(reader.result as string);
                URL.revokeObjectURL(objectUrl);
            };
            reader.onerror = () => {
                console.error('Error reading region file for preview.');
                setEditRegionPreviewUrl(null);
                URL.revokeObjectURL(objectUrl);
            };
            reader.readAsDataURL(file);

            event.target.value = '';
        };

        img.onerror = () => {
            alert(`Failed to load the uploaded ${regionLabel.toLowerCase()} image to check dimensions.`);
            URL.revokeObjectURL(objectUrl);
            event.target.value = '';
        };

        img.src = objectUrl;
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (imageFiles.length === 0) {
            alert('Please select at least one image to edit.');
            return;
        }
        if (editDrawnPoints.length > 0 && !editRegionFile && !editIsRegionSaved) {
            alert(`Please save the ${regionLabel.toLowerCase()} you have drawn before submitting.`);
            return;
        }
        if (customSizeInvalid) {
            return;
        }

        const formData: EditingFormData = {
            prompt: editPrompt,
            n: editN[0],
            size: editSize,
            customWidth: editCustomWidth,
            customHeight: editCustomHeight,
            quality: editQuality,
            output_format: editOutputFormat,
            background: editBackground,
            moderation: editModeration,
            imageFiles: imageFiles,
            model: editModel
        };
        if (showCompression) {
            formData.output_compression = editCompression[0];
        }
        onSubmit(formData);
    };

    const displayFileNames = (files: File[]) => {
        if (files.length === 0) return 'No file selected.';
        if (files.length === 1) return files[0].name;
        return `${files.length} files selected`;
    };

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex items-start justify-between border-b border-white/10 pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>Edit Image</CardTitle>
                        {isPasswordRequiredByBackend && (
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={onOpenPasswordDialog}
                                className='ml-2 text-white/60 hover:text-white'
                                aria-label='Configure Password'>
                                {clientPasswordHash ? <Lock className='h-4 w-4' /> : <LockOpen className='h-4 w-4' />}
                            </Button>
                        )}
                    </div>
                    <CardDescription className='mt-1 text-white/60'>
                        Modify an existing image with a text prompt.
                    </CardDescription>
                </div>
                <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4'>
                    <div className='space-y-1.5'>
                        <Label htmlFor='edit-model-select' className='text-white'>
                            Model
                        </Label>
                        <div className='flex items-center gap-4'>
                            <Select
                                value={editModel}
                                onValueChange={(value) => setEditModel(value as GptImageModel)}
                                disabled={isLoading}>
                                <SelectTrigger
                                    id='edit-model-select'
                                    className='w-[220px] rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                    <SelectValue placeholder='Select model' />
                                </SelectTrigger>
                                <SelectContent className='border-white/20 bg-black text-white'>
                                    {GPT_IMAGE_MODELS.map((id) => (
                                        <SelectItem key={id} value={id} className='focus:bg-white/10'>
                                            {id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className='flex items-center gap-2'>
                                        <Checkbox
                                            id='edit-enable-streaming'
                                            checked={streaming}
                                            onCheckedChange={(checked) => setEnableStreaming(!!checked)}
                                            disabled={isLoading || !!streamingBlockedReason}
                                            className='border-white/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black'
                                        />
                                        <Label
                                            htmlFor='edit-enable-streaming'
                                            className={`text-sm ${streamingBlockedReason ? 'cursor-not-allowed text-white/40' : 'cursor-pointer text-white/80'}`}>
                                            Enable Streaming
                                        </Label>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className='max-w-[250px]'>
                                    {streamingBlockedReason ??
                                        'Shows partial preview images as they are generated, providing a more interactive experience.'}
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {streaming && (
                        <div className='space-y-3'>
                            <div className='flex items-center gap-2'>
                                <Label className='text-white'>Preview Images</Label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className='h-4 w-4 cursor-help text-white/40 hover:text-white/60' />
                                    </TooltipTrigger>
                                    <TooltipContent className='max-w-[250px]'>
                                        Each preview image adds ~$0.003 to the cost (100 additional output tokens).
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <RadioGroup
                                value={String(partialImages)}
                                onValueChange={(value) => setPartialImages(Number(value) as 1 | 2 | 3)}
                                disabled={isLoading}
                                className='flex gap-x-5'>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='1'
                                        id='edit-partial-1'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='edit-partial-1' className='cursor-pointer text-white/80'>
                                        1
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='2'
                                        id='edit-partial-2'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='edit-partial-2' className='cursor-pointer text-white/80'>
                                        2
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='3'
                                        id='edit-partial-3'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='edit-partial-3' className='cursor-pointer text-white/80'>
                                        3
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}

                    <div className='space-y-1.5'>
                        <Label htmlFor='edit-prompt' className='text-white'>
                            Prompt
                        </Label>
                        <Textarea
                            id='edit-prompt'
                            placeholder='e.g., Add a party hat to the main subject'
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            required
                            disabled={isLoading}
                            className='min-h-[80px] rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                    </div>

                    <div className='space-y-2'>
                        <Label className='text-white'>Source Image(s) [Max: {maxImages}]</Label>
                        <Label
                            htmlFor='image-files-input'
                            className='flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-white/20 bg-black px-3 py-2 text-sm transition-colors hover:bg-white/5'>
                            <span className='truncate pr-2 text-white/60'>{displayFileNames(imageFiles)}</span>
                            <span className='flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/20'>
                                <Upload className='h-3 w-3' /> Browse...
                            </span>
                        </Label>
                        <Input
                            id='image-files-input'
                            type='file'
                            accept={EDIT_INPUT_FORMATS.map(getMimeType).join(', ')}
                            multiple
                            onChange={handleImageFileChange}
                            disabled={isLoading || imageFiles.length >= maxImages}
                            className='sr-only'
                        />
                        {sourceImagePreviewUrls.length > 0 && (
                            <div className='flex space-x-2 overflow-x-auto pt-2'>
                                {sourceImagePreviewUrls.map((url, index) => (
                                    <div key={url} className='relative shrink-0'>
                                        <Image
                                            src={url}
                                            alt={`Source preview ${index + 1}`}
                                            width={80}
                                            height={80}
                                            className='rounded border border-white/10 object-cover'
                                            unoptimized
                                        />
                                        <Button
                                            type='button'
                                            variant='destructive'
                                            size='icon'
                                            className='absolute top-0 right-0 h-5 w-5 translate-x-1/3 -translate-y-1/3 transform rounded-full bg-red-600 p-0.5 text-white hover:bg-red-700'
                                            onClick={() => handleRemoveImage(index)}
                                            aria-label={`Remove image ${index + 1}`}>
                                            <X className='h-3 w-3' />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>Mask or Markup</Label>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => setEditShowRegionEditor(!editShowRegionEditor)}
                            disabled={isLoading || !editOriginalImageSize}
                            className='w-full justify-start border-white/20 px-3 text-white/80 hover:bg-white/10 hover:text-white'>
                            {editShowRegionEditor
                                ? `Close ${regionLabel} Editor`
                                : editRegionFile
                                  ? `Edit Saved ${regionLabel}`
                                  : 'Create Mask or Markup'}
                            {editIsRegionSaved && !editShowRegionEditor && (
                                <span className='ml-auto text-xs text-green-400'>(Saved)</span>
                            )}
                            <ScanEye className='mt-0.5' />
                        </Button>

                        {editShowRegionEditor && firstImagePreviewUrl && editOriginalImageSize && (
                            <div className='space-y-3 rounded-md border border-white/20 bg-black p-3'>
                                <RadioGroup
                                    value={editRegionMode}
                                    onValueChange={handleRegionModeChange}
                                    disabled={isLoading}
                                    className='flex gap-x-5'>
                                    <div className='flex items-center space-x-2'>
                                        <RadioGroupItem
                                            value='mask'
                                            id='edit-region-mask'
                                            disabled={isGif}
                                            className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                        />
                                        <Label
                                            htmlFor='edit-region-mask'
                                            className={
                                                isGif
                                                    ? 'cursor-not-allowed text-white/40'
                                                    : 'cursor-pointer text-white/80'
                                            }>
                                            Mask
                                        </Label>
                                    </div>
                                    <div className='flex items-center space-x-2'>
                                        <RadioGroupItem
                                            value='markup'
                                            id='edit-region-markup'
                                            className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                        />
                                        <Label htmlFor='edit-region-markup' className='cursor-pointer text-white/80'>
                                            Markup
                                        </Label>
                                    </div>
                                </RadioGroup>
                                <p className='text-xs text-white/60'>
                                    {editRegionMode === 'markup'
                                        ? 'Circle or sketch on the image to show where the change goes, and describe the change in the prompt. Applies to the first image.'
                                        : 'Draw on the image below to mark areas for editing (drawn areas become transparent in the mask).'}
                                </p>
                                <div
                                    className='relative mx-auto w-full overflow-hidden rounded border border-white/10'
                                    style={{
                                        maxWidth: `min(100%, ${editOriginalImageSize.width}px)`,
                                        aspectRatio: `${editOriginalImageSize.width} / ${editOriginalImageSize.height}`
                                    }}>
                                    <Image
                                        src={firstImagePreviewUrl}
                                        alt='Image preview for drawing'
                                        width={editOriginalImageSize.width}
                                        height={editOriginalImageSize.height}
                                        className='block h-auto w-full'
                                        unoptimized
                                    />
                                    <canvas
                                        ref={canvasRef}
                                        width={editOriginalImageSize.width}
                                        height={editOriginalImageSize.height}
                                        className='absolute top-0 left-0 h-full w-full cursor-crosshair'
                                        onMouseDown={startDrawing}
                                        onMouseMove={drawLine}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={drawLine}
                                        onTouchEnd={stopDrawing}
                                    />
                                </div>
                                <div className='grid grid-cols-1 gap-4 pt-2'>
                                    <div className='space-y-2'>
                                        <Label htmlFor='brush-size-slider' className='text-sm text-white'>
                                            Brush Size: {editBrushSize[0]}px
                                        </Label>
                                        <Slider
                                            id='brush-size-slider'
                                            min={5}
                                            max={100}
                                            step={1}
                                            value={editBrushSize}
                                            onValueChange={setEditBrushSize}
                                            disabled={isLoading}
                                            className='mt-1 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                                        />
                                    </div>
                                </div>
                                <div className='flex items-center justify-between gap-2 pt-3'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() => regionInputRef.current?.click()}
                                        disabled={isLoading || !editOriginalImageSize}
                                        className='mr-auto border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                                        <UploadCloud className='mr-1.5 h-4 w-4' /> Upload {regionLabel}
                                    </Button>
                                    <Input
                                        ref={regionInputRef}
                                        id='region-file-input'
                                        type='file'
                                        accept='image/png'
                                        onChange={handleRegionFileChange}
                                        className='sr-only'
                                    />
                                    <div className='flex gap-2'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={handleClearRegion}
                                            disabled={isLoading}
                                            className='border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                                            <Eraser className='mr-1.5 h-4 w-4' /> Clear
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='default'
                                            size='sm'
                                            onClick={generateAndSaveRegion}
                                            disabled={isLoading || editDrawnPoints.length === 0}
                                            className='bg-white text-black hover:bg-white/90 disabled:opacity-50'>
                                            <Save className='mr-1.5 h-4 w-4' /> Save {regionLabel}
                                        </Button>
                                    </div>
                                </div>
                                {editRegionPreviewUrl && (
                                    <div className='mt-3 border-t border-white/10 pt-3 text-center'>
                                        <Label className='mb-1.5 block text-sm text-white'>
                                            Generated {regionLabel} Preview:
                                        </Label>
                                        <div className='inline-block rounded border border-gray-300 bg-white p-1'>
                                            <Image
                                                src={editRegionPreviewUrl}
                                                alt={`Generated ${regionLabel.toLowerCase()} preview`}
                                                width={0}
                                                height={134}
                                                className='block max-w-full'
                                                style={{ width: 'auto', height: '134px' }}
                                                unoptimized
                                            />
                                        </div>
                                    </div>
                                )}
                                {editIsRegionSaved && !editRegionPreviewUrl && (
                                    <p className='pt-1 text-center text-xs text-yellow-400'>
                                        Generating {regionLabel.toLowerCase()} preview...
                                    </p>
                                )}
                                {editIsRegionSaved && editRegionPreviewUrl && (
                                    <p className='pt-1 text-center text-xs text-green-400'>
                                        {regionLabel} saved successfully!
                                    </p>
                                )}
                            </div>
                        )}
                        {!editShowRegionEditor && editRegionFile && (
                            <p className='pt-1 text-xs text-green-400'>
                                {regionLabel} applied: {editRegionFile.name}
                            </p>
                        )}
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='edit-n-slider' className='text-white'>
                            Number of Images: {editN[0]}
                        </Label>
                        <Slider
                            id='edit-n-slider'
                            min={1}
                            max={10}
                            step={1}
                            value={editN}
                            onValueChange={setEditN}
                            disabled={isLoading}
                            className={SLIDER_CLASS}
                        />
                    </div>

                    <ImageOptions
                        mode='edit'
                        model={editModel}
                        disabled={isLoading}
                        size={editSize}
                        setSize={setEditSize}
                        customWidth={editCustomWidth}
                        setCustomWidth={setEditCustomWidth}
                        customHeight={editCustomHeight}
                        setCustomHeight={setEditCustomHeight}
                        sizeValidation={customSizeValidation}
                        quality={editQuality}
                        setQuality={setEditQuality}
                        complexity={editComplexity}
                        setComplexity={setEditComplexity}
                        background={editBackground}
                        setBackground={setEditBackground}
                        outputFormat={editOutputFormat}
                        setOutputFormat={setEditOutputFormat}
                        compression={editCompression}
                        setCompression={setEditCompression}
                        frameCount={editFrameCount}
                        setFrameCount={setEditFrameCount}
                        frameDurationMs={editFrameDurationMs}
                        setFrameDurationMs={setEditFrameDurationMs}
                        moderation={editModeration}
                        setModeration={setEditModeration}
                    />
                </CardContent>
                <CardFooter className='border-t border-white/10 p-4'>
                    <Button
                        type='submit'
                        disabled={isLoading || !editPrompt || imageFiles.length === 0 || customSizeInvalid}
                        className='flex w-full items-center justify-center gap-2 rounded-md bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                        {isLoading && <Loader2 className='h-4 w-4 animate-spin' />}
                        {isLoading ? 'Editing...' : 'Edit Image'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
