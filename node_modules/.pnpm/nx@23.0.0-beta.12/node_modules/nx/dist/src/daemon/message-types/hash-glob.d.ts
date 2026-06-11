export declare const HASH_GLOB: "HASH_GLOB";
export type HandleHashGlobMessage = {
    type: typeof HASH_GLOB;
    globs: string[];
    exclude?: string[];
};
export declare function isHandleHashGlobMessage(message: unknown): message is HandleHashGlobMessage;
export declare const HASH_MULTI_GLOB: "HASH_MULTI_GLOB";
export type HandleHashMultiGlobMessage = {
    type: typeof HASH_MULTI_GLOB;
    globGroups: string[][];
};
export declare function isHandleHashMultiGlobMessage(message: unknown): message is HandleHashMultiGlobMessage;
