import { workspaceRoot } from '@nx/devkit';
import { Terminal } from '@xterm/headless';
import { appendFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export const e2eRecordingsDir = join(workspaceRoot, 'tmp', 'e2e-recordings');

export function isE2ERecordingEnabled() {
  return process.env.NX_E2E_RECORD !== 'false';
}

/** The recording for the running test, set by `recording-environment.ts`. */
export function getE2ERecorder(): CastRecorder | undefined {
  return globalThis.__nxE2ERecorder;
}

/** Records a piped (non-PTY) command into the running test's recording, if any. */
export function recordCommand(command: string) {
  const recorder = getE2ERecorder();
  if (!recorder) return undefined;
  const entry = recorder.startCommand(command);
  return {
    output: (data: string | undefined) =>
      recorder.output(data ?? '', { piped: true }),
    end: (exitCode: number | string) => recorder.endCommand(entry, exitCode),
  };
}

interface RecordedCommand {
  command: string;
  startEvent: number;
  startSeconds: number;
  exitCode?: number | string;
  durationSeconds?: number;
}

/** Writes an asciicast v2 file: https://docs.asciinema.org/manual/asciicast/v2/ */
export class CastRecorder {
  readonly commands: RecordedCommand[] = [];
  private readonly start = process.hrtime.bigint();
  private readonly outputs: string[] = [];

  constructor(
    readonly filePath: string,
    readonly width = 80,
    readonly height = 24,
    title?: string
  ) {
    mkdirSync(dirname(filePath), { recursive: true });
    const header = {
      version: 2,
      width,
      height,
      timestamp: Math.floor(Date.now() / 1000),
      idle_time_limit: 2,
      ...(title ? { title } : {}),
    };
    writeFileSync(filePath, JSON.stringify(header) + '\n');
  }

  /** PTY output is written as is; piped output needs `\r\n` line endings. */
  output(data: string, { piped = false } = {}) {
    if (!data) return;
    const chunk = piped ? data.replace(/\r?\n/g, '\r\n') : data;
    this.outputs.push(chunk);
    this.write('o', chunk);
  }

  marker(label: string) {
    this.write('m', label);
  }

  /** Echoes `$ command` as a prompt line, with a marker to seek to it. */
  startCommand(command: string): RecordedCommand {
    const entry: RecordedCommand = {
      command,
      startEvent: this.outputs.length,
      startSeconds: this.elapsed(),
    };
    this.commands.push(entry);
    this.marker(command);
    this.output(`\x1b[1m$ ${command}\x1b[0m\r\n`);
    return entry;
  }

  endCommand(entry: RecordedCommand, exitCode: number | string) {
    entry.exitCode = exitCode;
    entry.durationSeconds = this.elapsed() - entry.startSeconds;
  }

  /** The last screen with content; a TUI clears its screen when it exits. */
  async renderLastScreen(): Promise<string> {
    const from = this.commands.at(-1)?.startEvent ?? 0;
    const term = new Terminal({
      cols: this.width,
      rows: this.height,
      allowProposedApi: true,
    });
    let lastScreen = '';
    for (const chunk of this.outputs.slice(from)) {
      await new Promise<void>((r) => term.write(chunk, r));
      const screen = readScreen(term);
      if (screen.trim()) lastScreen = screen;
    }
    term.dispose();
    return lastScreen;
  }

  async failureReport(): Promise<string> {
    const commandLines = this.commands.map((c) => {
      const status =
        c.exitCode === undefined
          ? 'still running'
          : `${typeof c.exitCode === 'number' ? `exit ${c.exitCode}` : c.exitCode}, ${c.durationSeconds.toFixed(1)}s`;
      return `  ${c.startSeconds.toFixed(1).padStart(6)}s  $ ${c.command}  (${status})`;
    });
    return [
      'Commands run by this test:',
      ...(commandLines.length ? commandLines : ['  (none recorded)']),
      '',
      'Last screen of the last command with content:',
      (await this.renderLastScreen())
        .split('\n')
        .map((l) => `  │ ${l}`)
        .join('\n'),
      '',
      `Recording: ${this.filePath}`,
    ].join('\n');
  }

  elapsed() {
    return Number(process.hrtime.bigint() - this.start) / 1e9;
  }

  // Appends per event so a test that crashes or times out still leaves a usable file.
  private write(code: 'o' | 'm', data: string) {
    appendFileSync(
      this.filePath,
      JSON.stringify([Number(this.elapsed().toFixed(6)), code, data]) + '\n'
    );
  }
}

function readScreen(term: Terminal): string {
  const buffer = term.buffer.active;
  const rows: string[] = [];
  for (let i = buffer.viewportY; i < buffer.viewportY + term.rows; i++) {
    rows.push(buffer.getLine(i)?.translateToString(true) ?? '');
  }
  while (rows.length && !rows.at(-1).trim()) rows.pop();
  return rows.join('\n');
}
