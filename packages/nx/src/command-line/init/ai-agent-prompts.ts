import { prompt } from 'enquirer';
import { isCI } from '../../utils/is-ci';
import { Agent, agentDisplayMap, supportedAgents } from '../../ai/utils';
import { detectAiAgent } from '../../ai/detect-ai-agent';
import * as pc from 'picocolors';

export async function determineAiAgents(
  aiAgents?: (Agent | 'none')[],
  interactive?: boolean
): Promise<Agent[]> {
  if (aiAgents && aiAgents.includes('none' as any)) {
    return [];
  }

  if (interactive === false || isCI()) {
    if (aiAgents) {
      return aiAgents as Agent[];
    }
    const detected = detectAiAgent();
    return detected ? [detected] : [];
  }

  if (aiAgents) {
    return aiAgents as Agent[];
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
