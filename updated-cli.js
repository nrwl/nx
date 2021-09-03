'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const fs_1 = require('fs');
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
    console.log(
      'INDEX file',
      fs_1.lstatSync('node_modules/@nrwl/tao/index.js')
    );
    console.log('deleting require cache', process.env.NX_WORKSPACE_ROOT);
    console.log('requiring', require.resolve('@nrwl/tao/index.js'));
    console.log(
      'requiring with paths',
      require.resolve('@nrwl/tao/index.js', {
        paths: [process.env.NX_WORKSPACE_ROOT],
      })
    );

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
function setUpOutputWatching(captureStderr, forwardOutput) {
  const stdoutWrite = process.stdout._write;
  const stderrWrite = process.stderr._write;
  let out = [];
  let outWithErr = [];
  process.stdout._write = (chunk, encoding, callback) => {
    out.push(chunk.toString());
    outWithErr.push(chunk.toString());
    if (forwardOutput) {
      stdoutWrite.apply(process.stdout, [chunk, encoding, callback]);
    } else {
      callback();
    }
  };
  process.stderr._write = (chunk, encoding, callback) => {
    outWithErr.push(chunk.toString());
    if (forwardOutput) {
      stderrWrite.apply(process.stderr, [chunk, encoding, callback]);
    } else {
      callback();
    }
  };
  process.on('exit', (code) => {
    if (code === 0) {
      fs_1.writeFileSync(
        process.env.NX_TERMINAL_OUTPUT_PATH,
        captureStderr ? outWithErr.join('') : out.join('')
      );
    } else {
      fs_1.writeFileSync(
        process.env.NX_TERMINAL_OUTPUT_PATH,
        outWithErr.join('')
      );
    }
  });
}
//# sourceMappingURL=run-cli.js.map
