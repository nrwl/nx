/**
 * Collapses a list of file paths into a smaller set of parent directories
 * when there are too many outputs to efficiently track individually.
 *
 * This prevents creating too many hash files by:
 * 1. Building a tree structure of all path components
 * 2. Finding the "collapse level" - the deepest level before exceeding MAX_OUTPUTS_TO_CHECK_HASHES
 * 3. Returning parent paths at/above collapse level, while preserving leaf paths that terminate early
 */
export declare function collapseExpandedOutputs(expandedOutputs: string[]): string[];
