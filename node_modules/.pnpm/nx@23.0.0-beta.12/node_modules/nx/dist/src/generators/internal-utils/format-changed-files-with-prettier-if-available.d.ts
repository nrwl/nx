import type { Tree } from '../tree';
/**
 * Formats all the created or updated files using Prettier
 * @param tree - the file system tree
 *
 * @remarks
 * Set the environment variable `NX_SKIP_FORMAT` to `true` to skip Prettier
 * formatting. This is useful for repositories that use alternative formatters
 * like Biome, dprint, or have custom formatting requirements.
 */
export declare function formatChangedFilesWithPrettierIfAvailable(tree: Tree, options?: {
    silent?: boolean;
}): Promise<void>;
export declare function formatFilesWithPrettierIfAvailable(files: {
    path: string;
    content: string | Buffer;
}[], root: string, options?: {
    silent?: boolean;
}): Promise<Map<string, string>>;
