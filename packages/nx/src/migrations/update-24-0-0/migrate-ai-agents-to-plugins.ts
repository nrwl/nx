import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import { Tree } from '../../generators/tree';
import { claudeMdPath } from '../../ai/constants';
import {
  hasCodexNxMcp,
  hasCodexPlugin,
  hasCursorPlugin,
  hasOpencodeNxMcp,
  hasOpencodePlugin,
  isClaudePluginEnabled,
} from '../../ai/set-up-ai-agents/agent-plugin-config';
import {
  findLegacyAgentFiles,
  hasNxRulesBlock,
  legacyAgentFolders,
  removeNxRulesBlocks,
} from '../../ai/set-up-ai-agents/legacy-agent-config';
import { setupAiAgentsGeneratorImpl } from '../../ai/set-up-ai-agents/set-up-ai-agents';
import type { Agent } from '../../ai/utils';

/**
 * Agents that `nx configure-ai-agents` used to set up by writing rules files,
 * MCP entries and copied skills, and that now get the Nx agent plugin instead.
 * Copilot and Gemini have no plugin and keep their copied files, so they are
 * left to `nx configure-ai-agents`.
 */
function detectAgentsToMigrate(tree: Tree): Agent[] {
  const agents: Agent[] = [];
  if (
    isClaudePluginEnabled(tree, '.') ||
    hasNxRulesBlock(tree, claudeMdPath('.'))
  ) {
    agents.push('claude');
  }
  if (
    hasCursorPlugin(tree, '.') ||
    findLegacyAgentFiles(tree, '.', legacyAgentFolders.cursor).length > 0
  ) {
    agents.push('cursor');
  }
  if (
    hasCodexPlugin(tree, '.') ||
    hasCodexNxMcp(tree, '.') ||
    findLegacyAgentFiles(tree, '.', legacyAgentFolders.codex).length > 0
  ) {
    agents.push('codex');
  }
  if (
    hasOpencodePlugin(tree, '.') ||
    hasOpencodeNxMcp(tree, '.') ||
    findLegacyAgentFiles(tree, '.', legacyAgentFolders.opencode).length > 0
  ) {
    agents.push('opencode');
  }
  return agents;
}

export default async function migrateAiAgentsToPlugins(tree: Tree) {
  const agents = detectAgentsToMigrate(tree);

  if (agents.length === 0) {
    removeNxRulesBlocks(tree, '.');
    await formatChangedFiles(tree);
    return [];
  }

  const callback = await setupAiAgentsGeneratorImpl(tree, {
    directory: '.',
    agents,
    writeNxCloudRules: false,
    packageVersion: 'latest',
  });
  // Check mode reports problems without installing anything on this machine.
  const { errors } = await callback(true);

  const nextSteps = errors.map((error) =>
    [error.title, ...(error.bodyLines ?? [])].join(' ')
  );
  if (agents.includes('codex')) {
    nextSteps.push(
      'Codex installs plugins per user: run "nx configure-ai-agents" once to install the Nx plugin for Codex on your machine. Teammates using Codex need to do the same.'
    );
  }
  return nextSteps;
}
