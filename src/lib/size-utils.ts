import type { ImageOutputFormat } from '@/lib/models';

export type SizeValidation = { valid: true } | { valid: false; reason: string };

export const CUSTOM_SIZE_MIN_PIXELS = 655_360;
export const CUSTOM_SIZE_MAX_PIXELS = 8_294_400;
export const CUSTOM_SIZE_MAX_EDGE = 3840;
export const CUSTOM_SIZE_EDGE_MULTIPLE = 16;
export const CUSTOM_SIZE_MAX_ASPECT = 3;

function validateCustomSize(width: number, height: number): SizeValidation {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return { valid: false, reason: 'Width and height must be positive numbers.' };
    }
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return { valid: false, reason: 'Width and height must be whole numbers.' };
    }
    if (width % CUSTOM_SIZE_EDGE_MULTIPLE !== 0 || height % CUSTOM_SIZE_EDGE_MULTIPLE !== 0) {
        return { valid: false, reason: `Both edges must be multiples of ${CUSTOM_SIZE_EDGE_MULTIPLE}.` };
    }
    if (width > CUSTOM_SIZE_MAX_EDGE || height > CUSTOM_SIZE_MAX_EDGE) {
        return { valid: false, reason: `Maximum edge is ${CUSTOM_SIZE_MAX_EDGE}px.` };
    }
    const long = Math.max(width, height);
    const short = Math.min(width, height);
    if (long / short > CUSTOM_SIZE_MAX_ASPECT) {
        return { valid: false, reason: `Aspect ratio (long:short) must be ≤ ${CUSTOM_SIZE_MAX_ASPECT}:1.` };
    }
    const pixels = width * height;
    if (pixels < CUSTOM_SIZE_MIN_PIXELS) {
        return { valid: false, reason: `Total pixels must be at least ${CUSTOM_SIZE_MIN_PIXELS.toLocaleString()}.` };
    }
    if (pixels > CUSTOM_SIZE_MAX_PIXELS) {
        return {
            valid: false,
            reason: `Total pixels must be no more than ${CUSTOM_SIZE_MAX_PIXELS.toLocaleString()}.`
        };
    }
    return { valid: true };
}

/** Upper bound on n × GIF sheet pixels per request. */
export const GIF_MAX_REQUEST_PIXELS = 16_777_216;

/**
 * The API renders GIF frames tiled into one sheet image, choosing among these grids (columns × rows) by frame
 * count. Measured against the API; the limits are not documented.
 */
export function getGifSheetGrids(frameCount: number): [columns: number, rows: number][] {
    if (frameCount <= 8)
        return [
            [4, 2],
            [2, 4]
        ];
    if (frameCount === 9) return [[3, 3]];
    return [[4, 4]];
}

/**
 * A custom GIF frame size is valid when one sheet grid passes the still-image size rules and n copies of that
 * sheet fit the request pixel budget.
 */
function validateGifFrameSize(width: number, height: number, frameCount: number, n: number): SizeValidation {
    let firstFailure: SizeValidation | undefined;
    for (const [columns, rows] of getGifSheetGrids(frameCount)) {
        const sheetWidth = width * columns;
        const sheetHeight = height * rows;
        const result = validateCustomSize(sheetWidth, sheetHeight);
        if (result.valid) {
            return n * sheetWidth * sheetHeight > GIF_MAX_REQUEST_PIXELS
                ? {
                      valid: false,
                      reason: `${n} GIFs exceed the request pixel budget. Reduce the frame size, frame count, or number of images.`
                  }
                : result;
        }
        firstFailure ??= {
            valid: false,
            reason: `${frameCount} frames are tiled into a ${sheetWidth}×${sheetHeight} sheet: ${result.reason}`
        };
    }
    return firstFailure!; // getGifSheetGrids always returns at least one grid
}

export type SizePreset = 'auto' | 'custom' | 'square' | 'landscape' | 'portrait';

/** Presets and `auto` are always valid; a custom size is checked as a still image or as GIF frames. */
export function validateSizeSelection(
    size: SizePreset,
    width: number,
    height: number,
    outputFormat: ImageOutputFormat,
    frameCount: number,
    n: number
): SizeValidation {
    if (size !== 'custom') return { valid: true };
    return outputFormat === 'gif'
        ? validateGifFrameSize(width, height, frameCount, n)
        : validateCustomSize(width, height);
}

const PRESET_DIMENSIONS: Record<Exclude<SizePreset, 'auto' | 'custom'>, string> = {
    square: '2048x2048',
    landscape: '3072x2048',
    portrait: '2048x3072'
};

/**
 * Returns the concrete WxH string for a preset.
 * Returns null for 'auto' (let the API pick) and 'custom' (caller provides WxH).
 */
export function getPresetDimensions(preset: SizePreset): string | null {
    if (preset === 'auto' || preset === 'custom') return null;
    return PRESET_DIMENSIONS[preset];
}

/**
 * Human-readable dimension info for tooltips.
 */
export function getPresetTooltip(preset: SizePreset): string | null {
    const dims = getPresetDimensions(preset);
    if (!dims) return null;
    const [w, h] = dims.split('x').map(Number);
    const mp = ((w * h) / 1_000_000).toFixed(1);
    const ratio = preset === 'square' ? '1:1' : preset === 'landscape' ? '3:2' : '2:3';
    return `${w} × ${h} · ${ratio} · ${mp} MP`;
}
