'use client';

import type { HistoryMetadata } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import { getModelRates, getSvgWriterRates, tokensToUsd, type ModelRates } from '@/lib/cost-utils';
import { GPT_IMAGE_MODELS, type GptImageModel } from '@/lib/models';
import { cn } from '@/lib/utils';
import {
    Copy,
    Check,
    Layers,
    DollarSign,
    Pencil,
    Sparkles as SparklesIcon,
    HardDrive,
    Database,
    FileImage,
    Trash2
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type HistoryPanelProps = {
    history: HistoryMetadata[];
    onSelectImage: (item: HistoryMetadata) => void;
    onClearHistory: () => void;
    getImageSrc: (filename: string) => string | undefined;
    onDeleteItemRequest: (item: HistoryMetadata) => void;
    itemPendingDeleteConfirmation: HistoryMetadata | null;
    onConfirmDeletion: () => void;
    onCancelDeletion: () => void;
    deletePreferenceDialogValue: boolean;
    onDeletePreferenceDialogChange: (isChecked: boolean) => void;
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
};

const formatUsd = (tokens: number, perMillion: number): string => tokensToUsd(tokens, perMillion).toFixed(4);

// Selectable models grouped by identical pricing, for the total-cost summary.
const RATE_GROUPS = GPT_IMAGE_MODELS.reduce<{ rates: ModelRates; models: GptImageModel[] }[]>((groups, model) => {
    const rates = getModelRates(model);
    const group = groups.find(
        (g) =>
            g.rates.textInputPerMillion === rates.textInputPerMillion &&
            g.rates.imageInputPerMillion === rates.imageInputPerMillion &&
            g.rates.imageOutputPerMillion === rates.imageOutputPerMillion
    );
    if (group) {
        group.models.push(model);
    } else {
        groups.push({ rates, models: [model] });
    }
    return groups;
}, []);

function HistoryPanelImpl({
    history,
    onSelectImage,
    onClearHistory,
    getImageSrc,
    onDeleteItemRequest,
    itemPendingDeleteConfirmation,
    onConfirmDeletion,
    onCancelDeletion,
    deletePreferenceDialogValue,
    onDeletePreferenceDialogChange
}: HistoryPanelProps) {
    const [openPromptDialogTimestamp, setOpenPromptDialogTimestamp] = React.useState<number | null>(null);
    const [openCostDialogTimestamp, setOpenCostDialogTimestamp] = React.useState<number | null>(null);
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [copiedTimestamp, setCopiedTimestamp] = React.useState<number | null>(null);

    const { totalCost, totalImages } = React.useMemo(() => {
        let cost = 0;
        let images = 0;
        history.forEach((item) => {
            if (item.costDetails) {
                cost += item.costDetails.estimated_cost_usd;
            }
            images += item.images?.length ?? 0;
        });

        return { totalCost: Math.round(cost * 10000) / 10000, totalImages: images };
    }, [history]);

    const averageCost = totalImages > 0 ? totalCost / totalImages : 0;

    const handleCopy = async (text: string | null | undefined, timestamp: number) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedTimestamp(timestamp);
            setTimeout(() => setCopiedTimestamp(null), 1500);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/10 px-4 py-3'>
                <div className='flex items-center gap-2'>
                    <CardTitle className='text-lg font-medium text-white'>History</CardTitle>
                    {totalCost > 0 && (
                        <Dialog open={isTotalCostDialogOpen} onOpenChange={setIsTotalCostDialogOpen}>
                            <DialogTrigger asChild>
                                <button
                                    className='mt-0.5 flex items-center gap-1 rounded-full bg-green-600/80 px-1.5 py-0.5 text-[12px] text-white transition-colors hover:bg-green-500/90'
                                    aria-label='Show total cost summary'>
                                    Total Cost: ${totalCost.toFixed(4)}
                                </button>
                            </DialogTrigger>
                            <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                <DialogHeader>
                                    <DialogTitle className='text-white'>Total Cost Summary</DialogTitle>
                                    {/* Add sr-only description for accessibility */}
                                    <DialogDescription className='sr-only'>
                                        A summary of the total estimated cost for all generated images in the history.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className='space-y-2 pt-1 text-xs text-neutral-400'>
                                    {RATE_GROUPS.map(({ rates, models }) => (
                                        <div key={models.join(',')} className='space-y-1'>
                                            <p className='font-medium'>{models.join(', ')}:</p>
                                            <ul className='list-disc pl-4'>
                                                <li>Text Input: ${rates.textInputPerMillion} / 1M tokens</li>
                                                <li>Image Input: ${rates.imageInputPerMillion} / 1M tokens</li>
                                                <li>Image Output: ${rates.imageOutputPerMillion} / 1M tokens</li>
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                                <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                    <div className='flex justify-between'>
                                        <span>Total Images Generated:</span> <span>{totalImages.toLocaleString()}</span>
                                    </div>
                                    <div className='flex justify-between'>
                                        <span>Average Cost Per Image:</span> <span>${averageCost.toFixed(4)}</span>
                                    </div>
                                    <hr className='my-2 border-neutral-700' />
                                    <div className='flex justify-between font-medium text-white'>
                                        <span>Total Estimated Cost:</span>
                                        <span>${totalCost.toFixed(4)}</span>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button
                                            type='button'
                                            variant='secondary'
                                            size='sm'
                                            className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                            Close
                                        </Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
                {history.length > 0 && (
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onClearHistory}
                        className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                        Clear
                    </Button>
                )}
            </CardHeader>
            <CardContent className='flex-grow overflow-y-auto p-4'>
                {history.length === 0 ? (
                    <div className='flex h-full items-center justify-center text-white/40'>
                        <p>Generated images will appear here.</p>
                    </div>
                ) : (
                    <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                        {[...history].map((item) => {
                            const firstImage = item.images?.[0];
                            const imageCount = item.images?.length ?? 0;
                            const isMultiImage = imageCount > 1;
                            const itemKey = item.timestamp;
                            const originalStorageMode = item.storageModeUsed || 'fs';
                            const outputFormat = item.output_format || 'png';
                            const model = item.model ?? 'gpt-image-1';

                            let thumbnailUrl: string | undefined;
                            if (firstImage) {
                                if (originalStorageMode === 'indexeddb') {
                                    thumbnailUrl = getImageSrc(firstImage.filename);
                                } else {
                                    thumbnailUrl = `/api/image/${firstImage.filename}`;
                                }
                            }

                            return (
                                <div key={itemKey} className='flex flex-col'>
                                    <div className='group relative'>
                                        <button
                                            onClick={() => onSelectImage(item)}
                                            className='relative block aspect-square w-full overflow-hidden rounded-t-md border border-white/20 transition-all duration-150 group-hover:border-white/40 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black focus:outline-none'
                                            aria-label={`View image batch from ${new Date(item.timestamp).toLocaleString()}`}>
                                            {thumbnailUrl ? (
                                                <Image
                                                    src={thumbnailUrl}
                                                    alt={`Preview for batch generated at ${new Date(item.timestamp).toLocaleString()}`}
                                                    width={150}
                                                    height={150}
                                                    className='h-full w-full object-cover'
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className='flex h-full w-full items-center justify-center bg-neutral-800 text-neutral-500'>
                                                    ?
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    'pointer-events-none absolute top-1 left-1 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-white',
                                                    item.mode === 'edit' ? 'bg-orange-600/80' : 'bg-blue-600/80'
                                                )}>
                                                {item.mode === 'edit' ? (
                                                    <Pencil size={12} />
                                                ) : (
                                                    <SparklesIcon size={12} />
                                                )}
                                                {item.mode === 'edit' ? 'Edit' : 'Create'}
                                            </div>
                                            {isMultiImage && (
                                                <div className='pointer-events-none absolute right-1 bottom-1 z-10 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[12px] text-white'>
                                                    <Layers size={16} />
                                                    {imageCount}
                                                </div>
                                            )}
                                            <div className='pointer-events-none absolute bottom-1 left-1 z-10 flex items-center gap-1'>
                                                <div className='flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900/80 px-1 py-0.5 text-[11px] text-white/70'>
                                                    {originalStorageMode === 'fs' ? (
                                                        <HardDrive size={12} className='text-neutral-400' />
                                                    ) : (
                                                        <Database size={12} className='text-blue-400' />
                                                    )}
                                                    <span>{originalStorageMode === 'fs' ? 'file' : 'db'}</span>
                                                </div>
                                                {item.output_format && (
                                                    <div className='flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900/80 px-1 py-0.5 text-[11px] text-white/70'>
                                                        <FileImage size={12} className='text-neutral-400' />
                                                        <span>{outputFormat.toUpperCase()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                        {item.costDetails && (
                                            <Dialog
                                                open={openCostDialogTimestamp === itemKey}
                                                onOpenChange={(isOpen) => !isOpen && setOpenCostDialogTimestamp(null)}>
                                                <DialogTrigger asChild>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenCostDialogTimestamp(itemKey);
                                                        }}
                                                        className='absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-full bg-green-600/80 px-1.5 py-0.5 text-[11px] text-white transition-colors hover:bg-green-500/90'
                                                        aria-label='Show cost breakdown'>
                                                        <DollarSign size={12} />
                                                        {item.costDetails.estimated_cost_usd.toFixed(4)}
                                                    </button>
                                                </DialogTrigger>
                                                <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                                    <DialogHeader>
                                                        <DialogTitle className='text-white'>Cost Breakdown</DialogTitle>
                                                        <DialogDescription className='sr-only'>
                                                            Estimated cost breakdown for this image generation.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    {(() => {
                                                        const rates = getModelRates(model);
                                                        const svgWriter = item.costDetails.svg_writer && {
                                                            ...item.costDetails.svg_writer,
                                                            rates: getSvgWriterRates(item.costDetails.svg_writer.model)
                                                        };
                                                        return (
                                                            <>
                                                                <div className='space-y-1 pt-1 text-xs text-neutral-400'>
                                                                    <p>Pricing for {model}:</p>
                                                                    <ul className='list-disc pl-4'>
                                                                        <li>
                                                                            Text Input: ${rates.textInputPerMillion} /
                                                                            1M tokens
                                                                        </li>
                                                                        <li>
                                                                            Image Input: ${rates.imageInputPerMillion} /
                                                                            1M tokens
                                                                        </li>
                                                                        <li>
                                                                            Image Output: ${rates.imageOutputPerMillion}{' '}
                                                                            / 1M tokens
                                                                        </li>
                                                                    </ul>
                                                                    {svgWriter && (
                                                                        <>
                                                                            <p>Pricing for {svgWriter.model}:</p>
                                                                            <ul className='list-disc pl-4'>
                                                                                <li>
                                                                                    Input: $
                                                                                    {svgWriter.rates.inputPerMillion} /
                                                                                    1M tokens
                                                                                </li>
                                                                                <li>
                                                                                    Output: $
                                                                                    {svgWriter.rates.outputPerMillion} /
                                                                                    1M tokens
                                                                                </li>
                                                                            </ul>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                                                    <div className='flex justify-between'>
                                                                        <span>Text Input Tokens:</span>{' '}
                                                                        <span>
                                                                            {item.costDetails.text_input_tokens.toLocaleString()}{' '}
                                                                            (~$
                                                                            {formatUsd(
                                                                                item.costDetails.text_input_tokens,
                                                                                rates.textInputPerMillion
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    </div>
                                                                    {item.costDetails.image_input_tokens > 0 && (
                                                                        <div className='flex justify-between'>
                                                                            <span>Image Input Tokens:</span>{' '}
                                                                            <span>
                                                                                {item.costDetails.image_input_tokens.toLocaleString()}{' '}
                                                                                (~$
                                                                                {formatUsd(
                                                                                    item.costDetails.image_input_tokens,
                                                                                    rates.imageInputPerMillion
                                                                                )}
                                                                                )
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    <div className='flex justify-between'>
                                                                        <span>Image Output Tokens:</span>{' '}
                                                                        <span>
                                                                            {item.costDetails.image_output_tokens.toLocaleString()}{' '}
                                                                            (~$
                                                                            {formatUsd(
                                                                                item.costDetails.image_output_tokens,
                                                                                rates.imageOutputPerMillion
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    </div>
                                                                    {svgWriter && (
                                                                        <>
                                                                            <div className='flex justify-between'>
                                                                                <span>
                                                                                    SVG Writer Input ({svgWriter.model}
                                                                                    ):
                                                                                </span>{' '}
                                                                                <span>
                                                                                    {svgWriter.input_tokens.toLocaleString()}{' '}
                                                                                    (~$
                                                                                    {formatUsd(
                                                                                        svgWriter.input_tokens,
                                                                                        svgWriter.rates.inputPerMillion
                                                                                    )}
                                                                                    )
                                                                                </span>
                                                                            </div>
                                                                            <div className='flex justify-between'>
                                                                                <span>SVG Writer Output:</span>{' '}
                                                                                <span>
                                                                                    {svgWriter.output_tokens.toLocaleString()}{' '}
                                                                                    (~$
                                                                                    {formatUsd(
                                                                                        svgWriter.output_tokens,
                                                                                        svgWriter.rates.outputPerMillion
                                                                                    )}
                                                                                    )
                                                                                </span>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    <hr className='my-2 border-neutral-700' />
                                                                    <div className='flex justify-between font-medium text-white'>
                                                                        <span>Total Estimated Cost:</span>
                                                                        <span>
                                                                            $
                                                                            {item.costDetails.estimated_cost_usd.toFixed(
                                                                                4
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                    <DialogFooter>
                                                        <DialogClose asChild>
                                                            <Button
                                                                type='button'
                                                                variant='secondary'
                                                                size='sm'
                                                                className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                                                Close
                                                            </Button>
                                                        </DialogClose>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </div>

                                    <div className='space-y-1 rounded-b-md border border-t-0 border-neutral-700 bg-black p-2 text-xs text-white/60'>
                                        <p title={`Generated on: ${new Date(item.timestamp).toLocaleString()}`}>
                                            <span className='font-medium text-white/80'>Time:</span>{' '}
                                            {formatDuration(item.durationMs)}
                                        </p>
                                        <p>
                                            <span className='font-medium text-white/80'>Model:</span> {model}
                                        </p>
                                        <p>
                                            <span className='font-medium text-white/80'>Quality:</span> {item.quality}
                                        </p>
                                        {item.complexity && (
                                            <p>
                                                <span className='font-medium text-white/80'>Complexity:</span>{' '}
                                                {item.complexity}
                                            </p>
                                        )}
                                        {item.frame_count && (
                                            <p>
                                                <span className='font-medium text-white/80'>Frames:</span>{' '}
                                                {item.frame_count} × {item.frame_duration_ms}ms
                                            </p>
                                        )}
                                        <p>
                                            <span className='font-medium text-white/80'>BG:</span> {item.background}
                                        </p>
                                        <p>
                                            <span className='font-medium text-white/80'>Mod:</span> {item.moderation}
                                        </p>
                                        <div className='mt-2 flex items-center gap-1'>
                                            <Dialog
                                                open={openPromptDialogTimestamp === itemKey}
                                                onOpenChange={(isOpen) =>
                                                    !isOpen && setOpenPromptDialogTimestamp(null)
                                                }>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant='outline'
                                                        size='sm'
                                                        className='h-6 flex-grow border-white/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white'
                                                        onClick={() => setOpenPromptDialogTimestamp(itemKey)}>
                                                        Show Prompt
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[625px]'>
                                                    <DialogHeader>
                                                        <DialogTitle className='text-white'>Prompt</DialogTitle>
                                                        <DialogDescription className='sr-only'>
                                                            The full prompt used to generate this image batch.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className='max-h-[400px] overflow-y-auto rounded-md border border-neutral-600 bg-neutral-800 p-3 py-4 text-sm text-neutral-300'>
                                                        {item.prompt || 'No prompt recorded.'}
                                                    </div>
                                                    <DialogFooter>
                                                        <Button
                                                            variant='outline'
                                                            size='sm'
                                                            onClick={() => handleCopy(item.prompt, itemKey)}
                                                            className='border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white'>
                                                            {copiedTimestamp === itemKey ? (
                                                                <Check className='mr-2 h-4 w-4 text-green-400' />
                                                            ) : (
                                                                <Copy className='mr-2 h-4 w-4' />
                                                            )}
                                                            {copiedTimestamp === itemKey ? 'Copied!' : 'Copy'}
                                                        </Button>
                                                        <DialogClose asChild>
                                                            <Button
                                                                type='button'
                                                                variant='secondary'
                                                                size='sm'
                                                                className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                                                Close
                                                            </Button>
                                                        </DialogClose>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                            <Dialog
                                                open={itemPendingDeleteConfirmation?.timestamp === item.timestamp}
                                                onOpenChange={(isOpen) => {
                                                    if (!isOpen) onCancelDeletion();
                                                }}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        className='h-6 w-6 bg-red-700/60 text-white hover:bg-red-600/60'
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteItemRequest(item);
                                                        }}
                                                        aria-label='Delete history item'>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-md'>
                                                    <DialogHeader>
                                                        <DialogTitle className='text-white'>
                                                            Confirm Deletion
                                                        </DialogTitle>
                                                        <DialogDescription className='pt-2 text-neutral-300'>
                                                            Are you sure you want to delete this history entry? This
                                                            will remove {item.images.length} image(s). This action
                                                            cannot be undone.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className='flex items-center space-x-2 py-2'>
                                                        <Checkbox
                                                            id={`dont-ask-${item.timestamp}`}
                                                            checked={deletePreferenceDialogValue}
                                                            onCheckedChange={(checked) =>
                                                                onDeletePreferenceDialogChange(!!checked)
                                                            }
                                                            className='border-neutral-400 bg-white data-[state=checked]:border-neutral-700 data-[state=checked]:bg-white data-[state=checked]:text-black dark:border-neutral-500 dark:!bg-white'
                                                        />
                                                        <label
                                                            htmlFor={`dont-ask-${item.timestamp}`}
                                                            className='text-sm leading-none font-medium text-neutral-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                                                            Don&apos;t ask me again
                                                        </label>
                                                    </div>
                                                    <DialogFooter className='gap-2 sm:justify-end'>
                                                        <Button
                                                            type='button'
                                                            variant='outline'
                                                            size='sm'
                                                            onClick={onCancelDeletion}
                                                            className='border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white'>
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            type='button'
                                                            variant='destructive'
                                                            size='sm'
                                                            onClick={onConfirmDeletion}
                                                            className='bg-red-600 text-white hover:bg-red-500'>
                                                            Delete
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export const HistoryPanel = React.memo(HistoryPanelImpl);
