import {
  type ExecutorContext,
  logger,
  parseTargetString,
  type ProjectGraph,
  readJsonFile,
  workspaceRoot,
} from '@nx/devkit';
import { getCatalogManager } from '@nx/devkit/internal';
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
import { stripGlobToBaseDir } from '../../utils/strip-glob-to-base-dir';
import { WORKSPACE_MODULE_INSTALL_SECTIONS } from '../../utils/workspace-module-sections';

type CopiedManifest = {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  [key: string]: unknown;
};

// Sections of a copied module's own manifest whose workspace-module deps are
// rewritten to file: and recursed into. pnpm installs a transitive dependency's
// regular, optional, and auto-installed peer deps (a workspace peer is linked
// and recorded under the depending importer's dependencies in the lockfile), but
// never its devDependencies. A workspace-module peer is moved into dependencies,
// since pnpm rejects a file: spec under peerDependencies (mirrors the app-level
// move in prune-lockfile).
const TRANSITIVE_INSTALL_SECTIONS = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

// Resolve `catalog:` references in a copied module manifest to the version the
// workspace pinned. Only the sections pnpm installs for a `file:` directory
// dependency are resolved: a copied module's devDependencies are never
// installed, so a `catalog:` there is inert (pnpm leaves it untouched), and
// resolving it would abort the whole deploy build if that catalog entry does
// not exist. Returns whether anything changed.
function resolveCatalogReferences(
  packageJson: CopiedManifest,
  manager: ReturnType<typeof getCatalogManager>
): boolean {
  if (!manager) {
    return false;
  }
  let modified = false;
  for (const section of TRANSITIVE_INSTALL_SECTIONS) {
    const deps = packageJson[section];
    if (!deps) {
      continue;
    }
    for (const [name, version] of Object.entries(deps)) {
      if (!manager.isCatalogReference(version)) {
        continue;
      }
      const resolved = manager.resolveCatalogReference(
        workspaceRoot,
        name,
        version
      );
      if (!resolved) {
        throw new Error(
          `Could not resolve catalog reference for package ${name}@${version}.`
        );
      }
      deps[name] = resolved;
      modified = true;
    }
  }
  return modified;
}

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
    optionalDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  },
  projectGraph: ProjectGraph
) {
  if (
    !WORKSPACE_MODULE_INSTALL_SECTIONS.some((section) => packageJson[section])
  ) {
    return;
  }

  const workspaceModules = getWorkspacePackagesFromGraph(projectGraph);
  const catalogManager = getCatalogManager(workspaceRoot);
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
    let copiedPackageJson: CopiedManifest;
    try {
      copiedPackageJson = JSON.parse(
        readFileSync(copiedPackageJsonPath, 'utf-8')
      );
    } catch (e) {
      logger.warn(`Could not read package.json for ${pkgName}: ${e.message}`);
      return;
    }

    // The standalone dist ships no catalog definition, so resolve any
    // `catalog:` references to the version the workspace pinned.
    let packageJsonModified = resolveCatalogReferences(
      copiedPackageJson,
      catalogManager
    );

    // Rewrite sibling workspace-module deps to file: paths and recurse. A peer
    // is moved into dependencies (pnpm rejects a file: spec under
    // peerDependencies), dropping its now-orphaned optional/required marker.
    for (const section of TRANSITIVE_INSTALL_SECTIONS) {
      const deps = copiedPackageJson[section];
      if (!deps) {
        continue;
      }
      for (const depName of Object.keys(deps)) {
        if (!workspaceModules.has(depName)) {
          continue;
        }
        const fileSpec = `file:${calculateRelativePath(pkgName, depName)}`;
        if (section === 'peerDependencies') {
          (copiedPackageJson.dependencies ??= {})[depName] = fileSpec;
          delete deps[depName];
          if (copiedPackageJson.peerDependenciesMeta) {
            delete copiedPackageJson.peerDependenciesMeta[depName];
          }
        } else {
          deps[depName] = fileSpec;
        }
        packageJsonModified = true;
        processModule(depName);
      }
    }
    if (
      copiedPackageJson.peerDependencies &&
      Object.keys(copiedPackageJson.peerDependencies).length === 0
    ) {
      delete copiedPackageJson.peerDependencies;
    }
    if (
      copiedPackageJson.peerDependenciesMeta &&
      Object.keys(copiedPackageJson.peerDependenciesMeta).length === 0
    ) {
      delete copiedPackageJson.peerDependenciesMeta;
    }

    if (packageJsonModified) {
      writeFileSync(
        copiedPackageJsonPath,
        JSON.stringify(copiedPackageJson, null, 2)
      );
      logger.verbose(`Updated package.json for ${pkgName}.`);
    }
  }

  // Seed from every section the app declares a workspace module in. Copied
  // modules recurse over production sections only (see processModule).
  // processModule dedups via processedModules, so a module listed in several
  // sections is copied once.
  for (const section of WORKSPACE_MODULE_INSTALL_SECTIONS) {
    const deps = packageJson[section];
    if (!deps) {
      continue;
    }
    for (const pkgName of Object.keys(deps)) {
      processModule(pkgName);
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
  outputPath = stripGlobToBaseDir(outputPath);
  if (!outputPath.startsWith(workspaceRoot)) {
    outputPath = join(workspaceRoot, outputPath);
  }
  if (!lstatSync(outputPath).isDirectory()) {
    outputPath = dirname(outputPath);
  }
  return outputPath;
}
