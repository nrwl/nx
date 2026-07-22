import type { NxJsonConfiguration } from '../config/nx-json';

/**
 * Returns whether Nx should automatically detect AI agent configuration drift
 * and print the "Run nx configure-ai-agents to update" disclaimer after task
 * runs. Workspaces can opt out either via `nx.json`
 * (`neverConfigureAiAgents: true`) or via the `NX_NEVER_CONFIGURE_AI_AGENTS=true`
 * environment variable. The env var takes precedence over `nx.json`.
 *
 * The explicit `nx configure-ai-agents` command is unaffected — opting out only
 * disables the implicit detection/nag and the daemon's background status
 * computation.
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
