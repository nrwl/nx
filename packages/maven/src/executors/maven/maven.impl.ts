import { ExecutorContext, workspaceRoot } from '@nx/devkit';
import runCommandsImpl from 'nx/src/executors/run-commands/run-commands.impl';
import { MavenExecutorSchema } from './schema';
import { detectMavenExecutable } from '../../utils/detect-maven-executable';

const nxMavenApplyGoal = 'dev.nx.maven:nx-maven-plugin:apply';
const nxMavenRecordGoal = 'dev.nx.maven:nx-maven-plugin:record';

/**
 * Build Maven command arguments
 */
function buildMavenArgs(options: MavenExecutorSchema): string[] {
  const args: string[] = [];

  if (options.phase) {
    args.push(options.phase);
  }

  if (options.goals) {
    const goals = Array.isArray(options.goals)
      ? options.goals
      : options.goals.split(' ');
    args.push(nxMavenApplyGoal);
    args.push(...goals);
    args.push(nxMavenRecordGoal);
  }

  if (options.args) {
    const additionalArgs = Array.isArray(options.args)
      ? options.args
      : options.args.trim().split(' ');
    args.push(...additionalArgs.filter((arg) => arg.length > 0));
  }

  return args;
}

/**
 * Maven single-task executor
 */
export default async function mavenExecutor(
  options: MavenExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const mavenExecutable = detectMavenExecutable(workspaceRoot);
  const args = buildMavenArgs(options);

  return runCommandsImpl(
    {
      command: mavenExecutable,
      cwd: workspaceRoot,
      args,
      __unparsed__: options.__unparsed__ || [],
    },
    context
  );
}
