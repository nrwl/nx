import {
  detectPackageManager,
  type ExecutorContext,
  logger,
  parseTargetString,
  type ProjectGraph,
  readJsonFile,
  workspaceRoot,
} from '@nx/devkit';
import { getCatalogManager } from '@nx/devkit/internal';
import { existsSync, lstatSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { interpolate } from 'nx/src/tasks-runner/utils';
import {
  type PackageJson,
  type PackageJsonDependencySection,
  stripPrunedLockfilePnpmConfig,
  writePrunedPnpmInstallSettings,
} from 'nx/src/utils/package-json';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  getLockFileName,
  createLockFile,
} from 'nx/src/plugins/js/lock-file/lock-file';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getWorkspacePackagesFromGraph } from 'nx/src/plugins/js/utils/get-workspace-packages-from-graph';
import { type PruneLockfileOptions } from './schema';
import { stripGlobToBaseDir } from '../../utils/strip-glob-to-base-dir';

export default async function pruneLockfileExecutor(
  schema: PruneLockfileOptions,
  context: ExecutorContext
) {
  logger.log('Pruning lockfile...');
  const outputDirectory = getOutputDir(schema, context);
  const packageJson = resolveCatalogReferences(getPackageJson(schema, context));
  mergeAllowScripts(packageJson);
  const packageManager = detectPackageManager(workspaceRoot);

  if (packageManager === 'bun') {
    logger.warn(
      'Bun lockfile generation is not supported. Only package.json will be generated. Run "bun install" in the output directory if needed.'
    );
    writeFileSync(
      join(outputDirectory, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  } else {
    const { lockfileName, lockFile } = createPrunedLockfile(
      packageJson,
      context.projectGraph,
      packageManager
    );
    const lockfileOutputPath = join(outputDirectory, lockfileName);
    writeFileSync(lockfileOutputPath, lockFile);
    // The pruned lockfile bakes pnpm config into its snapshots, so strip the
    // manifest's pnpm config to avoid ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
    stripPrunedLockfilePnpmConfig(packageJson);
    writeFileSync(
      join(outputDirectory, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    // pnpm 11 reads build-script approvals and supportedArchitectures only from
    // pnpm-workspace.yaml, so re-emit them there for the standalone output.
    if (packageManager === 'pnpm') {
      writePrunedPnpmInstallSettings(outputDirectory, workspaceRoot);
    }
    logger.log(`Lockfile pruned: ${lockfileOutputPath}`);
  }

  return {
    success: true,
  };
}

function createPrunedLockfile(
  packageJson: PackageJson,
  graph: ProjectGraph,
  packageManager: ReturnType<typeof detectPackageManager>
) {
  const lockfileName = getLockFileName(packageManager);
  const lockFile = createLockFile(packageJson, graph, packageManager);

  const workspacePackages = getWorkspacePackagesFromGraph(graph);

  // Point every workspace-module dependency at its copied directory so the
  // standalone output installs them as pnpm `file:` directory dependencies.
  // Cover devDependencies too: pnpm validates the whole manifest against the
  // lockfile even under `--prod`, so a workspace module left as `workspace:*` in
  // any section fails `pnpm install --frozen-lockfile` (#35425). Gate strictly on
  // graph membership: a `file:`/`link:` spec to a non-workspace local path (e.g.
  // a vendored tarball) is left alone, since copy-workspace-modules only ever
  // copies actual workspace projects.
  for (const section of [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
  ] as const) {
    const deps = packageJson[section];
    if (!deps) {
      continue;
    }
    for (const pkgName of Object.keys(deps)) {
      if (workspacePackages.has(pkgName)) {
        deps[pkgName] = `file:./workspace_modules/${pkgName}`;
      }
    }
  }

  return {
    lockfileName,
    lockFile,
  };
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
