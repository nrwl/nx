import { ExecutorContext } from '@nx/devkit';
import { GraldewExecutorSchema } from './schema';
import { execGradleAsync, findGraldewFile } from '../../utils/exec-gradle';

export default async function graldewExecutor(
  options: GraldewExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const root = context.root;
  const gradlewPath = findGraldewFile(root);
  try {
    const output = await execGradleAsync(gradlewPath, [
      options.taskName,
      ...options.args,
    ]);

    process.stdout.write(output);
    return { success: true };
  } catch (e) {
    process.stdout.write(e);
    return { success: false };
  }
}
