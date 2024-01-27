import { getPackageManagerCommand } from '../../utils/package-manager';
import type { ExecutorContext } from '../../config/misc-interfaces';
import * as path from 'path';
import { env as appendLocalEnv } from 'npm-run-path';
import { runCommand } from '../../native';
import { PseudoTtyProcess } from '../../utils/child-process';
import { signalToCode } from '../../utils/exit-codes';

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
    await new Promise<void>((res, rej) => {
      const cp = new PseudoTtyProcess(
        runCommand(
          pm.run(options.script, options.__unparsed__.join(' ')),
          path.join(
            context.root,
            context.projectsConfigurations.projects[context.projectName].root
          ),
          {
            ...process.env,
            ...appendLocalEnv(),
          }
        )
      );
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
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}
