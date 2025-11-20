import type {
  NxConsoleStatusResponse,
  SetNxConsolePreferenceAndInstallResponse,
} from '../message-types/nx-console';
import type { HandlerResult } from './server';
import {
  getNxConsoleStatus,
  handleNxConsolePreferenceAndInstall,
} from './nx-console-operations';

// Module-level state for caching
let cachedShouldPrompt: boolean | null = null;
let isComputing = false;

export async function handleGetNxConsoleStatus(): Promise<HandlerResult> {
  // Return cached result if available
  if (cachedShouldPrompt !== null) {
    const response: NxConsoleStatusResponse = {
      shouldPrompt: cachedShouldPrompt,
    };
    return {
      response,
      description: 'handleGetNxConsoleStatus',
    };
  }

  // Kick off background computation if not already running
  if (!isComputing) {
    isComputing = true;
    getNxConsoleStatus()
      .then((result) => {
        cachedShouldPrompt = result;
        isComputing = false;
      })
      .catch(() => {
        cachedShouldPrompt = null;
        isComputing = false;
      });
  }

  // Return false for shouldPrompt if cache not ready (main process will noop)
  const response: NxConsoleStatusResponse = {
    shouldPrompt: false,
  };

  return {
    response,
    description: 'handleGetNxConsoleStatus',
  };
}

export async function handleSetNxConsolePreferenceAndInstall(
  preference: boolean
): Promise<HandlerResult> {
  // Immediately update cache - we know the answer now!
  // User answered the prompt, so we won't prompt again
  cachedShouldPrompt = false;

  const result = await handleNxConsolePreferenceAndInstall({ preference });

  const response: SetNxConsolePreferenceAndInstallResponse = {
    installed: result.installed,
  };

  return {
    response,
    description: 'handleSetNxConsolePreferenceAndInstall',
  };
}
