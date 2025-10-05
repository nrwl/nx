import { prompt } from 'enquirer';
import { isCI } from '../../utils/is-ci';
import { Agent, agentDisplayMap, supportedAgents } from '../../ai/utils';

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
  return (
    await prompt<{ agents: Agent[] }>([
      {
        name: 'agents',
        message:
          'Which AI agents would you like to set up? (space to select, enter to confirm)',
        type: 'multiselect',
        choices: supportedAgents.map((a) => ({
          name: a,
          message: agentDisplayMap[a],
        })),
      },
    ])
  ).agents;
}
