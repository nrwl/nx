import {
  detectPackageManager,
  logger,
  readJsonFile,
  writeJsonFile,
  type ExecutorContext,
} from '@nx/devkit';
import {
  createLockFile,
  createPackageJson,
  getLockFileName,
  getWorkspacePackagesFromGraph,
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLocalPathClosure,
  writePrunedPnpmInstallSettings,
} from '@nx/js';
import { fork } from 'child_process';
import { copySync, mkdir, statSync, writeFileSync } from 'fs-extra';
import { type PackageJson } from 'nx/src/utils/package-json';
import { join } from 'path';
import { type RemixBuildSchema } from './schema';
import { warnRemixBuildExecutorDeprecation } from '../../utils/deprecation';

function buildRemixBuildArgs(options: RemixBuildSchema) {
  const args = ['build'];

  if (options.sourcemap) {
    args.push(`--sourcemap`);
  }

  return args;
}

async function runBuild(
  options: RemixBuildSchema,
  context: ExecutorContext
): Promise<void> {
  const projectRoot = context.projectGraph.nodes[context.projectName].data.root;
  return new Promise<void>((resolve, reject) => {
    const remixBin = require.resolve('@remix-run/dev/dist/cli');
    const args = buildRemixBuildArgs(options);
    const p = fork(remixBin, args, {
      cwd: join(context.root, projectRoot),
      stdio: 'inherit',
    });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject();
    });
  });
}

export default async function buildExecutor(
  options: RemixBuildSchema,
  context: ExecutorContext
) {
  warnRemixBuildExecutorDeprecation();

  const projectRoot = context.projectGraph.nodes[context.projectName].data.root;

  try {
    await runBuild(options, context);
  } catch (error) {
    logger.error(
      `Error occurred while trying to build application. See above for more details.`
    );
    return { success: false };
  }

  let outputIsDirectory = false;
  try {
    outputIsDirectory = statSync(options.outputPath).isDirectory();
  } catch {
    // path does not exist; will be created below
  }
  if (!outputIsDirectory) {
    mkdir(options.outputPath);
  }
  const packageManager = detectPackageManager(context.root);
  let packageJson: PackageJson;
  if (options.generatePackageJson) {
    packageJson = createPackageJson(context.projectName, context.projectGraph, {
      target: context.targetName,
      root: context.root,
      isProduction: !options.includeDevDependenciesInPackageJson, // By default we remove devDependencies since this is a production build.
      skipPackageManager: options.skipPackageManager,
      // Only drop baked pnpm config from the manifest when a pruned lockfile
      // accompanies it; otherwise a fresh install needs it to resolve.
      prunedLockfile: !!options.generateLockfile,
    });

    // Update `package.json` to reflect how users should run the build artifacts
    packageJson.scripts ??= {};
    // Don't override existing custom script since project may have its own server.
    if (!packageJson.scripts.start) {
      packageJson.scripts['start'] = 'remix-serve ./build/index.js';
    }

    updatePackageJson(packageJson, context);
    // pnpm re-resolves local-path manifest specifiers on a non-frozen install,
    // so relocate them to their shipped location before the manifest is written
    // and the lockfile copies them.
    if (options.generateLockfile && packageManager === 'pnpm') {
      rewritePrunedLocalPathSpecifiers(
        packageJson,
        projectRoot,
        context.root,
        new Set(getWorkspacePackagesFromGraph(context.projectGraph).keys())
      );
    }
    writeJsonFile(`${options.outputPath}/package.json`, packageJson);
  } else {
    packageJson = readJsonFile(join(projectRoot, 'package.json'));
  }

  if (options.generateLockfile) {
    if (packageManager === 'bun') {
      logger.warn(
        'Bun lockfile generation is not supported. The generated package.json will not include a lockfile. Run "bun install" in the output directory after deployment if needed.'
      );
    } else {
      // `pruned` flips off when createLockFile falls back to the root
      // lockfile, whose importer describes the whole workspace: skip the
      // link: closure validation and local-path shipping for it.
      let pruned = true;
      const lockFile = createLockFile(
        packageJson,
        context.projectGraph,
        packageManager,
        {
          onPruneFallback: () => {
            pruned = false;
          },
        }
      );
      if (packageManager === 'pnpm' && pruned) {
        validatePrunedLocalPathClosure(packageJson, context.root, lockFile);
      }
      writeFileSync(
        `${options.outputPath}/${getLockFileName(packageManager)}`,
        lockFile,
        {
          encoding: 'utf-8',
        }
      );
      // pnpm 11 reads build-script approvals and supportedArchitectures only
      // from pnpm-workspace.yaml, so re-emit them beside the generated lockfile.
      if (packageManager === 'pnpm') {
        writePrunedPnpmInstallSettings(
          options.outputPath,
          context.root,
          lockFile,
          { includeLocalPathArtifacts: pruned }
        );
      }
    }
  }

  // If output path is different from source path, then copy over the config and public files.
  // This is the default behavior when running `nx build <app>`.
  if (options.outputPath.replace(/\/$/, '') !== projectRoot) {
    copySync(join(projectRoot, 'public'), join(options.outputPath, 'public'), {
      dereference: true,
    });
    copySync(join(projectRoot, 'build'), join(options.outputPath, 'build'), {
      dereference: true,
    });
  }

  return { success: true };
}

function updatePackageJson(packageJson: PackageJson, context: ExecutorContext) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  if (!packageJson.scripts.start) {
    packageJson.scripts.start = 'remix-serve build';
  }

  packageJson.dependencies ??= {};

  // These are always required for a production Remix app to run.
  const requiredPackages = [
    'react',
    'react-dom',
    'isbot',
    '@remix-run/css-bundle',
    '@remix-run/node',
    '@remix-run/react',
    '@remix-run/serve',
    '@remix-run/dev',
  ];
  for (const pkg of requiredPackages) {
    const externalNode = context.projectGraph.externalNodes[`npm:${pkg}`];
    if (externalNode) {
      packageJson.dependencies[pkg] ??= externalNode.data.version;
    }
  }
}
