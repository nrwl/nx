// Internal to run/: deliberately not re-exported from ./index.
//
// The single writer for everything an orchestrated run puts on stdout. Human
// lines and the `<nx_migrate_*>` blocks the driving agent parses share that one
// stream, so a value carrying its own line break could open a forged block.
//
// Two boundaries: a thrown error leaves through handleErrors, which prints it
// outside this guarantee; and migration code is not contained at all (nx
// `require`s and runs it in process), so the guarantee is that data cannot
// corrupt the framing, nothing more.

import { output } from '../../../utils/output';
import { escapeXmlAttr } from '../agentic/print-dropped-agent-context';
import { singleLine } from '../text';

/**
 * Lines are kept unjoined all the way here on purpose. Joining them and
 * splitting them back turns an injected break into its own entry before this
 * module sees it, indistinguishable from a line the caller meant to write, and
 * nothing downstream can undo that.
 */
export interface AgentMessage {
  title: string;
  bodyLines?: string[];
}

/**
 * The safe form of a set of lines. Exported so a caller that needs the same
 * text twice, once for a human and once inside a block payload, derives both
 * from one array instead of sanitizing one copy and not the other.
 */
export function safeLines(lines: readonly string[]): string[] {
  return lines.map(singleLine);
}

function safe(message: AgentMessage): { title: string; bodyLines: string[] } {
  return {
    title: singleLine(message.title),
    bodyLines: safeLines(message.bodyLines ?? []),
  };
}

export function logToAgent(message: AgentMessage): void {
  output.log(safe(message));
}

export function warnToAgent(message: AgentMessage): void {
  output.warn(safe(message));
}

/**
 * Serializes a block payload. `<` becomes its JSON unicode escape so a raw one
 * in a value cannot forge the closing tag, and the result stays valid JSON for
 * the agent to parse.
 */
function blockPayload(payload: object): string {
  return JSON.stringify(payload, null, 2).replace(/</g, '\\u003c');
}

// A bare newline pair frames the block so adjacent stdout cannot run into it.
function writeBlock(
  tag: string,
  attrs: [string, string][],
  body: string
): void {
  const attrText = attrs
    .map(([name, value]) => ` ${name}="${escapeXmlAttr(singleLine(value))}"`)
    .join('');
  process.stdout.write(`\n<${tag}${attrText}>\n${body}\n</${tag}>\n\n`);
}

export function emitStepBlock(
  runId: string,
  stepId: string,
  action: string,
  payload: object
): void {
  writeBlock(
    'nx_migrate_step',
    [
      ['run-id', runId],
      ['step', stepId],
      ['action', action],
    ],
    blockPayload(payload)
  );
}

export function emitPromptBlock(migrationId: string, payload: object): void {
  writeBlock(
    'nx_migrate_prompt',
    [['migration', migrationId]],
    blockPayload(payload)
  );
}

/**
 * Markdown, not JSON: the block carries the runbook file's bytes, so the agent
 * reads what a resume re-emits from disk. Every `<` opening or closing an
 * `<nx_migrate_*>` tag is neutralized wherever it sits: a positional check
 * (line starts plus a blank-character class) can be sidestepped by characters
 * that render as nothing but match no enumerable class. The renderer never
 * emits the literal sequence (runbook.spec pins that), so only tampered bytes
 * change.
 */
export function emitRunbookBlock(runId: string, content: string): void {
  const neutralized = content.replace(/<(?=\/?nx_migrate_)/gi, '\\u003c');
  writeBlock('nx_migrate_runbook', [['run-id', runId]], neutralized);
}
