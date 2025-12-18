import { prompt } from 'enquirer';
import { isCI } from '../../utils/is-ci';
import { Agent, agentDisplayMap, supportedAgents } from '../../ai/utils';
import chalk = require('chalk');

export async function determineAiAgents(
  aiAgents?: Agent[],
  interactive?: boolean
): Promise<Agent[]> {
  if (interactive === false || isCI()) {
    return aiAgents ?? [];
  }

  if (aiAgents) {
    return aiAgents;
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
      chalk.dim(
        'Multiple selections possible. <Space> to select. <Enter> to confirm.'
      ),
  };
  return (await prompt<{ agents: Agent[] }>([promptConfig])).agents;
}
