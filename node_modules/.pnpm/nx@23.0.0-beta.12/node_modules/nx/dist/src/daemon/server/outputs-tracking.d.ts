import { WatchEvent } from '../../native';
export declare function _recordOutputsHash(outputs: string[], hash: string): void;
export declare function _outputsHashesMatch(outputs: string[], hash: string): boolean;
export declare function processFileChangesInOutputs(changeEvents: WatchEvent[], now?: number): void;
/**
 * Check whether the on-disk outputs of each entry still match the hash
 * the daemon recorded for them. Uses Rayon-parallel filesystem scanning
 * for uncached entries.
 */
export declare function outputsHashesMatchBatch(entries: {
    outputs: string[];
    hash: string;
}[]): boolean[];
/**
 * Record the hash of each entry's on-disk outputs so future
 * outputsHashesMatchBatch calls can skip redundant cache copies.
 * Uses Rayon-parallel filesystem scanning.
 */
export declare function recordOutputsHashBatch(entries: {
    outputs: string[];
    hash: string;
}[]): void;
export declare function disableOutputsTracking(): void;
