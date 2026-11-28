import type { Circus } from '@jest/types';
import { rmSync } from 'fs';
import NodeEnvironment from 'jest-environment-node';
import { isCI } from 'nx/src/utils/is-ci';
import { join, relative } from 'path';
import { workspaceRoot } from '@nx/devkit';
import {
  CastRecorder,
  e2eRecordingsDir,
  isE2ERecordingEnabled,
} from './cast-recorder';
import { embedCastForLog } from './cast-embed';

/**
 * Records each test into `tmp/e2e-recordings/<test file>/<test name>.cast`
 * unless `NX_E2E_RECORD=false`. Keeps failing tests (with a report) and passing
 * tests slower than `NX_E2E_RECORD_SLOW_SECONDS` (default 120); on CI the kept
 * recording is also embedded in the log.
 */
export default class RecordingEnvironment extends NodeEnvironment {
  private readonly testFile: string;

  constructor(
    ...[config, context]: ConstructorParameters<typeof NodeEnvironment>
  ) {
    super(config, context);
    this.testFile = relative(workspaceRoot, context.testPath);
  }

  async handleTestEvent(event: Circus.Event) {
    if (!isE2ERecordingEnabled()) return;

    if (event.name === 'test_start') {
      const name = fullTestName(event.test);
      this.global.__nxE2ERecorder = new CastRecorder(
        join(e2eRecordingsDir, this.testFile, `${safeFileName(name)}.cast`),
        80,
        24,
        name
      );
    } else if (event.name === 'test_skip' || event.name === 'test_todo') {
      const recorder = this.global.__nxE2ERecorder as CastRecorder | undefined;
      this.global.__nxE2ERecorder = undefined;
      if (recorder) rmSync(recorder.filePath, { force: true });
    } else if (event.name === 'test_done') {
      const recorder = this.global.__nxE2ERecorder as CastRecorder | undefined;
      this.global.__nxE2ERecorder = undefined;
      if (recorder) {
        process.stderr.write(await keepOrDiscard(recorder, event.test));
      }
    }
  }
}

async function keepOrDiscard(
  recorder: CastRecorder,
  test: Circus.TestEntry
): Promise<string> {
  const name = fullTestName(test);
  let summary: string;
  if (test.errors.length > 0) {
    // Runs after the test already failed; a recorder error must not hide that failure.
    try {
      summary = `━━━ e2e recording: ${name} ━━━\n${await recorder.failureReport()}`;
    } catch (e) {
      summary = `━━━ e2e recording: ${name} ━━━\nCould not build the recording report: ${e}\nRecording: ${recorder.filePath}`;
    }
  } else {
    const seconds = recorder.elapsed();
    if (seconds < slowTestSeconds()) {
      rmSync(recorder.filePath, { force: true });
      return '';
    }
    summary = `━━━ e2e recording kept: ${name} took ${Math.round(seconds)}s ━━━\nRecording: ${recorder.filePath}`;
  }
  const embedded = isCI() ? `\n${embedCastForLog(recorder.filePath)}` : '';
  return `\n${summary}${embedded}\n\n`;
}

function slowTestSeconds(): number {
  return Number(process.env.NX_E2E_RECORD_SLOW_SECONDS) || 120;
}

function fullTestName(test: Circus.TestEntry): string {
  const names = [test.name];
  for (let block = test.parent; block?.parent; block = block.parent) {
    names.unshift(block.name);
  }
  return names.join(' › ');
}

function safeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 150);
}
