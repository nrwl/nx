export interface ListArgs {
    /** The name of an installed plugin to query  */
    plugin?: string | undefined;
    /** Output as JSON */
    json?: boolean;
}
/**
 * List available plugins or capabilities within a specific plugin
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
export declare function listHandler(args: ListArgs): Promise<void>;
