export declare const FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK: "CLEAR_CACHED_SYNC_GENERATOR_CHANGES";
export type HandleFlushSyncGeneratorChangesToDiskMessage = {
    type: typeof FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK;
    generators: string[];
};
export declare function isHandleFlushSyncGeneratorChangesToDiskMessage(message: unknown): message is HandleFlushSyncGeneratorChangesToDiskMessage;
