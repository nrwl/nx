import * as path from 'path';
import * as fs from 'fs';
import { findWorkspaceRoot } from './find-workspace-root';

const workspace = findWorkspaceRoot(process.cwd());

if (process.env.NX_TERMINAL_OUTPUT_PATH) {
  setUpOutputWatching();
}
requireCli();

function requireCli() {
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
function setUpOutputWatching() {
  const stdoutWrite = process.stdout._write;
  const stderrWrite = process.stderr._write;

  let out = [];

  process.stdout._write = (
    chunk: any,
    encoding: string,
    callback: Function
  ) => {
    out.push(chunk.toString());
    stdoutWrite.apply(process.stdout, [chunk, encoding, callback]);
  };

  process.stderr._write = (
    chunk: any,
    encoding: string,
    callback: Function
  ) => {
    out.push(chunk.toString());
    stderrWrite.apply(process.stderr, [chunk, encoding, callback]);
  };

  process.on('exit', code => {
    if (code === 0) {
      fs.writeFileSync(process.env.NX_TERMINAL_OUTPUT_PATH, out.join(''));
    }
  });
}
