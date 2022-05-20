import { appendFileSync, openSync, writeFileSync } from 'fs';
import { run } from '../src/command-line/run';
import { addCommandPrefixIfNeeded } from '../src/utils/add-command-prefix';

if (process.env.NX_TERMINAL_OUTPUT_PATH) {
  setUpOutputWatching(
    process.env.NX_TERMINAL_CAPTURE_STDERR === 'true',
    process.env.NX_STREAM_OUTPUT === 'true'
  );
}

if (!process.env.NX_WORKSPACE_ROOT) {
  console.error('Invalid Nx command invocation');
  process.exit(1);
}
let projectName;
requireCli();

function requireCli() {
  process.env.NX_CLI_SET = 'true';
  try {
    const args = JSON.parse(process.argv[2]);
    projectName = args.targetDescription.project;
    run(
      process.cwd(),
      process.env.NX_WORKSPACE_ROOT,
      args.targetDescription,
      args.overrides,
      args.isVerbose,
      false
    )
      .then((statusCode) => {
        process.exit(statusCode);
      })
      .catch((e) => {
        console.error(`Unexpected error`);
        console.error(e);
      });
  } catch (e) {
    console.error(`Could not find 'nx' module in this workspace.`, e);
    process.exit(1);
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
function setUpOutputWatching(captureStderr: boolean, streamOutput: boolean) {
  const stdoutWrite = process.stdout._write;
  const stderrWrite = process.stderr._write;

  // The terminal output file gets out and err
  const outputPath = process.env.NX_TERMINAL_OUTPUT_PATH;
  const stdoutAndStderrLogFileHandle = openSync(outputPath, 'w');

  const onlyStdout = [] as string[];
  process.stdout._write = (
    chunk: any,
    encoding: string,
    callback: Function
  ) => {
    onlyStdout.push(chunk);
    appendFileSync(stdoutAndStderrLogFileHandle, chunk);
    if (streamOutput) {
      const updatedChunk = addCommandPrefixIfNeeded(
        projectName,
        chunk,
        encoding
      );
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
    appendFileSync(stdoutAndStderrLogFileHandle, chunk);
    if (streamOutput) {
      const updatedChunk = addCommandPrefixIfNeeded(
        projectName,
        chunk,
        encoding
      );
      stderrWrite.apply(process.stderr, [
        updatedChunk.content,
        updatedChunk.encoding,
        callback,
      ]);
    } else {
      callback();
    }
  };

  process.on('exit', (code) => {
    // when the process exits successfully, and we are not asked to capture stderr
    // override the file with only stdout
    if (code === 0 && !captureStderr) {
      writeFileSync(outputPath, onlyStdout.join(''));
    }
  });
}
