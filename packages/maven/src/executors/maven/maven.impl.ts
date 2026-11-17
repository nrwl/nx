import { existsSync } from 'fs';
import { basename, join } from 'path';
import {
  ExecutorContext,
  getOutputsForTargetAndConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { runCommandsExecutor as runCommandsImpl } from '@nx/devkit/internal';
import { MavenExecutorSchema } from './schema';
import {
  detectMavenExecutable,
  isMaven4,
} from '../../utils/detect-maven-executable';

const nxMavenApplyGoal = 'dev.nx.maven:nx-maven-plugin:apply';
const nxMavenRecordGoal = 'dev.nx.maven:nx-maven-plugin:record';
const buildStateFile = 'nx-build-state.json';

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

// Without goals, Maven would only re-apply and re-record the module's build state.
// Skip it when this task hashes that file and it exists, so its cache entry still holds it.
// Pom modules always run: Maven 4 copies their POM into the project-local repository.
function canSkipMaven(
  options: MavenExecutorSchema,
  context: ExecutorContext
): boolean {
  if (
    !Array.isArray(options.goals) ||
    options.goals.length > 0 ||
    options.args?.length ||
    options.__unparsed__?.length ||
    // MAVEN_ARGS can add goals.
    process.env.MAVEN_ARGS?.trim()
  ) {
    return false;
  }

  const node = context.projectGraph?.nodes?.[context.projectName];
  if (!node || node.data.tags?.includes('maven:pom')) {
    return false;
  }

  const target = node.data.targets?.[context.targetName];
  const ownState = target?.outputs?.find(
    (output) => basename(output) === buildStateFile
  );
  const hashesOwnState = target?.inputs?.some(
    (input) =>
      typeof input === 'object' &&
      'fileset' in input &&
      input.fileset === ownState &&
      input.includeIgnored === true &&
      !('dependencies' in input && input.dependencies)
  );
  if (!ownState || !hashesOwnState) {
    return false;
  }

  const stateFile = getOutputsForTargetAndConfiguration(
    {
      project: context.projectName,
      target: context.targetName,
      configuration: context.configurationName,
    },
    {},
    node
  ).find((output) => basename(output) === buildStateFile);
  return !!stateFile && existsSync(join(context.root, stateFile));
}

/**
 * Maven single-task executor
 */
export default async function mavenExecutor(
  options: MavenExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  if (canSkipMaven(options, context)) {
    return { success: true };
  }

  const mavenExecutable = detectMavenExecutable(workspaceRoot);
  const mavenProject = getMavenProjectName(context);
  const useMaven4 = isMaven4(workspaceRoot);
  const args = buildMavenArgs(options, mavenProject, useMaven4);

  return runCommandsImpl(
    {
      command: mavenExecutable,
      cwd: workspaceRoot,
      args,
      // The apply goal bounds restored paths by this root, which `-f` would otherwise move.
      env: { NX_WORKSPACE_ROOT: workspaceRoot },
      __unparsed__: options.__unparsed__ || [],
    },
    context
  );
}
