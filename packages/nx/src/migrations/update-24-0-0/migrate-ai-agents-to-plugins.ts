import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import { Tree } from '../../generators/tree';
import { hasAgentSetup } from '../../ai/set-up-ai-agents/agent-plugin-config';
import {
  hasUnsupportedAgentSetup,
  removeLegacyNxSetup,
} from '../../ai/set-up-ai-agents/legacy-agent-config';
import { setupAiAgentsGeneratorImpl } from '../../ai/set-up-ai-agents/set-up-ai-agents';
import { supportedAgents } from '../../ai/utils';

export default async function migrateAiAgentsToPlugins(tree: Tree) {
  const agents = supportedAgents.filter((agent) =>
    hasAgentSetup(tree, '.', agent)
  );
  const hadUnsupportedAgentSetup = hasUnsupportedAgentSetup(tree, '.');
  const nextSteps: string[] = [];

  // Runs for every workspace; the generator below repeats it harmlessly.
  const { kept } = removeLegacyNxSetup(tree, '.');

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

  if (hadUnsupportedAgentSetup) {
    nextSteps.push(
      'Nx no longer configures GitHub Copilot and Gemini, so the Nx MCP server entry and skills it set up for them were removed.'
    );
  }
  if (kept.length > 0) {
    nextSteps.push(
      `Kept files Nx previously copied that were edited since; delete them once your changes are no longer needed: ${kept.join(', ')}`
    );
  }

  await formatChangedFiles(tree);
  return nextSteps;
}
