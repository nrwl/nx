import { run } from '../src/command-line/run';
import { Task } from '../src/config/task-graph';
import { appendFileSync, openSync, writeFileSync, closeSync } from 'fs';
import { addCommandPrefixIfNeeded } from '../src/utils/add-command-prefix';
import { ProjectGraph } from '../src/config/project-graph';
import { messageParent } from 'jest-worker';

setUpOutputWatching();

process.env.NX_CLI_SET = 'true';

interface ExecuteTaskOptions {
  workspaceRoot: string;
  outputPath: string;
  streamOutput: boolean;
  captureStderr: boolean;
  projectGraph?: ProjectGraph;
}

let state:
  | (ExecuteTaskOptions & {
      currentTask: Task;
      onlyStdout: string[];
      logFileHandle: number;
    })
  | undefined;

export async function executeTask(
  task: Task,
  options: ExecuteTaskOptions
): Promise<{ statusCode: number; error?: string }> {
  state = {
    currentTask: task,
    onlyStdout: [],
    logFileHandle: openSync(options.outputPath, 'w'),
    ...options,
  };

  try {
    const statusCode = await run(
      process.cwd(),
      options.workspaceRoot,
      task.target,
      task.overrides,
      task.overrides['verbose'] === true,
      false,
      options.projectGraph
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
  const stdoutWritev = process.stdout._writev;
  const stderrWrite = process.stderr._write;
  const stderrWritev = process.stderr._writev;

  process.stdout._write = (chunk, encoding, callback) => {
    if (state) {
      state.onlyStdout.push(chunk);
      appendFileSync(state.logFileHandle, chunk);
    }

    if (state?.streamOutput) {
      const updatedChunk = addCommandPrefixIfNeeded(
        state.currentTask.target.project,
        chunk,
        encoding
      );
      messageParent(['stdout', updatedChunk.content]);
      stdoutWrite.apply(process.stdout, [
        updatedChunk.content,
        updatedChunk.encoding,
        callback,
      ]);
    } else {
      callback();
    }
  };

  if (stdoutWritev) {
    process.stdout._writev = (chunks, callback) => {
      if (state) {
        for (const { chunk, encoding } of chunks) {
          state.onlyStdout.push(chunk);
          appendFileSync(state.logFileHandle, chunk, { encoding: encoding });
        }
      }

      if (state?.streamOutput) {
        const updatedChunks = chunks.map(({ chunk, encoding }) =>
          addCommandPrefixIfNeeded(
            state.currentTask.target.project,
            chunk,
            encoding
          )
        );
        for (const { content } of updatedChunks) {
          messageParent(['stdout', content]);
        }

        stdoutWritev.apply(process.stdout, [updatedChunks, callback]);
      } else {
        callback();
      }
    };
  }

  process.stderr._write = (chunk, encoding, callback) => {
    if (state) {
      appendFileSync(state.logFileHandle, chunk);
    }

    if (state?.streamOutput) {
      const updatedChunk = addCommandPrefixIfNeeded(
        state.currentTask.target.project,
        chunk,
        encoding
      );
      messageParent(['stderr', updatedChunk.content]);
      stderrWrite.apply(process.stderr, [
        updatedChunk.content,
        updatedChunk.encoding,
        callback,
      ]);
    } else {
      callback();
    }
  };

  if (stderrWritev) {
    process.stderr._writev = (chunks, callback) => {
      if (state) {
        for (const { chunk, encoding } of chunks) {
          appendFileSync(state.logFileHandle, chunk, { encoding: encoding });
        }
      }

      if (state?.streamOutput) {
        const updatedChunks = chunks.map(({ chunk, encoding }) =>
          addCommandPrefixIfNeeded(
            state.currentTask.target.project,
            chunk,
            encoding
          )
        );
        for (const { content } of updatedChunks) {
          messageParent(['stderr', content]);
        }

        stderrWritev.apply(process.stderr, [updatedChunks, callback]);
      } else {
        callback();
      }
    };
  }
}
