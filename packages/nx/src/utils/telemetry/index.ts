/**
 * Telemetry module for Nx anonymous usage data collection.
 *
 * This module provides:
 * - Settings resolution from multiple sources (env, repo, user)
 * - User preferences storage in ~/.nxrc
 * - Opt-in prompt for interactive sessions
 */

// Types
export type {
  TelemetrySettings,
  ResolvedTelemetrySettings,
  SanitizedArgs,
  SanitizedValue,
  WorkspaceMetadata,
  CommandTelemetryEvent,
  TaskExecutionEvent,
  ErrorEvent,
  CommandContext,
} from './types';

// Settings resolution
export {
  resolveTelemetrySettings,
  isTelemetryEnabled,
  getTelemetryEndpoints,
  shouldPromptForTelemetry,
  clearSettingsCache,
} from './resolve-settings';

// User settings
export {
  getUserTelemetrySettings,
  setUserTelemetrySettings,
  hasUserTelemetryPreference,
  getNxrcPath,
} from './user-settings';

// Prompt
export { promptForTelemetryIfNeeded } from './prompt';
