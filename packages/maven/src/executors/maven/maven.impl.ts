import { ExecutorContext, workspaceRoot } from '@nx/devkit';
import runCommandsImpl from 'nx/src/executors/run-commands/run-commands.impl';
import { MavenExecutorSchema } from './schema';
import {
  detectMavenExecutable,
  isMaven4,
} from '../../utils/detect-maven-executable';

const nxMavenApplyGoal = 'dev.nx.maven:nx-maven-plugin:apply';
const nxMavenRecordGoal = 'dev.nx.maven:nx-maven-plugin:record';

/**
 * Get the Maven project coordinates (groupId:artifactId) from project metadata.
 * Falls back to the Nx project name if metadata is not available.
 */
function getMavenProjectName(context: ExecutorContext): string {
  const projectConfig =
    context.projectGraph?.nodes?.[context.projectName]?.data;
  return (
    (projectConfig?.metadata as Record<string, string>)?.mavenProject ||
    context.projectName
  );
}

/**
 * Build Maven command arguments
 */
function buildMavenArgs(
  options: MavenExecutorSchema,
  projectName: string,
  useMaven4: boolean
): string[] {
  const args: string[] = [];

  // Verbose flags
  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    args.push('-X', '-e');
  }

  // Never update snapshots (faster builds)
  args.push('-nsu');

  // Non-recursive - only build the specified project (Maven 4.x only)
  // Maven 3.x needs to scan modules to find projects
  if (useMaven4) {
    args.push('-N');
  }

  // Project selector - always pass the project
  args.push('-pl', projectName);

  // Goals with apply/record wrappers
  if (options.goals) {
    const goals = Array.isArray(options.goals)
      ? options.goals
      : options.goals.split(' ');
    args.push(nxMavenApplyGoal);
    args.push(...goals);
    args.push(nxMavenRecordGoal);
  }

  // Additional args from options
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
  const mavenProject = getMavenProjectName(context);
  const useMaven4 = isMaven4(workspaceRoot);
  const args = buildMavenArgs(options, mavenProject, useMaven4);

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
