import { execSync } from 'child_process';
import { getPackageManagerCommand } from '@nrwl/devkit';
import type { ExecutorContext } from '@nrwl/devkit';
import * as path from 'path';

export interface RunScriptOptions {
  script: string;
}

export default async function (
  options: RunScriptOptions,
  context: ExecutorContext
) {
  const pm = getPackageManagerCommand();
  const script = options.script;
  delete options.script;

  const args = [];
  Object.keys(options).forEach((r) => {
    args.push(`--${r}=${options[r]}`);
  });

  try {
    execSync(pm.run(script, args.join(' ')), {
      stdio: ['inherit', 'inherit', 'inherit'],
      cwd: path.join(
        context.root,
        context.workspace.projects[context.projectName].root
      ),
    });
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}
