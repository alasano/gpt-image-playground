/** Models that can be selected for new generations and edits, in display order. */
export const GPT_IMAGE_MODELS = [
    'gpt-image-2.6-flare',
    'gpt-image-2.6-sunburst',
    'gpt-image-2.5-flare',
    'gpt-image-2.5-sunburst',
    'gpt-image-2'
] as const;
export type GptImageModel = (typeof GPT_IMAGE_MODELS)[number];
export const DEFAULT_GPT_IMAGE_MODEL: GptImageModel = 'gpt-image-2.6-flare';

/** Selectable models plus retired ones that may still appear in stored history. */
export type HistoryGptImageModel = GptImageModel | 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5';

export function isGptImageModel(value: unknown): value is GptImageModel {
    return (GPT_IMAGE_MODELS as readonly unknown[]).includes(value);
}

type ModelCapabilities = {
    /** Accepts the `xhigh` and `max` quality tiers. */
    extendedQuality: boolean;
    /** Accepts the `complexity` field. */
    complexity: boolean;
    /** Can return animated GIFs (generations and edits). */
    gif: boolean;
    /** Can return SVG (generations only). */
    svg: boolean;
};

const GPT_IMAGE_2_6: ModelCapabilities = { extendedQuality: true, complexity: true, gif: true, svg: true };
const GPT_IMAGE_2_5: ModelCapabilities = { extendedQuality: true, complexity: false, gif: false, svg: false };

// Markup-guided edits work on every selectable model, so they need no flag.
export const MODEL_CAPABILITIES: Record<GptImageModel, ModelCapabilities> = {
    'gpt-image-2.6-flare': GPT_IMAGE_2_6,
    'gpt-image-2.6-sunburst': GPT_IMAGE_2_6,
    'gpt-image-2.5-flare': GPT_IMAGE_2_5,
    'gpt-image-2.5-sunburst': GPT_IMAGE_2_5,
    'gpt-image-2': { extendedQuality: false, complexity: false, gif: false, svg: false }
};

export type ImageMode = 'generate' | 'edit';
export type ImageQuality = 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export const EXTENDED_QUALITIES: readonly ImageQuality[] = ['xhigh', 'max'];
export type ImageComplexity = 'low' | 'medium' | 'high';
/** The API's default when `complexity` is omitted. */
export const DEFAULT_COMPLEXITY: ImageComplexity = 'high';

export type ImageBackground = 'auto' | 'opaque' | 'transparent';
export const IMAGE_OUTPUT_FORMATS = ['png', 'jpeg', 'webp', 'gif', 'svg'] as const;
export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number];
export type ImageModeration = 'auto' | 'low';

export function getAvailableOutputFormats(model: GptImageModel, mode: ImageMode): ImageOutputFormat[] {
    const { gif, svg } = MODEL_CAPABILITIES[model];
    return IMAGE_OUTPUT_FORMATS.filter(
        (format) => (format !== 'gif' || gif) && (format !== 'svg' || (svg && mode === 'generate'))
    );
}

/** Formats the edits endpoint accepts as input images. */
export const EDIT_INPUT_FORMATS: readonly ImageOutputFormat[] = ['png', 'jpeg', 'webp'];

export function getMimeType(format: ImageOutputFormat): string {
    return format === 'svg' ? 'image/svg+xml' : `image/${format}`;
}

/** Why streaming is unavailable for a request, or null when it is allowed. */
export function getStreamingBlockedReason(n: number, format: ImageOutputFormat): string | null {
    if (n > 1) return 'Streaming is only supported when generating a single image (n=1).';
    if (format === 'gif' || format === 'svg') return `Streaming is not supported for ${format.toUpperCase()} output.`;
    return null;
}

export const GIF_FRAME_COUNT = { min: 2, max: 16, default: 9 } as const;
export const GIF_FRAME_DURATION_MS = { min: 20, max: 2000, step: 10, default: 200 } as const;

/** Chat models offered for writing SVG output, with the reasoning efforts each accepts. */
export const SVG_WRITER_MODELS = {
    'gpt-6.1-sol': ['low', 'medium', 'high', 'xhigh', 'max'],
    'gpt-6-astra': ['low', 'medium', 'high', 'xhigh', 'max'],
    'gpt-6.1-terra': ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
    'gpt-6-luna': ['none', 'low', 'medium', 'high', 'xhigh', 'max']
} as const;
export type SvgWriterModel = keyof typeof SVG_WRITER_MODELS;
export type SvgReasoningEffort = (typeof SVG_WRITER_MODELS)[SvgWriterModel][number];
export const DEFAULT_SVG_WRITER_MODEL: SvgWriterModel = 'gpt-6.1-sol';

/** Maximum source images per edit request for GPT Image models. */
export const MAX_EDIT_IMAGES = 16;
