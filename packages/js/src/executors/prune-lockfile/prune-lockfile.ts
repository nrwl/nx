import {
  detectPackageManager,
  type ExecutorContext,
  logger,
  parseTargetString,
  type ProjectGraph,
  readJsonFile,
  workspaceRoot,
} from '@nx/devkit';
import { type PruneLockfileOptions } from './schema';
import { existsSync, lstatSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { interpolate } from 'nx/src/tasks-runner/utils';
import { type PackageJson } from 'nx/src/utils/package-json';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  createLockFile,
  getLockFileName,
} from 'nx/src/plugins/js/lock-file/lock-file';

export default async function pruneLockfileExecutor(
  schema: PruneLockfileOptions,
  context: ExecutorContext
) {
  logger.log('Pruning lockfile...');
  const outputDirectory = getOutputDir(schema, context);
  const packageJson = getPackageJson(schema, context);
  const { lockfileName, lockfile } = createPrunedLockfile(
    packageJson,
    context.projectGraph
  );
  writeFileSync(join(outputDirectory, lockfileName), lockfile);
  logger.log('Lockfile pruned.');
  logger.log('Success!');
  return {
    success: true,
  };
}

function createPrunedLockfile(packageJson: PackageJson, graph: ProjectGraph) {
  const packageManager = detectPackageManager(workspaceRoot);
  const lockfileName = getLockFileName(packageManager);
  const lockfile = createLockFile(packageJson, graph, packageManager);
  return {
    lockfileName,
    lockfile,
  };
}

function getPackageJson(
  schema: PruneLockfileOptions,
  context: ExecutorContext
) {
  const target = parseTargetString(schema.buildTarget, context);
  const project = context.projectGraph.nodes[target.project].data;
  const packageJsonPath = join(workspaceRoot, project.root, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new Error(`${packageJsonPath} does not exist.`);
  }

  const packageJson = readJsonFile(packageJsonPath);
  return packageJson;
}

function getOutputDir(schema: PruneLockfileOptions, context: ExecutorContext) {
  let outputDir = schema.outputPath;
  if (outputDir) {
    outputDir = normalizeOutputPath(outputDir);
    if (existsSync(outputDir)) {
      return outputDir;
    }
  }
  const target = parseTargetString(schema.buildTarget, context);
  const project = context.projectGraph.nodes[target.project].data;
  const buildTarget = project.targets[target.target];
  let maybeOutputPath =
    buildTarget.outputs?.[0] ??
    buildTarget.options.outputPath ??
    buildTarget.options.outputDir;

  if (!maybeOutputPath) {
    throw new Error(
      `Could not infer an output directory from the '${schema.buildTarget}' target. Please provide 'outputPath'.`
    );
  }

  maybeOutputPath = interpolate(maybeOutputPath, {
    workspaceRoot,
    projectRoot: project.root,
    projectName: project.name,
    options: {
      ...(buildTarget.options ?? {}),
    },
  });

  outputDir = normalizeOutputPath(maybeOutputPath);
  if (!existsSync(outputDir)) {
    throw new Error(
      `The output directory '${outputDir}' inferred from the '${schema.buildTarget}' target does not exist.\nPlease ensure a build has run first, and that the path is correct. Otherwise, please provide 'outputPath'.`
    );
  }
  return outputDir;
}

function normalizeOutputPath(outputPath: string) {
  if (!outputPath.startsWith(workspaceRoot)) {
    outputPath = join(workspaceRoot, outputPath);
  }
  if (!lstatSync(outputPath).isDirectory()) {
    outputPath = dirname(outputPath);
  }
  return outputPath;
}
