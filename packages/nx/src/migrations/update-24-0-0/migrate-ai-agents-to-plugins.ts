import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import { Tree } from '../../generators/tree';
import { hasAgentSetup } from '../../ai/set-up-ai-agents/agent-plugin-config';
import {
  findNxRulesFiles,
  removeNxRulesBlock,
} from '../../ai/set-up-ai-agents/legacy-agent-config';
import { setupAiAgentsGeneratorImpl } from '../../ai/set-up-ai-agents/set-up-ai-agents';
import { supportedAgents, type Agent } from '../../ai/utils';

// Agents that now get the Nx agent plugin. Copilot and Gemini have no plugin
// and keep their copied files, so they are left to `nx configure-ai-agents`.
const pluginAgents: Agent[] = ['claude', 'cursor', 'codex', 'opencode'];

export default async function migrateAiAgentsToPlugins(tree: Tree) {
  const configured = supportedAgents.filter((agent) =>
    hasAgentSetup(tree, '.', agent)
  );
  const agents = pluginAgents.filter((agent) => configured.includes(agent));

  const nextSteps: string[] = [];
  if (agents.length > 0) {
    const callback = await setupAiAgentsGeneratorImpl(tree, {
      directory: '.',
      agents,
      writeNxCloudRules: false,
      packageVersion: 'latest',
    });
    // Check mode reports problems without installing anything on this machine.
    const { errors } = await callback(true);
    nextSteps.push(
      ...errors.map((error) =>
        [error.title, ...(error.bodyLines ?? [])].join(' ')
      )
    );
    if (agents.includes('codex')) {
      nextSteps.push(
        'Codex installs plugins per user: run "nx configure-ai-agents" once to install the Nx plugin for Codex on your machine. Teammates using Codex need to do the same.'
      );
    }
  }

  // Guidelines no configured agent reads are left over from removed setups.
  for (const { path, owners } of findNxRulesFiles(tree, '.')) {
    if (!owners.some((owner) => configured.includes(owner))) {
      removeNxRulesBlock(tree, path);
    }
  }

  await formatChangedFiles(tree);
  return nextSteps;
}
