export interface ImportOptions {
    /**
     * The remote URL of the repository to import
     */
    sourceRepository: string;
    /**
     * The branch or reference to import
     */
    ref: string;
    /**
     * The directory in the source repo to import
     */
    source: string;
    /**
     * The directory in the destination repo to import into
     */
    destination: string;
    /**
     * The depth to clone the source repository (limit this for faster clone times)
     */
    depth: number;
    verbose: boolean;
    interactive: boolean;
    plugins?: string;
}
export declare function importHandler(options: ImportOptions): Promise<void>;
