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
  migration: { package: string; name: string; prompt?: string };
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
  const preamble = input.migration.prompt
    ? `ℹ Hints from the ${input.migration.name} generator for the AI agent driving this run, when applying ${input.migration.prompt}:`
    : `ℹ Hints from the ${input.migration.name} generator for the AI agent driving this run:`;
  return [
    preamble,
    ``,
    `<agent_context migration="${escapeXmlAttr(id)}">`,
    ...entries.map(renderListItem),
    `</agent_context>`,
  ].join('\n');
}

// Migration package/name come from arbitrary user-authored package.json /
// migrations.json — a name with `"` / `<` / `>` / `&` would produce malformed
// XML the outer agent can't parse. `'` is not strictly required for
// double-quoted attribute values but is included for defense.
function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
