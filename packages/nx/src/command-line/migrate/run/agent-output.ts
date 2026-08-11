// Internal to run/: deliberately not re-exported from ./index.
//
// The single writer for everything an orchestrated run puts on stdout. Human
// lines and the `<nx_migrate_*>` blocks the driving agent parses share that one
// stream, so a value carrying its own line break could open a forged block. The
// eslint override for run/ bans `utils/output` and `process.stdout.write`
// elsewhere in this directory, which is what keeps that a property of the
// module rather than of whoever writes the next interpolation.
//
// Two things this does not cover, both of which have already produced bugs:
// a thrown error leaves through handleErrors, which splits the message on line
// terminators and prints the pieces itself, and a value read back from run.json
// can reach a command the agent runs rather than a line it reads. So a run.json
// field with a fixed format (an id, a timestamp, a sha, a snapshot file name)
// is validated in run-state.ts and fails the whole read when it does not match;
// only free text relies on this module.
//
// What is deliberately not attempted: nx `require`s and runs migration code in
// process, so a migration that ships code can do anything a forged block could,
// and no amount of sanitizing here changes that. The goal is that data cannot
// corrupt the framing, not that migrations are contained.

import { output } from '../../../utils/output';
import { escapeXmlAttr } from '../agentic/print-dropped-agent-context';
import { singleLine } from '../text';

/**
 * Lines are kept unjoined all the way here on purpose. Joining them and
 * splitting them back, as the dispense path used to, turns an injected break
 * into its own entry before this module sees it, indistinguishable from a line
 * the caller meant to write, and nothing downstream can undo that.
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
  json: string
): void {
  const attrText = attrs
    .map(([name, value]) => ` ${name}="${escapeXmlAttr(value)}"`)
    .join('');
  process.stdout.write(`\n<${tag}${attrText}>\n${json}\n</${tag}>\n\n`);
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
