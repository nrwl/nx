import { AgentStatusInfo } from '../daemon/message-types/configure-ai-agents';
import { isAiAgent } from '../native';
import { detectAiAgent } from './detect-ai-agent';

/**
 * Whether to show the "configure-ai-agents is outdated" banner after a task run.
 */
export function shouldPrintConfigureAiAgentsDisclaimer(
  outdatedAgents: AgentStatusInfo[]
): boolean {
  if (outdatedAgents.length === 0) {
    return false;
  }

  const detectedAgent = detectAiAgent();
  if (detectedAgent) {
    return outdatedAgents.some((agent) => agent.name === detectedAgent);
  }

  // Unsupported agents (e.g. qwen) cannot be configured via
  // `nx configure-ai-agents`, so the banner would only mislead them.
  return !isAiAgent();
}
