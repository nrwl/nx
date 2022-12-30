import { execSync } from 'child_process';
import { getPackageManagerCommand } from '../../utils/package-manager';
import type { ExecutorContext } from '../../config/misc-interfaces';
import * as path from 'path';

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
    execSync(pm.run(options.script, options.__unparsed__.join(' ')), {
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
