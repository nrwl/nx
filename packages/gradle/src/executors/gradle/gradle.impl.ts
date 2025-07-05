import { ExecutorContext } from '@nx/devkit';
import { GradleExecutorSchema } from './schema';
import { findGradlewFile } from '../../utils/exec-gradle';
import { dirname, join } from 'node:path';
import runCommandsImpl from 'nx/src/executors/run-commands/run-commands.impl';
import { getExcludeTasks } from './get-exclude-task';

export default async function gradleExecutor(
  options: GradleExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  let projectRoot =
    context.projectGraph.nodes[context.projectName]?.data?.root ?? context.root;
  let gradlewPath = findGradlewFile(join(projectRoot, 'project.json')); // find gradlew near project root
  gradlewPath = join(context.root, gradlewPath);

  let args =
    typeof options.args === 'string'
      ? options.args.trim().split(' ')
      : Array.isArray(options.args)
      ? options.args
      : [];
  if (options.testClassName) {
    args.push(`--tests`, options.testClassName);
  }

  getExcludeTasks(
    new Set([`${context.projectName}:${context.targetName}`]),
    context.projectGraph.nodes
  ).forEach((task) => {
    if (task) {
      args.push('--exclude-task', task);
    }
  });

  try {
    const { success } = await runCommandsImpl(
      {
        command: `${gradlewPath} ${options.taskName}`,
        cwd: dirname(gradlewPath),
        args: args,
        __unparsed__: [],
      },
      context
    );
    return { success };
  } catch (e) {
    return { success: false };
  }
}
