'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    EXTENDED_QUALITIES,
    GIF_FRAME_COUNT,
    GIF_FRAME_DURATION_MS,
    MODEL_CAPABILITIES,
    SVG_WRITER_MODELS,
    getAvailableOutputFormats,
    type GptImageModel,
    type ImageBackground,
    type ImageComplexity,
    type ImageMode,
    type ImageModeration,
    type ImageOutputFormat,
    type ImageQuality,
    type SvgReasoningEffort,
    type SvgWriterModel
} from '@/lib/models';
import {
    CUSTOM_SIZE_EDGE_MULTIPLE,
    CUSTOM_SIZE_MAX_ASPECT,
    CUSTOM_SIZE_MAX_EDGE,
    CUSTOM_SIZE_MAX_PIXELS,
    CUSTOM_SIZE_MIN_PIXELS,
    GIF_MAX_REQUEST_PIXELS,
    getGifSheetGrids,
    getPresetTooltip,
    type SizePreset,
    type SizeValidation
} from '@/lib/size-utils';
import {
    Brain,
    BrickWall,
    Eraser,
    FileImage,
    Film,
    PenTool,
    RectangleHorizontal,
    RectangleVertical,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Square,
    SquareDashed,
    Tally1,
    Tally2,
    Tally3,
    Tally4,
    Tally5
} from 'lucide-react';
import * as React from 'react';

/** SVG writer settings; only the generate form has them, since edits can't return SVG. */
export type SvgOptions = {
    model: SvgWriterModel;
    setModel: React.Dispatch<React.SetStateAction<SvgWriterModel>>;
    /** `null` leaves the effort to the writer model's default. */
    effort: SvgReasoningEffort | null;
    setEffort: React.Dispatch<React.SetStateAction<SvgReasoningEffort | null>>;
};

type ImageOptionsProps = {
    /** Also prefixes every element id, so the generate and edit forms (both mounted) never share an id. */
    mode: ImageMode;
    model: GptImageModel;
    disabled: boolean;
    size: SizePreset;
    setSize: React.Dispatch<React.SetStateAction<SizePreset>>;
    customWidth: number;
    setCustomWidth: React.Dispatch<React.SetStateAction<number>>;
    customHeight: number;
    setCustomHeight: React.Dispatch<React.SetStateAction<number>>;
    sizeValidation: SizeValidation;
    quality: ImageQuality;
    setQuality: React.Dispatch<React.SetStateAction<ImageQuality>>;
    complexity: ImageComplexity;
    setComplexity: React.Dispatch<React.SetStateAction<ImageComplexity>>;
    background: ImageBackground;
    setBackground: React.Dispatch<React.SetStateAction<ImageBackground>>;
    outputFormat: ImageOutputFormat;
    setOutputFormat: React.Dispatch<React.SetStateAction<ImageOutputFormat>>;
    compression: number[];
    setCompression: React.Dispatch<React.SetStateAction<number[]>>;
    frameCount: number;
    setFrameCount: React.Dispatch<React.SetStateAction<number>>;
    frameDurationMs: number;
    setFrameDurationMs: React.Dispatch<React.SetStateAction<number>>;
    svg?: SvgOptions;
    moderation: ImageModeration;
    setModeration: React.Dispatch<React.SetStateAction<ImageModeration>>;
};

const RadioItemWithIcon = ({
    value,
    id,
    label,
    Icon
}: {
    value: string;
    id: string;
    label: string;
    Icon: React.ElementType;
}) => (
    <div className='flex items-center space-x-2'>
        <RadioGroupItem
            value={value}
            id={id}
            className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
        />
        <Label htmlFor={id} className='flex cursor-pointer items-center gap-2 text-base text-white/80'>
            <Icon className='h-5 w-5 text-white/60' />
            {label}
        </Label>
    </div>
);

const SIZE_PRESETS: { value: SizePreset; label: string; Icon: React.ElementType }[] = [
    { value: 'square', label: 'Square', Icon: Square },
    { value: 'landscape', label: 'Landscape', Icon: RectangleHorizontal },
    { value: 'portrait', label: 'Portrait', Icon: RectangleVertical }
];

const FORMAT_OPTIONS: Record<ImageOutputFormat, { label: string; Icon: React.ElementType }> = {
    png: { label: 'PNG', Icon: FileImage },
    jpeg: { label: 'JPEG', Icon: FileImage },
    webp: { label: 'WebP', Icon: FileImage },
    gif: { label: 'GIF', Icon: Film },
    svg: { label: 'SVG', Icon: PenTool }
};

export const SLIDER_CLASS =
    'mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white';

