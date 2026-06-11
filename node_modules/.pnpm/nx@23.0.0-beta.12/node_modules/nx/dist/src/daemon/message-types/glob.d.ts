export declare const GLOB: "GLOB";
export type HandleGlobMessage = {
    type: typeof GLOB;
    globs: string[];
    exclude?: string[];
};
export declare function isHandleGlobMessage(message: unknown): message is HandleGlobMessage;
export declare const MULTI_GLOB: "MULTI_GLOB";
export type HandleMultiGlobMessage = {
    type: typeof MULTI_GLOB;
    globs: string[];
    exclude?: string[];
};
export declare function isHandleMultiGlobMessage(message: unknown): message is HandleMultiGlobMessage;
