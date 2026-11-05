'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ImageMode } from '@/lib/models';

type ModeToggleProps = {
    currentMode: ImageMode;
    onModeChange: (mode: ImageMode) => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    return (
        <Tabs value={currentMode} onValueChange={(value) => onModeChange(value as ImageMode)} className='w-auto'>
            <TabsList className='grid h-auto grid-cols-2 gap-1 rounded-md border-none bg-transparent p-0'>
                <TabsTrigger
                    value='generate'
                    className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                        currentMode === 'generate'
                            ? 'border-white bg-white text-black'
                            : 'border-dashed border-white/30 bg-transparent text-white/60 hover:border-white/50 hover:text-white/80'
                    } `}>
                    Generate
                </TabsTrigger>
                <TabsTrigger
                    value='edit'
                    className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                        currentMode === 'edit'
                            ? 'border-white bg-white text-black'
                            : 'border-dashed border-white/30 bg-transparent text-white/60 hover:border-white/50 hover:text-white/80'
                    } `}>
                    Edit
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
