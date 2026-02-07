import type { MarkerConfig } from '../interfaces/MarkerConfig.js';

export type MarkerConfigEntries = [number, MarkerConfig][];

export interface MarkerManagerInterface
{
    initializeFromConfig: (entries: MarkerConfigEntries) => void;

    cleanup: () => void;
}
