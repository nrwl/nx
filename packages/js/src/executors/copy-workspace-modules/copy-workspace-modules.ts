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
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'path';
import { lstatSync } from 'fs';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getWorkspacePackagesFromGraph } from 'nx/src/plugins/js/utils/get-workspace-packages-from-graph';

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

  const workspaceModules = getWorkspacePackagesFromGraph(projectGraph);
  const processedModules = new Set<string>();
  const workspaceModulesDir = join(outputDirectory, 'workspace_modules');

  function calculateRelativePath(
    fromPkgName: string,
    toPkgName: string
  ): string {
    const fromPath = join(workspaceModulesDir, fromPkgName);
    const toPath = join(workspaceModulesDir, toPkgName);
    const relativePath = relative(fromPath, toPath);

    // Ensure forward slashes for file: protocol (Windows compatibility)
    return relativePath.split(sep).join('/');
  }

  function processModule(pkgName: string): void {
    if (processedModules.has(pkgName)) {
      logger.verbose(`Skipping ${pkgName} (already processed).`);
      return;
    }

    if (!workspaceModules.has(pkgName)) {
      return;
    }

    processedModules.add(pkgName);

    logger.verbose(`Copying ${pkgName}.`);

    const workspaceModuleProject = workspaceModules.get(pkgName);
    const workspaceModuleRoot = workspaceModuleProject.data.root;
    const newWorkspaceModulePath = join(workspaceModulesDir, pkgName);

    // Copy the module
    mkdirSync(newWorkspaceModulePath, { recursive: true });
    cpSync(workspaceModuleRoot, newWorkspaceModulePath, {
      filter: (src) => !src.includes('node_modules'),
      recursive: true,
    });

    logger.verbose(`Copied ${pkgName} successfully.`);

    // Read the copied module's package.json to process its dependencies
    const copiedPackageJsonPath = join(newWorkspaceModulePath, 'package.json');
    let copiedPackageJson: { dependencies?: Record<string, string> };
    try {
      copiedPackageJson = JSON.parse(
        readFileSync(copiedPackageJsonPath, 'utf-8')
      );
    } catch (e) {
      logger.warn(`Could not read package.json for ${pkgName}: ${e.message}`);
      return;
    }

    // Process and update dependencies
    if (copiedPackageJson.dependencies) {
      let packageJsonModified = false;

      for (const [depName, depVersion] of Object.entries(
        copiedPackageJson.dependencies
      )) {
        if (workspaceModules.has(depName)) {
          const relativePath = calculateRelativePath(pkgName, depName);
          copiedPackageJson.dependencies[depName] = `file:${relativePath}`;
          packageJsonModified = true;
          processModule(depName);
        }
      }

      if (packageJsonModified) {
        writeFileSync(
          copiedPackageJsonPath,
          JSON.stringify(copiedPackageJson, null, 2)
        );
        logger.verbose(
          `Updated package.json for ${pkgName} with relative workspace module paths.`
        );
      }
    }
  }

  // Process all top-level dependencies
  for (const [pkgName] of Object.entries(packageJson.dependencies)) {
    processModule(pkgName);
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
