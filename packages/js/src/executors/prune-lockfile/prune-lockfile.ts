import {
  detectPackageManager,
  type ExecutorContext,
  logger,
  normalizePath,
  parseTargetString,
  type ProjectGraph,
  type ProjectGraphProjectNode,
  readJsonFile,
  workspaceRoot,
} from '@nx/devkit';
import { existsSync, lstatSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, posix } from 'path';
import {
  dropEmptyPeerDependencySections,
  generatePrunedDeployOutput,
  getCatalogManager,
  getWorkspacePackagesFromGraph,
  interpolate,
  movePeerDependencyToDependencies,
  type PackageJson,
  type PackageJsonDependencySection,
  resolveWorkspaceModuleDependency,
  usesBinaryBunLockfile,
} from '@nx/devkit/internal';
import { type PruneLockfileOptions } from './schema';
import { stripGlobToBaseDir } from '../../utils/strip-glob-to-base-dir';
import {
  TRANSITIVE_INSTALL_SECTIONS,
  WORKSPACE_MODULE_INSTALL_SECTIONS,
} from '../../utils/workspace-module-sections';

export default async function pruneLockfileExecutor(
  schema: PruneLockfileOptions,
  context: ExecutorContext
) {
  logger.log('Pruning lockfile...');
  const outputDirectory = getOutputDir(schema, context);
  const packageJson = resolveCatalogReferences(getPackageJson(schema, context));
  mergeAllowScripts(packageJson);
  const packageManager = detectPackageManager(workspaceRoot);
  const { project } = parseTargetString(schema.buildTarget, context);
  const projectRoot = context.projectGraph.nodes[project].data.root;
  if (packageManager === 'bun') {
    declareTransitiveFolderDependencies(
      packageJson,
      context.projectGraph,
      projectRoot
    );
  }

  generatePrunedDeployOutput(packageJson, context.projectGraph, projectRoot, {
    outputDirectory,
    packageManager,
    workspaceRoot,
  });
  rewriteWorkspaceModuleSpecifiers(
    packageJson,
    context.projectGraph,
    projectRoot,
    packageManager
  );
  writeFileSync(
    join(outputDirectory, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  logger.log(`Pruned deploy output written to ${outputDirectory}`);

  return {
    success: true,
  };
}

// Point every workspace-module dependency at its copied directory so the
// standalone output installs them as pnpm `file:` directory dependencies.
// pnpm rejects a `file:` spec under peerDependencies, so a peer-declared
// workspace module is moved into dependencies instead (an optional peer
// becomes required, which is moot since the module is always copied in). For
// pnpm and Bun, as in copy-workspace-modules, a `file:`/`link:` spec to another
// directory is a vendored package even when a workspace package has its name.
function rewriteWorkspaceModuleSpecifiers(
  packageJson: PackageJson,
  graph: ProjectGraph,
  projectRoot: string,
  packageManager: ReturnType<typeof detectPackageManager>
) {
  const workspacePackages = getWorkspacePackagesFromGraph(graph);
  const resolvesLocalPaths =
    packageManager === 'pnpm' || packageManager === 'bun';

  for (const section of WORKSPACE_MODULE_INSTALL_SECTIONS) {
    const deps = packageJson[section];
    if (!deps) {
      continue;
    }
    for (const [pkgName, spec] of Object.entries(deps)) {
      const isWorkspaceModule = resolvesLocalPaths
        ? resolveWorkspaceModuleDependency(
            workspacePackages,
            pkgName,
            spec,
            projectRoot,
            workspaceRoot
          )
        : workspacePackages.has(pkgName);
      if (!isWorkspaceModule) {
        continue;
      }
      const fileSpec = `file:./workspace_modules/${pkgName}`;
      if (section === 'peerDependencies') {
        movePeerDependencyToDependencies(packageJson, pkgName, fileSpec);
      } else {
        deps[pkgName] = fileSpec;
      }
    }
  }
  dropEmptyPeerDependencySections(packageJson);
}

/**
 * npm reads the `allowScripts` install-script allowlist only from the install
 * root, but `npm approve-scripts` writes it to the workspace root, so it never
 * lives in the project package.json the prune output is built from. Carry the
 * root allowlist over, with project-level entries preserved and winning on
 * conflict. Mirrors the `pnpm.allowBuilds` handling in createPackageJson.
 */
function mergeAllowScripts(packageJson: PackageJson) {
  const rootPackageJson: PackageJson = readJsonFile(
    join(workspaceRoot, 'package.json')
  );
  if (!rootPackageJson.allowScripts) {
    return;
  }
  packageJson.allowScripts = {
    ...rootPackageJson.allowScripts,
    ...packageJson.allowScripts,
  };
}

/**
 * Bun never installs the dependencies of a `file:` dependency declared by
 * another `file:` dependency, so a Bun output declares every workspace module
 * the app reaches through other modules. With the text bun.lock it also
 * declares each vendored `file:` package those modules declare, unless the
 * manifest already declares that name. The binary
 * bun.lockb output ships no vendored copy for that declaration to point at.
 * A package a production section reaches goes to dependencies, one only
 * devDependencies reach to devDependencies. A vendored package is declared
 * relative to `projectRoot`, like the app's own.
 */
function declareTransitiveFolderDependencies(
  packageJson: PackageJson,
  graph: ProjectGraph,
  projectRoot: string
) {
  const workspacePackages = getWorkspacePackagesFromGraph(graph);
  const shipsVendoredPackages = !usesBinaryBunLockfile(workspaceRoot);
  const productionSections = WORKSPACE_MODULE_INSTALL_SECTIONS.filter(
    (section) => section !== 'devDependencies'
  );
  const resolveModule = (name: string, spec: string, dependentRoot: string) =>
    resolveWorkspaceModuleDependency(
      workspacePackages,
      name,
      spec,
      dependentRoot,
      workspaceRoot
    );
  const visited = new Set<string>();
  const visit = (
    name: string,
    project: ProjectGraphProjectNode,
    section: 'dependencies' | 'devDependencies'
  ) => {
    if (visited.has(name)) {
      return;
    }
    visited.add(name);
    const declaredForProduction = productionSections.some(
      (declared) => packageJson[declared]?.[name]
    );
    if (
      !declaredForProduction &&
      (section === 'dependencies' || !packageJson.devDependencies?.[name])
    ) {
      if (packageJson.devDependencies?.[name]) {
        delete packageJson.devDependencies[name];
        if (!Object.keys(packageJson.devDependencies).length) {
          delete packageJson.devDependencies;
        }
      }
      (packageJson[section] ??= {})[name] = `file:./workspace_modules/${name}`;
    }
    const manifest: PackageJson = readJsonFile(
      join(workspaceRoot, project.data.root, 'package.json')
    );
    for (const transitiveSection of TRANSITIVE_INSTALL_SECTIONS) {
      for (const [dep, spec] of Object.entries(
        manifest[transitiveSection] ?? {}
      )) {
        const workspaceModule = resolveModule(dep, spec, project.data.root);
        if (workspaceModule) {
          visit(dep, workspaceModule, section);
        } else if (shipsVendoredPackages && spec.startsWith('file:')) {
          declareVendored(dep, spec, project.data.root, section);
        }
      }
    }
  };
  const declareVendored = (
    name: string,
    spec: string,
    moduleRoot: string,
    section: 'dependencies' | 'devDependencies'
  ) => {
    if (
      WORKSPACE_MODULE_INSTALL_SECTIONS.some(
        (declared) => packageJson[declared]?.[name]
      )
    ) {
      return;
    }
    const path = normalizePath(spec.slice('file:'.length));
    (packageJson[section] ??= {})[name] = isAbsolute(path)
      ? spec
      : `file:${posix.relative(projectRoot, posix.join(moduleRoot, path))}`;
  };
  const visitDeclared = (
    section: PackageJsonDependencySection,
    visitAs: 'dependencies' | 'devDependencies'
  ) => {
    for (const [name, spec] of Object.entries(packageJson[section] ?? {})) {
      const workspaceModule = resolveModule(name, spec, projectRoot);
      if (workspaceModule) {
        visit(name, workspaceModule, visitAs);
      }
    }
  };
  for (const section of productionSections) {
    visitDeclared(section, 'dependencies');
  }
  visitDeclared('devDependencies', 'devDependencies');
}

export function resolveCatalogReferences(
  packageJson: PackageJson
): PackageJson {
  const manager = getCatalogManager(workspaceRoot);
  if (!manager) {
    return packageJson;
  }

  const sections: PackageJsonDependencySection[] = [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
    'peerDependencies',
  ];
  const resolved: PackageJson = { ...packageJson };
  for (const section of sections) {
    const deps = packageJson[section];
    if (!deps) {
      continue;
    }
    const resolvedDeps: Record<string, string> = { ...deps };
    for (const [packageName, version] of Object.entries(deps)) {
      if (!manager.isCatalogReference(version)) {
        continue;
      }
      const resolvedVersion = manager.resolveCatalogReference(
        workspaceRoot,
        packageName,
        version
      );
      if (!resolvedVersion) {
        throw new Error(
          `Could not resolve catalog reference for package ${packageName}@${version}.`
        );
      }
      resolvedDeps[packageName] = resolvedVersion;
    }
    resolved[section] = resolvedDeps;
  }
  return resolved;
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
  outputPath = stripGlobToBaseDir(outputPath);
  if (!outputPath.startsWith(workspaceRoot)) {
    outputPath = join(workspaceRoot, outputPath);
  }
  if (!lstatSync(outputPath).isDirectory()) {
    outputPath = dirname(outputPath);
  }
  return outputPath;
}
