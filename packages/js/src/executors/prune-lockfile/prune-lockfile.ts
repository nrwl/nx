import {
  detectPackageManager,
  type ExecutorContext,
  logger,
  parseTargetString,
  type ProjectGraph,
  readJsonFile,
  workspaceRoot,
} from '@nx/devkit';
import { existsSync, lstatSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { intersects, validRange } from 'semver';
import {
  dropEmptyPeerDependencySections,
  generatePrunedDeployOutput,
  getCatalogManager,
  getWorkspacePackagesFromGraph,
  interpolate,
  movePeerDependencyToDependencies,
  type PackageJson,
  type PackageJsonDependencySection,
} from '@nx/devkit/internal';
import { type PruneLockfileOptions } from './schema';
import { stripGlobToBaseDir } from '../../utils/strip-glob-to-base-dir';
import { WORKSPACE_MODULE_INSTALL_SECTIONS } from '../../utils/workspace-module-sections';

export default async function pruneLockfileExecutor(
  schema: PruneLockfileOptions,
  context: ExecutorContext
) {
  logger.log('Pruning lockfile...');
  const outputDirectory = getOutputDir(schema, context);
  const packageJson = resolveCatalogReferences(getPackageJson(schema, context));
  mergeAllowScripts(packageJson);
  const packageManager = detectPackageManager(workspaceRoot);
  if (packageManager === 'npm') {
    applyRootOverrides(packageJson);
  }

  const { project } = parseTargetString(schema.buildTarget, context);
  const projectRoot = context.projectGraph.nodes[project].data.root;
  generatePrunedDeployOutput(packageJson, context.projectGraph, projectRoot, {
    outputDirectory,
    packageManager,
    workspaceRoot,
  });
  rewriteWorkspaceModuleSpecifiers(packageJson, context.projectGraph);
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
// becomes required, which is moot since the module is always copied in). Gate
// strictly on graph membership: a `file:`/`link:` spec to a non-workspace
// local path (e.g. a vendored tarball) is left alone, since
// copy-workspace-modules only ever copies actual workspace projects.
function rewriteWorkspaceModuleSpecifiers(
  packageJson: PackageJson,
  graph: ProjectGraph
) {
  const workspacePackages = getWorkspacePackagesFromGraph(graph);

  for (const section of WORKSPACE_MODULE_INSTALL_SECTIONS) {
    const deps = packageJson[section];
    if (!deps) {
      continue;
    }
    for (const pkgName of Object.keys(deps)) {
      if (!workspacePackages.has(pkgName)) {
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
 * npm, like `allowScripts`, reads `overrides` only from the install root. In a
 * workspace it resolved the whole tree, this project included, with the root's
 * overrides and ignored the project's own, so the pruned lock file follows the
 * root's; the project's would leave `npm ci` finding it out of sync. An
 * override naming a direct dependency must match that dependency's spec or npm
 * rejects it (EOVERRIDE), and npm resolved the dependency with the override, so
 * the dependency takes the override's spec. A `$name` override refers to the
 * root's own dependency, which the pruned manifest lacks, so it is resolved.
 */
function applyRootOverrides(packageJson: PackageJson) {
  const rootPackageJson: PackageJson = readJsonFile(
    join(workspaceRoot, 'package.json')
  );
  delete packageJson.overrides;
  if (
    !rootPackageJson.overrides ||
    !Object.keys(rootPackageJson.overrides).length
  ) {
    return;
  }
  const overrides = resolveOverrideReferences(
    rootPackageJson.overrides,
    rootPackageJson
  );
  packageJson.overrides = overrides;

  const sections: PackageJsonDependencySection[] = [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
    'peerDependencies',
  ];
  for (const section of sections) {
    const deps = packageJson[section];
    if (!deps) {
      continue;
    }
    for (const [name, spec] of Object.entries(deps)) {
      const value = getOverrideValue(overrides, name, spec);
      if (value) {
        deps[name] = value;
      }
    }
  }
}

/**
 * The spec npm gives a direct dependency, mirroring its OverrideSet: the first
 * root rule for the name whose key range (`name@range`, `*` when absent)
 * intersects the dependency's spec. npm accepts the rule for a spec it cannot
 * compare as a range, such as a tag or a directory.
 */
function getOverrideValue(
  overrides: PackageJson['overrides'],
  name: string,
  spec: string
): string | undefined {
  for (const [key, override] of Object.entries(overrides)) {
    const at = key.indexOf('@', 1);
    if ((at === -1 ? key : key.slice(0, at)) !== name) {
      continue;
    }
    const keySpec = at === -1 ? '*' : key.slice(at + 1) || '*';
    if (keySpec !== '*') {
      const range = spec.startsWith('npm:') ? getAliasRange(spec) : spec;
      if (validRange(range) && !intersects(range, keySpec)) {
        continue;
      }
    }
    const value =
      typeof override === 'string' ? override : override?.['.'] || keySpec;
    return value && value !== '*' ? value : undefined;
  }
  return undefined;
}

function getAliasRange(spec: string): string {
  const at = spec.lastIndexOf('@');
  return at > 'npm:'.length ? spec.slice(at + 1) : '*';
}

function resolveOverrideReferences(
  overrides: PackageJson['overrides'],
  rootPackageJson: PackageJson
): PackageJson['overrides'] {
  const resolve = (value: unknown) => {
    if (typeof value === 'string' && value.startsWith('$')) {
      const name = value.slice(1);
      return (
        rootPackageJson.dependencies?.[name] ??
        rootPackageJson.devDependencies?.[name] ??
        rootPackageJson.optionalDependencies?.[name] ??
        rootPackageJson.peerDependencies?.[name] ??
        value
      );
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, resolve(nested)])
      );
    }
    return value;
  };
  return resolve(overrides) as PackageJson['overrides'];
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
