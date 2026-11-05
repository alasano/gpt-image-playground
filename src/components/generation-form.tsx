'use client';

import { ImageOptions, SLIDER_CLASS, type SvgOptions } from '@/components/image-options';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    GPT_IMAGE_MODELS,
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
import { HelpCircle, Loader2, Lock, LockOpen } from 'lucide-react';
import * as React from 'react';

export type GenerationFormData = {
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
    model: GptImageModel;
};

type GenerationFormProps = {
    onSubmit: (data: GenerationFormData) => void;
    isLoading: boolean;
    currentMode: ImageMode;
    onModeChange: (mode: ImageMode) => void;
    isPasswordRequiredByBackend: boolean | null;
    clientPasswordHash: string | null;
    onOpenPasswordDialog: () => void;
    model: GenerationFormData['model'];
    setModel: React.Dispatch<React.SetStateAction<GenerationFormData['model']>>;
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
    n: number[];
    setN: React.Dispatch<React.SetStateAction<number[]>>;
    size: GenerationFormData['size'];
    setSize: React.Dispatch<React.SetStateAction<GenerationFormData['size']>>;
    customWidth: number;
    setCustomWidth: React.Dispatch<React.SetStateAction<number>>;
    customHeight: number;
    setCustomHeight: React.Dispatch<React.SetStateAction<number>>;
    quality: GenerationFormData['quality'];
    setQuality: React.Dispatch<React.SetStateAction<GenerationFormData['quality']>>;
    complexity: ImageComplexity;
    setComplexity: React.Dispatch<React.SetStateAction<ImageComplexity>>;
    outputFormat: GenerationFormData['output_format'];
    setOutputFormat: React.Dispatch<React.SetStateAction<GenerationFormData['output_format']>>;
    compression: number[];
    setCompression: React.Dispatch<React.SetStateAction<number[]>>;
    frameCount: number;
    setFrameCount: React.Dispatch<React.SetStateAction<number>>;
    frameDurationMs: number;
    setFrameDurationMs: React.Dispatch<React.SetStateAction<number>>;
    svg: SvgOptions;
    background: GenerationFormData['background'];
    setBackground: React.Dispatch<React.SetStateAction<GenerationFormData['background']>>;
    moderation: GenerationFormData['moderation'];
    setModeration: React.Dispatch<React.SetStateAction<GenerationFormData['moderation']>>;
    enableStreaming: boolean;
    setEnableStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    partialImages: 1 | 2 | 3;
    setPartialImages: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
};

export function GenerationForm({
    onSubmit,
    isLoading,
    currentMode,
    onModeChange,
    isPasswordRequiredByBackend,
    clientPasswordHash,
    onOpenPasswordDialog,
    model,
    setModel,
    prompt,
    setPrompt,
    n,
    setN,
    size,
    setSize,
    customWidth,
    setCustomWidth,
    customHeight,
    setCustomHeight,
    quality,
    setQuality,
    complexity,
    setComplexity,
    outputFormat,
    setOutputFormat,
    compression,
    setCompression,
    frameCount,
    setFrameCount,
    frameDurationMs,
    setFrameDurationMs,
    svg,
    background,
    setBackground,
    moderation,
    setModeration,
    enableStreaming,
    setEnableStreaming,
    partialImages,
    setPartialImages
}: GenerationFormProps) {
    const showCompression = outputFormat === 'jpeg' || outputFormat === 'webp';
    const customSizeValidation = validateSizeSelection(size, customWidth, customHeight, outputFormat, frameCount, n[0]);
    const customSizeInvalid = !customSizeValidation.valid;
    const streamingBlockedReason = getStreamingBlockedReason(n[0], outputFormat);
    const streaming = enableStreaming && !streamingBlockedReason;
    const isSvg = outputFormat === 'svg';

    // SVG output is limited to one image per request.
    React.useEffect(() => {
        if (isSvg && n[0] !== 1) {
            setN([1]);
        }
    }, [isSvg, n, setN]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (customSizeInvalid) {
            return;
        }
        const formData: GenerationFormData = {
            prompt,
            n: n[0],
            size,
            customWidth,
            customHeight,
            quality,
            output_format: outputFormat,
            background,
            moderation,
            model
        };
        if (showCompression) {
            formData.output_compression = compression[0];
        }
        onSubmit(formData);
    };

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex items-start justify-between border-b border-white/10 pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>Generate Image</CardTitle>
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
                        Create a new image from a text prompt.
                    </CardDescription>
                </div>
                <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4'>
                    <div className='space-y-1.5'>
                        <Label htmlFor='model-select' className='text-white'>
                            Model
                        </Label>
                        <div className='flex items-center gap-4'>
                            <Select
                                value={model}
                                onValueChange={(value) => setModel(value as GptImageModel)}
                                disabled={isLoading}>
                                <SelectTrigger
                                    id='model-select'
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
                                            id='enable-streaming'
                                            checked={streaming}
                                            onCheckedChange={(checked) => setEnableStreaming(!!checked)}
                                            disabled={isLoading || !!streamingBlockedReason}
                                            className='border-white/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black'
                                        />
                                        <Label
                                            htmlFor='enable-streaming'
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
                                        id='partial-1'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='partial-1' className='cursor-pointer text-white/80'>
                                        1
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='2'
                                        id='partial-2'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='partial-2' className='cursor-pointer text-white/80'>
                                        2
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='3'
                                        id='partial-3'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='partial-3' className='cursor-pointer text-white/80'>
                                        3
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}

                    <div className='space-y-1.5'>
                        <Label htmlFor='prompt' className='text-white'>
                            Prompt
                        </Label>
                        <Textarea
                            id='prompt'
                            placeholder='e.g., A photorealistic cat astronaut floating in space'
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            required
                            disabled={isLoading}
                            className='min-h-[80px] rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='n-slider' className='text-white'>
                            Number of Images: {n[0]}
                        </Label>
                        <Slider
                            id='n-slider'
                            min={1}
                            max={10}
                            step={1}
                            value={n}
                            onValueChange={setN}
                            disabled={isLoading || isSvg}
                            className={SLIDER_CLASS}
                        />
                    </div>

                    <ImageOptions
                        mode='generate'
                        model={model}
                        disabled={isLoading}
                        size={size}
                        setSize={setSize}
                        customWidth={customWidth}
                        setCustomWidth={setCustomWidth}
                        customHeight={customHeight}
                        setCustomHeight={setCustomHeight}
                        sizeValidation={customSizeValidation}
                        quality={quality}
                        setQuality={setQuality}
                        complexity={complexity}
                        setComplexity={setComplexity}
                        background={background}
                        setBackground={setBackground}
                        outputFormat={outputFormat}
                        setOutputFormat={setOutputFormat}
                        compression={compression}
                        setCompression={setCompression}
                        frameCount={frameCount}
                        setFrameCount={setFrameCount}
                        frameDurationMs={frameDurationMs}
                        setFrameDurationMs={setFrameDurationMs}
                        svg={svg}
                        moderation={moderation}
                        setModeration={setModeration}
                    />
                </CardContent>
                <CardFooter className='border-t border-white/10 p-4'>
                    <Button
                        type='submit'
                        disabled={isLoading || !prompt || customSizeInvalid}
                        className='flex w-full items-center justify-center gap-2 rounded-md bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                        {isLoading && <Loader2 className='h-4 w-4 animate-spin' />}
                        {isLoading ? 'Generating...' : 'Generate'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
