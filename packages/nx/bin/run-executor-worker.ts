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

// Eat all stdout and stderr and pipe them to parent process/thread.
function setUpOutputWatching() {
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
    }

    callback();
  };
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
    }

    callback();
  };
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
    }

    callback();
  };
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
    }

    callback();
  };
}
