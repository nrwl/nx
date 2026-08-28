import type { NxJsonConfiguration } from '../config/nx-json';

/**
 * Returns whether Nx should automatically check AI agent configuration and
 * print the update disclaimer after task runs.
 */
export function isConfigureAiAgentsEnabled(
  nxJson?: NxJsonConfiguration | null
): boolean {
  const envValue = process.env.NX_NEVER_CONFIGURE_AI_AGENTS;
  if (envValue === 'true') {
    return false;
  }
  if (envValue === 'false') {
    return true;
  }
  return !nxJson?.neverConfigureAiAgents;
}
