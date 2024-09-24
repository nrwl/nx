import * as path from 'path';
import type { ExecutorContext } from '../../config/misc-interfaces';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { execSync } from 'child_process';
import {
  getPseudoTerminal,
  PseudoTerminal,
} from '../../tasks-runner/pseudo-terminal';

export interface RunScriptOptions {
  script: string;
  __unparsed__: string[];
}

export default async function (
  options: RunScriptOptions,
  context: ExecutorContext
) {
  const pm = getPackageManagerCommand();
  try {
    let command = pm.run(options.script, options.__unparsed__.join(' '));
    let cwd = path.join(
      context.root,
      context.projectsConfigurations.projects[context.projectName].root
    );

    let env = process.env;
    // when running nx through npx with node_modules installed with npm, the path gets modified to include the full workspace path with the node_modules folder
    // This causes issues when running in a pty process, so we filter out the node_modules paths from the PATH
    // Since the command here will be run with the package manager script command, the path will be modified again within the PTY process itself.
    let filteredPath =
      env.PATH?.split(path.delimiter)
        .filter((p) => !p.startsWith(path.join(context.root, 'node_modules')))
        .join(path.delimiter) ?? '';
    env.PATH = filteredPath;

    if (PseudoTerminal.isSupported()) {
      await ptyProcess(command, cwd, env);
    } else {
      nodeProcess(command, cwd, env);
    }
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

function nodeProcess(
  command: string,
  cwd: string,
  env: Record<string, string>
) {
  execSync(command, {
    stdio: ['inherit', 'inherit', 'inherit'],
    cwd,
    env,
    windowsHide: true,
  });
}

async function ptyProcess(
  command: string,
  cwd: string,
  env: Record<string, string>
) {
  const terminal = getPseudoTerminal();

  return new Promise<void>((res, rej) => {
    const cp = terminal.runCommand(command, { cwd, jsEnv: env });
    cp.onExit((code) => {
      if (code === 0) {
        res();
      } else if (code >= 128) {
        process.exit(code);
      } else {
        rej();
      }
    });
  });
}
