import {
  escapeXmlBody,
  filterNonEmptyStrings,
  renderListItem,
} from './prompts/shared-rendering';

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
  // Migration metadata and agentContext entries are user-authored (migrations
  // are published by third-party packages); escape any `<` / `&` so a hostile
  // value can't break out of the surrounding XML-framed block. The agent
  // reads `&lt;/agent_context&gt;` as literal text, not a closing tag.
  const safeName = escapeXmlBody(input.migration.name);
  const safePrompt = input.migration.prompt
    ? escapeXmlBody(input.migration.prompt)
    : undefined;
  const preamble = safePrompt
    ? `ℹ Hints from the ${safeName} generator for the AI agent driving this run, when applying ${safePrompt}:`
    : `ℹ Hints from the ${safeName} generator for the AI agent driving this run:`;
  return [
    preamble,
    ``,
    `<agent_context migration="${escapeXmlAttr(id)}">`,
    ...entries.map((entry) => renderListItem(escapeXmlBody(entry))),
    `</agent_context>`,
  ].join('\n');
}

// Migration package/name come from arbitrary user-authored package.json /
// migrations.json — a name with `"` / `<` / `>` / `&` would produce malformed
// XML the outer agent can't parse. `'` is not strictly required for
// double-quoted attribute values but is included for defense.
export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Both the classic loop and the single-migration worker call this only under
 * `agentic.kind === 'inside-agent'`. Under `enabled` the inner agent step
 * consumes `agentContext` through the prompt builders; under `disabled` the
 * run is human-driven and agent-targeted context is only noise.
 */
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
