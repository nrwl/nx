import { ExecutorContext } from '@nx/devkit';
import { GraldewExecutorSchema } from './schema';
import { execGradleAsync, findGradlewFile } from '../../utils/exec-gradle';
import { join } from 'node:path';

export default async function graldewExecutor(
  options: GraldewExecutorSchema,
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
  try {
    const output = await execGradleAsync(gradlewPath, [
      options.taskName,
      ...args,
    ]);

    process.stdout.write(output);
    return { success: true };
  } catch (e) {
    process.stdout.write(e);
    return { success: false };
  }
}
