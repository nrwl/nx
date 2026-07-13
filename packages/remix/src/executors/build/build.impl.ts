import {
  detectPackageManager,
  logger,
  readJsonFile,
  writeJsonFile,
  type ExecutorContext,
} from '@nx/devkit';
import {
  createPackageJson,
  createPrunedLockfile,
  getLockFileName,
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
  } else {
    packageJson = readJsonFile(join(projectRoot, 'package.json'));
  }

  let prunedLockfile: ReturnType<typeof createPrunedLockfile> | undefined;
  if (options.generateLockfile && packageManager !== 'bun') {
    prunedLockfile = createPrunedLockfile(
      packageJson,
      context.projectGraph,
      projectRoot,
      context.root,
      packageManager
    );
  }
  if (options.generatePackageJson) {
    writeJsonFile(`${options.outputPath}/package.json`, packageJson);
  }

  if (options.generateLockfile) {
    if (packageManager === 'bun') {
      logger.warn(
        'Bun lockfile generation is not supported. The generated package.json will not include a lockfile. Run "bun install" in the output directory after deployment if needed.'
      );
    } else {
      writeFileSync(
        `${options.outputPath}/${getLockFileName(packageManager)}`,
        prunedLockfile.lockFileContent,
        {
          encoding: 'utf-8',
        }
      );
      if (packageManager === 'pnpm') {
        writePrunedPnpmInstallSettings(
          options.outputPath,
          context.root,
          prunedLockfile.lockFileContent,
          { includeLocalPathArtifacts: prunedLockfile.pruned }
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
