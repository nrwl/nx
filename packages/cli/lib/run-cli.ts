import { writeFileSync } from 'fs';

if (process.env.NX_TERMINAL_OUTPUT_PATH) {
  setUpOutputWatching(
    process.env.NX_TERMINAL_CAPTURE_STDERR === 'true',
    process.env.NX_FORWARD_OUTPUT === 'true'
  );
}

if (!process.env.NX_WORKSPACE_ROOT) {
  console.error('Invalid Nx command invocation');
  process.exit(1);
}
requireCli();

function requireCli() {
  process.env.NX_CLI_SET = 'true';
  try {
    const cli = require.resolve('@nrwl/tao/index.js', {
      paths: [process.env.NX_WORKSPACE_ROOT],
    });
    require(cli);
  } catch (e) {
    console.error(`Could not find @nrwl/tao module in this workspace.`, e);
    process.exit(1);
  }
}

/**
 * We need to collect all stdout and stderr and store it, so the caching mechanism
 * could store it.
 *
 * Writing stdout and stderr into different stream is too risky when using TTY.
 *
 * So we are simply monkey-patching the Javascript object. In this case the actual output will always be correct.
 * And the cached output should be correct unless the CLI bypasses process.stdout or console.log and uses some
 * C-binary to write to stdout.
 */
function setUpOutputWatching(captureStderr: boolean, forwardOutput: boolean) {
  const stdoutWrite = process.stdout._write;
  const stderrWrite = process.stderr._write;

  let out = [];
  let outWithErr = [];

  process.stdout._write = (
    chunk: any,
    encoding: string,
    callback: Function
  ) => {
    out.push(chunk.toString());
    outWithErr.push(chunk.toString());
    if (forwardOutput) {
      stdoutWrite.apply(process.stdout, [chunk, encoding, callback]);
    } else {
      callback();
    }
  };

  process.stderr._write = (
    chunk: any,
    encoding: string,
    callback: Function
  ) => {
    outWithErr.push(chunk.toString());
    if (forwardOutput) {
      stderrWrite.apply(process.stderr, [chunk, encoding, callback]);
    } else {
      callback();
    }
  };

  let fileWritten = false;
  function writeFile(withErrors: boolean) {
    if (!fileWritten) {
      writeFileSync(
        process.env.NX_TERMINAL_OUTPUT_PATH,
        withErrors ? outWithErr.join('') : out.join('')
      );
      fileWritten = true;
    }
  }

  process.on('exit', (code) => {
    if (code === 0) {
      writeFile(captureStderr);
    } else {
      writeFile(true);
    }
  });

  process.on('SIGINT', () => writeFile(true));
  process.on('SIGTERM', () => writeFile(true));
  process.on('SIGHUP', () => writeFile(true));
}
