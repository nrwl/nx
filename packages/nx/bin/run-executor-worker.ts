import { run } from '../src/command-line/run';
import { Task } from '../src/config/task-graph';
import { appendFileSync, openSync, writeFileSync, closeSync } from 'fs';
import { addCommandPrefixIfNeeded } from '../src/utils/add-command-prefix';

setUpOutputWatching();

process.env.NX_CLI_SET = 'true';

interface ExecuteTaskOptions {
  workspaceRoot: string;
  outputPath?: string;
  streamOutput?: boolean;
  captureStderr?: boolean;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

let state:
  | {
      currentTask: Task;
      onlyStdout: string[];
      currentOptions: ExecuteTaskOptions;
      outputPath: string;
      streamOutput: boolean;
      captureStderr: boolean;
      logFileHandle?: number;
    }
  | undefined;

export async function executeTask(
  task: Task,
  options: ExecuteTaskOptions
): Promise<{ statusCode: number; error?: string }> {
  state = {
    currentTask: task,
    onlyStdout: [],
    currentOptions: options,
    outputPath: options.outputPath,
    streamOutput: options.streamOutput ?? false,
    captureStderr: options.captureStderr ?? false,
  };

  try {
    const statusCode = await run(
      process.cwd(),
      options.workspaceRoot,
      task.target,
      task.overrides,
      task.overrides['verbose'] === true,
      false
    );

    // when the process exits successfully, and we are not asked to capture stderr
    // override the file with only stdout
    if (statusCode === 0 && !state.captureStderr && state.outputPath) {
      writeFileSync(state.outputPath, state.onlyStdout.join(''));
    }

    return { statusCode };
  } catch (e) {
    console.error(e.toString());
    return { statusCode: 1, error: e.toString() };
  } finally {
    if (state.logFileHandle) {
      closeSync(state.logFileHandle);
    }
    state = undefined;
  }
}

/**
 * We need to collect all stdout and stderr and store it, so the caching mechanism
 * could store it.
 *
 * Writing stdout and stderr into different streams is too risky when using TTY.
 *
 * So we are simply monkey-patching the Javascript object. In this case the actual output will always be correct.
 * And the cached output should be correct unless the CLI bypasses process.stdout or console.log and uses some
 * C-binary to write to stdout.
 */
function setUpOutputWatching() {
  const stdoutWrite = process.stdout._write;
  const stderrWrite = process.stderr._write;

  process.stdout._write = (
    chunk: any,
    encoding: string,
    callback: Function
  ) => {
    state?.onlyStdout.push(chunk);
    if (state?.outputPath) {
      if (!state.logFileHandle) {
        state.logFileHandle = openSync(state.outputPath, 'w');
      }
      appendFileSync(state.logFileHandle, chunk);
    }
    if (state?.streamOutput) {
      const updatedChunk = addCommandPrefixIfNeeded(
        state.currentTask.target.project,
        chunk,
        encoding
      );
      state.currentOptions?.onStdout?.(chunk);
      stdoutWrite.apply(process.stdout, [
        updatedChunk.content,
        updatedChunk.encoding,
        callback,
      ]);
    } else {
      callback();
    }
  };

  process.stderr._write = (
    chunk: any,
    encoding: string,
    callback: Function
  ) => {
    if (state?.outputPath) {
      if (!state.logFileHandle) {
        state.logFileHandle = openSync(state.outputPath, 'w');
      }
      appendFileSync(state.logFileHandle, chunk);
    }
    if (state?.streamOutput) {
      const updatedChunk = addCommandPrefixIfNeeded(
        state.currentTask.target.project,
        chunk,
        encoding
      );
      state.currentOptions?.onStderr?.(chunk);
      stderrWrite.apply(process.stderr, [
        updatedChunk.content,
        updatedChunk.encoding,
        callback,
      ]);
    } else {
      callback();
    }
  };
}
