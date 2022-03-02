import { execSync } from 'child_process';
import { getPackageManagerCommand } from '@nrwl/devkit';
import type { ExecutorContext } from '@nrwl/devkit';
import * as path from 'path';
import { env as appendLocalEnv } from 'npm-run-path';

export interface RunScriptOptions {
  script: string;
  color?: boolean;
}

export default async function (
  options: RunScriptOptions,
  context: ExecutorContext
) {
  const pm = getPackageManagerCommand();
  const script = options.script;
  const color = options.color;
  delete options.script;
  delete options.color;

  const args = [];
  Object.keys(options).forEach((r) => {
    args.push(`--${r}=${options[r]}`);
  });

  try {
    execSync(pm.run(script, args.join(' ')), {
      env: processEnv(color),
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

function processEnv(color: boolean) {
  const env = {
    ...process.env,
    ...appendLocalEnv(),
  };

  if (color) {
    env.FORCE_COLOR = `${color}`;
  }
  return env;
}
