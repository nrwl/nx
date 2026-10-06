import { existsSync, readFileSync } from 'fs';
import { AgentStatusInfo } from '../daemon/message-types/configure-ai-agents';
import { detectAiAgent } from './detect-ai-agent';
import { agentsMdPath, rulesRegex } from './constants';

/**
 * Whether to show the "configure-ai-agents is outdated" banner after a task run.
 */
export function shouldPrintConfigureAiAgentsDisclaimer(
  outdatedAgents: AgentStatusInfo[],
  workspaceRoot: string
): boolean {
  if (outdatedAgents.length === 0) {
    return false;
  }

  const detectedAgent = detectAiAgent();
  if (detectedAgent) {
    return outdatedAgents.some((agent) => agent.name === detectedAgent);
  }

  // Unsupported agents (e.g. qwen) cannot be configured via `nx configure-ai-agents`.
  // If the repo already has Nx rules in AGENTS.md, skip the misleading warning.
  const agentsMd = agentsMdPath(workspaceRoot);
  if (!existsSync(agentsMd)) {
    return true;
  }

  try {
    const content = readFileSync(agentsMd, 'utf-8');
    return !rulesRegex.test(content);
  } catch {
    return true;
  }
}
