import {
  filterNonEmptyStrings,
  renderListItem,
} from './prompts/shared-rendering';

/**
 * Surfaces a migration's `agentContext` to stdout in an XML-tagged block so an
 * outer AI agent driving `nx migrate` can ingest the hints when no inner agent
 * step ran to consume them.
 *
 * Used only when `agentic.kind === 'inside-agent'`. Under `enabled`, the inner
 * step consumes `agentContext` via the prompt builders. Under `disabled` the
 * run is human-driven and printing agent-targeted context would only add noise.
 *
 * The label format is unambiguous so the outer agent can locate the block
 * within the mixed stdout stream (logger output, migration progress, etc.).
 */
export interface DroppedAgentContextInput {
  migration: { package: string; name: string };
  agentContext: string[];
}

export function formatDroppedAgentContextForOuterAgent(
  input: DroppedAgentContextInput
): string {
  const entries = filterNonEmptyStrings(input.agentContext);
  if (entries.length === 0) {
    return '';
  }
  const id = `${input.migration.package}:${input.migration.name}`;
  return [
    `<agent_context migration="${id}">`,
    ...entries.map(renderListItem),
    `</agent_context>`,
  ].join('\n');
}

export function printDroppedAgentContextForOuterAgent(
  input: DroppedAgentContextInput
): void {
  const block = formatDroppedAgentContextForOuterAgent(input);
  if (block) {
    // Bare newline pair frames the block so adjacent stdout (logger output,
    // migration progress) doesn't run into the opening or closing tag.
    process.stdout.write(`\n${block}\n\n`);
  }
}
