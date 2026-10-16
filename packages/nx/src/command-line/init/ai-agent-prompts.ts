import { multiselectPrompt } from '../../utils/prompt-helpers';
import { isCI } from '../../utils/is-ci';
import {
  Agent,
  agentDisplayMap,
  filterSupportedAgents,
  supportedAgents,
} from '../../ai/utils';
import { detectAiAgent } from '../../ai/detect-ai-agent';
import * as pc from 'picocolors';

export async function determineAiAgents(
  aiAgents?: string[],
  interactive?: boolean
): Promise<Agent[]> {
  if (aiAgents) {
    return filterSupportedAgents(aiAgents.filter((a) => a !== 'none'));
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
