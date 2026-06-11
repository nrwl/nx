export interface RecordArgs {
    verbose?: boolean;
    '--'?: string[];
}
export declare function recordHandler(args: RecordArgs): Promise<number>;