export function ImageOptions({
    mode,
    model,
    disabled,
    size,
    setSize,
    customWidth,
    setCustomWidth,
    customHeight,
    setCustomHeight,
    sizeValidation,
    quality,
    setQuality,
    complexity,
    setComplexity,
    background,
    setBackground,
    outputFormat,
    setOutputFormat,
    compression,
    setCompression,
    frameCount,
    setFrameCount,
    frameDurationMs,
    setFrameDurationMs,
    svg,
    moderation,
    setModeration
}: ImageOptionsProps) {
    const id = (suffix: string) => `${mode}-${suffix}`;
    const capabilities = MODEL_CAPABILITIES[model];
    const availableFormats = getAvailableOutputFormats(model, mode);
    const formatAvailable = availableFormats.includes(outputFormat);
    const isGif = outputFormat === 'gif';
    const showCompression = outputFormat === 'jpeg' || outputFormat === 'webp';

    // Reset options the newly selected model rejects.
    React.useEffect(() => {
        if (!capabilities.extendedQuality && EXTENDED_QUALITIES.includes(quality)) {
            setQuality('auto');
        }
    }, [capabilities.extendedQuality, quality, setQuality]);
    React.useEffect(() => {
        if (!formatAvailable) {
            setOutputFormat('png');
        }
    }, [formatAvailable, setOutputFormat]);

    const handleOutputFormatChange = (value: string) => {
        const format = value as ImageOutputFormat;
        setOutputFormat(format);
        // The fixed presets are far larger than any GIF frame can be.
        if (format === 'gif' && size !== 'auto' && size !== 'custom') {
            setSize('auto');
        }
    };

    const loopSeconds = (frameCount * frameDurationMs) / 1000;
    // GIF frames only need the tiled sheet's edges to be multiples of 16, so some finer sizes fit (520px in a
    // 4×4 sheet); the sheet validation reports which.
    const sizeStep = isGif ? CUSTOM_SIZE_EDGE_MULTIPLE / 4 : CUSTOM_SIZE_EDGE_MULTIPLE;

    return (
        <>
            <div className='space-y-3'>
                <Label className='block text-white'>{isGif ? 'Frame Size' : 'Size'}</Label>
                <RadioGroup
                    value={size}
                    onValueChange={(value) => setSize(value as SizePreset)}
                    disabled={disabled}
                    className='flex flex-wrap gap-x-5 gap-y-3'>
                    <RadioItemWithIcon value='auto' id={id('size-auto')} label='Auto' Icon={Sparkles} />
                    <RadioItemWithIcon value='custom' id={id('size-custom')} label='Custom' Icon={SquareDashed} />
                    {!isGif &&
                        SIZE_PRESETS.map(({ value, label, Icon }) => (
                            <Tooltip key={value}>
                                <TooltipTrigger asChild>
                                    <div>
                                        <RadioItemWithIcon
                                            value={value}
                                            id={id(`size-${value}`)}
                                            label={label}
                                            Icon={Icon}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>{getPresetTooltip(value)}</TooltipContent>
                            </Tooltip>
                        ))}
                </RadioGroup>
                {size === 'custom' && (
                    <div className='space-y-2 rounded-md border border-white/10 bg-white/5 p-3'>
                        <div className='flex items-center gap-3'>
                            <div className='flex-1 space-y-1'>
                                <Label htmlFor={id('custom-width')} className='text-xs text-white/70'>
                                    Width (px)
                                </Label>
                                <Input
                                    id={id('custom-width')}
                                    type='number'
                                    min={CUSTOM_SIZE_EDGE_MULTIPLE}
                                    max={CUSTOM_SIZE_MAX_EDGE}
                                    step={sizeStep}
                                    value={customWidth}
                                    onChange={(e) => setCustomWidth(parseInt(e.target.value, 10) || 0)}
                                    disabled={disabled}
                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'
                                />
                            </div>
                            <span className='pt-5 text-white/60'>×</span>
                            <div className='flex-1 space-y-1'>
                                <Label htmlFor={id('custom-height')} className='text-xs text-white/70'>
                                    Height (px)
                                </Label>
                                <Input
                                    id={id('custom-height')}
                                    type='number'
                                    min={CUSTOM_SIZE_EDGE_MULTIPLE}
                                    max={CUSTOM_SIZE_MAX_EDGE}
                                    step={sizeStep}
                                    value={customHeight}
                                    onChange={(e) => setCustomHeight(parseInt(e.target.value, 10) || 0)}
                                    disabled={disabled}
                                    className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'
                                />
                            </div>
                        </div>
                        {isGif ? (
                            <p className='text-xs text-white/50'>
                                {frameCount} frames are rendered tiled into one{' '}
                                {getGifSheetGrids(frameCount)
                                    .map(([columns, rows]) => `${columns}×${rows}`)
                                    .join(' or ')}{' '}
                                sheet. The sheet must meet the limits below, and the number of images × sheet pixels
                                must stay within {GIF_MAX_REQUEST_PIXELS.toLocaleString()}.
                            </p>
                        ) : (
                            <p className='text-xs text-white/50'>
                                {(customWidth * customHeight).toLocaleString()} pixels (
                                {(((customWidth * customHeight) / CUSTOM_SIZE_MAX_PIXELS) * 100).toFixed(1)}% of max) ·{' '}
                                {customWidth > 0 && customHeight > 0
                                    ? `${(Math.max(customWidth, customHeight) / Math.min(customWidth, customHeight)).toFixed(2)}:1 ratio`
                                    : '—'}
                            </p>
                        )}
                        {!sizeValidation.valid && <p className='text-xs text-red-400'>{sizeValidation.reason}</p>}
                        <p className='text-xs text-white/40'>
                            Constraints: multiples of {CUSTOM_SIZE_EDGE_MULTIPLE}, max edge {CUSTOM_SIZE_MAX_EDGE}px,
                            aspect ratio ≤ {CUSTOM_SIZE_MAX_ASPECT}:1, {CUSTOM_SIZE_MIN_PIXELS.toLocaleString()} to{' '}
                            {CUSTOM_SIZE_MAX_PIXELS.toLocaleString()} total pixels.
                        </p>
                    </div>
                )}
            </div>

            <div className='space-y-3'>
                <Label className='block text-white'>Quality</Label>
                <RadioGroup
                    value={quality}
                    onValueChange={(value) => setQuality(value as ImageQuality)}
                    disabled={disabled}
                    className='flex flex-wrap gap-x-5 gap-y-3'>
                    <RadioItemWithIcon value='auto' id={id('quality-auto')} label='Auto' Icon={Sparkles} />
                    <RadioItemWithIcon value='low' id={id('quality-low')} label='Low' Icon={Tally1} />
                    <RadioItemWithIcon value='medium' id={id('quality-medium')} label='Medium' Icon={Tally2} />
                    <RadioItemWithIcon value='high' id={id('quality-high')} label='High' Icon={Tally3} />
                    {capabilities.extendedQuality && (
                        <>
                            <RadioItemWithIcon value='xhigh' id={id('quality-xhigh')} label='XHigh' Icon={Tally4} />
                            <RadioItemWithIcon value='max' id={id('quality-max')} label='Max' Icon={Tally5} />
                        </>
                    )}
                </RadioGroup>
            </div>

            {capabilities.complexity && (
                <div className='space-y-3'>
                    <Label className='block text-white'>Complexity</Label>
                    <RadioGroup
                        value={complexity}
                        onValueChange={(value) => setComplexity(value as ImageComplexity)}
                        disabled={disabled}
                        className='flex flex-wrap gap-x-5 gap-y-3'>
                        <RadioItemWithIcon value='low' id={id('complexity-low')} label='Low' Icon={Tally1} />
                        <RadioItemWithIcon value='medium' id={id('complexity-medium')} label='Medium' Icon={Tally2} />
                        <RadioItemWithIcon value='high' id={id('complexity-high')} label='High' Icon={Tally3} />
                    </RadioGroup>
                    <p className='text-xs text-white/40'>
                        How much the model plans before rendering. Lower suits focused edits; higher helps dense text
                        and complex layouts.
                    </p>
                </div>
            )}

            <div className='space-y-3'>
                <Label className='block text-white'>Background</Label>
                <RadioGroup
                    value={background}
                    onValueChange={(value) => setBackground(value as ImageBackground)}
                    disabled={disabled}
                    className='flex flex-wrap gap-x-5 gap-y-3'>
                    <RadioItemWithIcon value='auto' id={id('bg-auto')} label='Auto' Icon={Sparkles} />
                    <RadioItemWithIcon value='opaque' id={id('bg-opaque')} label='Opaque' Icon={BrickWall} />
                    <RadioItemWithIcon
                        value='transparent'
                        id={id('bg-transparent')}
                        label='Transparent'
                        Icon={Eraser}
                    />
                </RadioGroup>
            </div>

            <div className='space-y-3'>
                <Label className='block text-white'>Output Format</Label>
                <RadioGroup
                    value={outputFormat}
                    onValueChange={handleOutputFormatChange}
                    disabled={disabled}
                    className='flex flex-wrap gap-x-5 gap-y-3'>
                    {availableFormats.map((format) => (
                        <RadioItemWithIcon
                            key={format}
                            value={format}
                            id={id(`format-${format}`)}
                            label={FORMAT_OPTIONS[format].label}
                            Icon={FORMAT_OPTIONS[format].Icon}
                        />
                    ))}
                </RadioGroup>
            </div>

            {showCompression && (
                <div className='space-y-2 pt-2 transition-opacity duration-300'>
                    <Label htmlFor={id('compression-slider')} className='text-white'>
                        Compression: {compression[0]}%
                    </Label>
                    <Slider
                        id={id('compression-slider')}
                        min={0}
                        max={100}
                        step={1}
                        value={compression}
                        onValueChange={setCompression}
                        disabled={disabled}
                        className={SLIDER_CLASS}
                    />
                </div>
            )}

            {isGif && (
                <div className='space-y-4 rounded-md border border-white/10 bg-white/5 p-3'>
                    <div className='space-y-2'>
                        <Label htmlFor={id('frame-count-slider')} className='text-white'>
                            Frames: {frameCount}
                        </Label>
                        <Slider
                            id={id('frame-count-slider')}
                            min={GIF_FRAME_COUNT.min}
                            max={GIF_FRAME_COUNT.max}
                            step={1}
                            value={[frameCount]}
                            onValueChange={([value]) => setFrameCount(value)}
                            disabled={disabled}
                            className={SLIDER_CLASS}
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={id('frame-duration-slider')} className='text-white'>
                            Frame Duration: {frameDurationMs} ms
                        </Label>
                        <Slider
                            id={id('frame-duration-slider')}
                            min={GIF_FRAME_DURATION_MS.min}
                            max={GIF_FRAME_DURATION_MS.max}
                            step={GIF_FRAME_DURATION_MS.step}
                            value={[frameDurationMs]}
                            onValueChange={([value]) => setFrameDurationMs(value)}
                            disabled={disabled}
                            className={SLIDER_CLASS}
                        />
                    </div>
                    <p className='text-xs text-white/50'>
                        {loopSeconds.toFixed(2)}s loop at {(1000 / frameDurationMs).toFixed(1)} fps. Describe the motion
                        and how it loops in the prompt.
                    </p>
                </div>
            )}

            {outputFormat === 'svg' && svg && (
                <div className='space-y-4 rounded-md border border-white/10 bg-white/5 p-3'>
                    <div className='space-y-1.5'>
                        <Label htmlFor={id('svg-model-select')} className='text-white'>
                            SVG Writer Model
                        </Label>
                        <Select
                            value={svg.model}
                            onValueChange={(value) => {
                                const writer = value as SvgWriterModel;
                                svg.setModel(writer);
                                // Keep the effort only if the new writer accepts it.
                                if (
                                    svg.effort &&
                                    !(SVG_WRITER_MODELS[writer] as readonly SvgReasoningEffort[]).includes(svg.effort)
                                ) {
                                    svg.setEffort(null);
                                }
                            }}
                            disabled={disabled}>
                            <SelectTrigger
                                id={id('svg-model-select')}
                                className='w-[220px] rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className='border-white/20 bg-black text-white'>
                                {(Object.keys(SVG_WRITER_MODELS) as SvgWriterModel[]).map((writer) => (
                                    <SelectItem key={writer} value={writer} className='focus:bg-white/10'>
                                        {writer}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className='space-y-3'>
                        <Label className='block text-white'>Writer Reasoning</Label>
                        <RadioGroup
                            value={svg.effort ?? 'default'}
                            onValueChange={(value) =>
                                svg.setEffort(value === 'default' ? null : (value as SvgReasoningEffort))
                            }
                            disabled={disabled}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon
                                value='default'
                                id={id('svg-effort-default')}
                                label='Default'
                                Icon={Sparkles}
                            />
                            {SVG_WRITER_MODELS[svg.model].map((effort) => (
                                <RadioItemWithIcon
                                    key={effort}
                                    value={effort}
                                    id={id(`svg-effort-${effort}`)}
                                    label={effort}
                                    Icon={Brain}
                                />
                            ))}
                        </RadioGroup>
                    </div>
                    <p className='text-xs text-white/50'>
                        The image model draws a reference image; the writer model turns it into SVG. Quality and
                        complexity apply to the reference image. One image per request.
                    </p>
                </div>
            )}

            <div className='space-y-3'>
                <Label className='block text-white'>Moderation Level</Label>
                <RadioGroup
                    value={moderation}
                    onValueChange={(value) => setModeration(value as ImageModeration)}
                    disabled={disabled}
                    className='flex flex-wrap gap-x-5 gap-y-3'>
                    <RadioItemWithIcon value='auto' id={id('mod-auto')} label='Auto' Icon={ShieldCheck} />
                    <RadioItemWithIcon value='low' id={id('mod-low')} label='Low' Icon={ShieldAlert} />
                </RadioGroup>
            </div>
        </>
    );
}
