import { claudeCodeDefinition } from './definitions/claude-code';
import { codexDefinition } from './definitions/codex';
import { opencodeDefinition } from './definitions/opencode';
import { AgentDefinition, AgentId } from './types';

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  claudeCodeDefinition,
  codexDefinition,
  opencodeDefinition,
];

const byId = new Map<AgentId, AgentDefinition>(
  AGENT_DEFINITIONS.map((definition) => [definition.id, definition])
);

export function getAgentDefinition(id: AgentId): AgentDefinition | undefined {
  return byId.get(id);
}
