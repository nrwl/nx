import { multiselectPrompt } from '../../utils/prompt-helpers';
import { isCI } from '../../utils/is-ci';
import { Agent, agentDisplayMap, supportedAgents } from '../../ai/utils';
import { detectAiAgent } from '../../ai/detect-ai-agent';
import * as pc from 'picocolors';

export async function determineAiAgents(
  aiAgents?: (Agent | 'none')[],
  interactive?: boolean
): Promise<Agent[]> {
  if (aiAgents) {
    const filtered = aiAgents.filter((a) => a !== 'none') as Agent[];
    if (filtered.length > 0) {
      return filtered;
    }
    return [];
  }

  if (interactive === false || isCI()) {
    const detected = detectAiAgent();
    return detected ? [detected] : [];
  }
  return await aiAgentsPrompt();
}

async function aiAgentsPrompt(): Promise<Agent[]> {
  return multiselectPrompt<Agent>({
    message: 'Which AI agents, if any, would you like to set up?',
    choices: supportedAgents.map((a) => ({
      value: a,
      label: agentDisplayMap[a],
    })),
  });
}
