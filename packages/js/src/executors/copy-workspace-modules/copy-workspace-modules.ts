import {
  type ExecutorContext,
  logger,
  parseTargetString,
  type ProjectGraph,
  readJsonFile,
  workspaceRoot,
} from '@nx/devkit';
import { interpolate } from 'nx/src/tasks-runner/utils';
import { type CopyWorkspaceModulesOptions } from './schema';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'path';
import { lstatSync } from 'fs';

export default async function copyWorkspaceModules(
  schema: CopyWorkspaceModulesOptions,
  context: ExecutorContext
) {
  logger.log('Copying Workspace Modules to Build Directory...');
  const outputDirectory = getOutputDir(schema, context);
  const packageJson = getPackageJson(schema, context);
  createWorkspaceModules(outputDirectory);
  handleWorkspaceModules(outputDirectory, packageJson, context.projectGraph);
  logger.log('Success!');
  return { success: true };
}

function handleWorkspaceModules(
  outputDirectory: string,
  packageJson: {
    dependencies?: Record<string, string>;
  },
  projectGraph: ProjectGraph
) {
  if (!packageJson.dependencies) {
    return;
  }

  for (const [pkgName, pkgVersion] of Object.entries(
    packageJson.dependencies
  )) {
    if (pkgVersion.startsWith('workspace:') || pkgVersion.startsWith('file:')) {
      logger.verbose(`Copying ${pkgName}.`);
      const workspaceModuleProject = getProjectForWorkspaceModule(
        pkgName,
        projectGraph
      );
      const workspaceModuleRoot = workspaceModuleProject.data.root;
      const newWorkspaceModulePath = join(
        outputDirectory,
        'workspace_modules',
        pkgName
      );
      mkdirSync(newWorkspaceModulePath, { recursive: true });
      cpSync(workspaceModuleRoot, newWorkspaceModulePath, {
        filter: (src) => !src.includes('node_modules'),
        recursive: true,
      });
      logger.verbose(`Copied ${pkgName} successfully.`);
    }
  }
}

function getProjectForWorkspaceModule(
  pkgName: string,
  projectGraph: ProjectGraph
) {
  let maybeProjectNode = projectGraph.nodes[pkgName];
  if (maybeProjectNode) {
    return maybeProjectNode;
  }

  for (const [projectName, project] of Object.entries(projectGraph.nodes)) {
    if (project.data.metadata.js.packageName === pkgName) {
      return project;
    }
  }
}

function createWorkspaceModules(outputDirectory: string) {
  mkdirSync(join(outputDirectory, 'workspace_modules'), { recursive: true });
}

function getPackageJson(
  schema: CopyWorkspaceModulesOptions,
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

function getOutputDir(
  schema: CopyWorkspaceModulesOptions,
  context: ExecutorContext
) {
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
