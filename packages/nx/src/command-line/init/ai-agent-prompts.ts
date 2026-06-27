import { prompt } from 'enquirer';
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
  const promptConfig: Parameters<typeof prompt>[0] & {
    footer: () => void;
  } = {
    name: 'agents',
    message: 'Which AI agents, if any, would you like to set up?',
    type: 'multiselect',
    choices: supportedAgents.map((a) => ({
      name: a,
      message: agentDisplayMap[a],
    })),
    footer: () =>
      pc.dim(
        'Multiple selections possible. <Space> to select. <Enter> to confirm.'
      ),
  };
  return (await prompt<{ agents: Agent[] }>([promptConfig])).agents;
}
