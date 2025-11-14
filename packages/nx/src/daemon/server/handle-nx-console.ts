import { homedir } from 'os';
import {
  canInstallNxConsole,
  installNxConsole,
  NxConsolePreferences,
} from '../../native';
import type {
  NxConsoleStatusResponse,
  SetNxConsolePreferenceAndInstallResponse,
} from '../message-types/nx-console';
import type { HandlerResult } from './server';

export async function handleGetNxConsoleStatus(): Promise<HandlerResult> {
  const preferences = new NxConsolePreferences(homedir());
  const setting = preferences.getAutoInstallPreference();
  const canInstallConsole = canInstallNxConsole();

  // If user previously opted in but extension is not installed,
  // they must have manually uninstalled it - respect that choice
  if (setting === true && canInstallConsole) {
    // User had auto-install enabled but extension is missing
    // This means they manually uninstalled it
    preferences.setAutoInstallPreference(false);

    const response: NxConsoleStatusResponse = {
      shouldPrompt: false,
      canInstall: canInstallConsole,
      currentPreference: false, // Updated preference
    };

    return {
      response,
      description: 'handleGetNxConsoleStatus',
    };
  }

  // Determine if we should prompt
  const shouldPrompt = canInstallConsole && typeof setting !== 'boolean';

  const response: NxConsoleStatusResponse = {
    shouldPrompt,
    canInstall: canInstallConsole,
    currentPreference: typeof setting === 'boolean' ? setting : null,
  };

  return {
    response,
    description: 'handleGetNxConsoleStatus',
  };
}

export async function handleSetNxConsolePreferenceAndInstall(
  preference: boolean
): Promise<HandlerResult> {
  const preferences = new NxConsolePreferences(homedir());
  preferences.setAutoInstallPreference(preference);

  let installed = false;
  if (preference) {
    installed = installNxConsole();
  }

  const response: SetNxConsolePreferenceAndInstallResponse = {
    installed,
  };

  return {
    response,
    description: 'handleSetNxConsolePreferenceAndInstall',
  };
}
