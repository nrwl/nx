export declare const GET_SYNC_GENERATOR_CHANGES: "GET_SYNC_GENERATOR_CHANGES";
export type HandleGetSyncGeneratorChangesMessage = {
    type: typeof GET_SYNC_GENERATOR_CHANGES;
    generators: string[];
};
export declare function isHandleGetSyncGeneratorChangesMessage(message: unknown): message is HandleGetSyncGeneratorChangesMessage;
