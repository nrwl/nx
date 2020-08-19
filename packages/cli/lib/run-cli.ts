import * as path from 'path';
import * as fs from 'fs';
import { findWorkspaceRoot } from './find-workspace-root';

const workspace = findWorkspaceRoot(process.cwd());

if (process.env.NX_TERMINAL_OUTPUT_PATH) {
  setUpOutputWatching(
    process.env.NX_TERMINAL_CAPTURE_STDERR === 'true',
    process.env.NX_FORWARD_OUTPUT === 'true'
  );
}
requireCli();

function requireCli() {
  process.env.NX_CLI_SET = 'true';
  if (workspace.type === 'nx') {
    require(path.join(
      workspace.dir,
      'node_modules',
      '@nrwl',
      'tao',
      'index.js'
    ));
  } else {
    require(path.join(
      workspace.dir,
      'node_modules',
      '@angular',
      'cli',
      'lib',
      'init.js'
    ));
  }
}

function writeToDisk(forwardOutput: boolean, outWithErr: any[]) {
  if (!forwardOutput) {
    fs.writeFileSync(process.env.NX_TERMINAL_OUTPUT_PATH, outWithErr.join(''));
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

  process.on('exit', (code) => {
    if (code === 0) {
      fs.writeFileSync(
        process.env.NX_TERMINAL_OUTPUT_PATH,
        captureStderr ? outWithErr.join('') : out.join('')
      );
    } else {
      writeToDisk(forwardOutput, outWithErr);
    }
  });

  process.on('SIGTERM', () => {
    process.exit(15);
  });
}
