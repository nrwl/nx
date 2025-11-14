export const GET_NX_CONSOLE_STATUS = 'GET_NX_CONSOLE_STATUS' as const;
export const SET_NX_CONSOLE_PREFERENCE_AND_INSTALL =
  'SET_NX_CONSOLE_PREFERENCE_AND_INSTALL' as const;

export type HandleGetNxConsoleStatusMessage = {
  type: typeof GET_NX_CONSOLE_STATUS;
};

export type NxConsoleStatusResponse = {
  shouldPrompt: boolean;
  canInstall: boolean;
  currentPreference: boolean | null;
};

export type HandleSetNxConsolePreferenceAndInstallMessage = {
  type: typeof SET_NX_CONSOLE_PREFERENCE_AND_INSTALL;
  preference: boolean;
};

export type SetNxConsolePreferenceAndInstallResponse = {
  installed: boolean;
};

export function isHandleGetNxConsoleStatusMessage(
  message: unknown
): message is HandleGetNxConsoleStatusMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_NX_CONSOLE_STATUS
  );
}

export function isHandleSetNxConsolePreferenceAndInstallMessage(
  message: unknown
): message is HandleSetNxConsolePreferenceAndInstallMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === SET_NX_CONSOLE_PREFERENCE_AND_INSTALL
  );
}
