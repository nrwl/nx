export declare const GET_NX_CONSOLE_STATUS: "GET_NX_CONSOLE_STATUS";
export declare const SET_NX_CONSOLE_PREFERENCE_AND_INSTALL: "SET_NX_CONSOLE_PREFERENCE_AND_INSTALL";
export type HandleGetNxConsoleStatusMessage = {
    type: typeof GET_NX_CONSOLE_STATUS;
};
export type NxConsoleStatusResponse = {
    shouldPrompt: boolean;
};
export type HandleSetNxConsolePreferenceAndInstallMessage = {
    type: typeof SET_NX_CONSOLE_PREFERENCE_AND_INSTALL;
    preference: boolean;
};
export type SetNxConsolePreferenceAndInstallResponse = {
    installed: boolean;
};
export declare function isHandleGetNxConsoleStatusMessage(message: unknown): message is HandleGetNxConsoleStatusMessage;
export declare function isHandleSetNxConsolePreferenceAndInstallMessage(message: unknown): message is HandleSetNxConsolePreferenceAndInstallMessage;
