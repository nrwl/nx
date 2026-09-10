import * as pc from 'picocolors';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import type { BoundedChunks } from './agentic/capture-generator-output';

// What a dependency install or a migration commit tells the user, as the
// calls that would print it. The helpers write through a sink so a caller
// that does not own the terminal can collect the output and have it printed
// elsewhere; the default sink prints where the calls always did.

export type NoticeLevel = 'log' | 'warn' | 'error';
export type LineColor = 'dim' | 'yellow' | 'red';

export interface MigrateOutputSink {
  notice(
    level: NoticeLevel,
    message: { title: string; bodyLines?: string[] }
  ): void;
  line(color: LineColor, text: string): void;
  /** A chunk of a package manager's own output. */
  raw(chunk: string): void;
}

export const terminalOutput: MigrateOutputSink = {
  notice: (level, message) => output[level](message),
  line: (color, text) => logger.info(pc[color](text)),
  raw: (chunk) => process.stdout.write(chunk),
};

export type DeferredOutputRecord =
  | { kind: 'notice'; level: NoticeLevel; title: string; bodyLines?: string[] }
  | { kind: 'line'; color: LineColor; text: string }
  | { kind: 'raw'; text: string };

interface RawBlock {
  kind: 'raw-block';
  buffer: BoundedChunks;
}

/**
 * Collects the output as records that `replayDeferredOutput` prints later.
 * The notices and lines are always kept; package manager output is bounded
 * like generator output and rendered only on request. Render once the output
 * is complete: a rendered collector accepts nothing more.
 */
export class DeferredOutputCollector implements MigrateOutputSink {
  private readonly records: (DeferredOutputRecord | RawBlock)[] = [];
  private rendered = false;

  private assertOpen(): void {
    if (this.rendered) {
      throw new Error('The deferred output was already rendered.');
    }
  }

  notice(
    level: NoticeLevel,
    message: { title: string; bodyLines?: string[] }
  ): void {
    this.assertOpen();
    this.records.push({ kind: 'notice', level, ...message });
  }

  line(color: LineColor, text: string): void {
    this.assertOpen();
    this.records.push({ kind: 'line', color, text });
  }

  raw(chunk: string): void {
    this.assertOpen();
    let block = this.records[this.records.length - 1];
    if (block?.kind !== 'raw-block') {
      // Lazy: the non-agentic migrate path must not load the agentic chain.
      const { BoundedChunks } =
        require('./agentic/capture-generator-output') as typeof import('./agentic/capture-generator-output');
      block = { kind: 'raw-block', buffer: new BoundedChunks() };
      this.records.push(block);
    }
    block.buffer.append(chunk);
  }

  render(rawOutput: 'keep' | 'drop'): DeferredOutputRecord[] {
    this.rendered = true;
    const records: DeferredOutputRecord[] = [];
    for (const record of this.records) {
      if (record.kind !== 'raw-block') {
        records.push(record);
        continue;
      }
      if (rawOutput === 'drop') continue;
      // The replay adds the final newline back.
      const text = record.buffer.render();
      records.push({
        kind: 'raw',
        text: text.endsWith('\n') ? text.slice(0, -1) : text,
      });
    }
    return records;
  }
}

export function replayDeferredOutput(
  records: DeferredOutputRecord[],
  to: MigrateOutputSink = terminalOutput
): void {
  for (const record of records) {
    switch (record.kind) {
      case 'notice':
        to.notice(record.level, {
          title: record.title,
          bodyLines: record.bodyLines,
        });
        break;
      case 'line':
        to.line(record.color, record.text);
        break;
      case 'raw':
        if (record.text) to.raw(`${record.text}\n`);
        break;
      default: {
        const exhaustive: never = record;
        throw new Error(
          `Unhandled output record: ${JSON.stringify(exhaustive)}`
        );
      }
    }
  }
}
