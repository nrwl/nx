import {
  joinPathFragments,
  ProjectConfiguration,
  Tree,
  TargetConfiguration,
  detectPackageManager,
  readNxJson,
} from '@nx/devkit';
import {
  getProjectSourceRoot,
  PNPM_MAJOR_RUNTIME_INPUT,
} from '@nx/js/internal';
import { NormalizedSchema } from './normalized-schema';
import { getLockFileName } from '@nx/js';

export function getWebpackBuildConfig(
  tree: Tree,
  project: ProjectConfiguration,
  options: NormalizedSchema
): TargetConfiguration {
  const sourceRoot = getProjectSourceRoot(project, tree);
  return {
    executor: `@nx/webpack:webpack`,
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      target: 'node',
      compiler: 'tsc',
      outputPath: options.outputPath,
      main: joinPathFragments(
        sourceRoot,
        'main' + (options.js ? '.js' : '.ts')
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [joinPathFragments(sourceRoot, 'assets')],
      webpackConfig: joinPathFragments(
        options.appProjectRoot,
        'webpack.config.js'
      ),
      generatePackageJson: options.isUsingTsSolutionConfig ? undefined : true,
    },
    configurations: {
      development: {
        outputHashing: 'none',
      },
      production: {
        ...(options.docker && { generateLockfile: true }),
      },
    },
  };
}

/** Explicit form of the build target @nx/js/typescript infers from tsconfig.app.json. */
export function getTscBuildConfig(
  tree: Tree,
  options: NormalizedSchema
): TargetConfiguration {
  const namedInputs = readNxJson(tree)?.namedInputs ?? {};
  return {
    command: 'tsc --build tsconfig.app.json',
    options: { cwd: options.appProjectRoot },
    cache: true,
    dependsOn: ['^build'],
    inputs:
      'production' in namedInputs
        ? ['production', '^production']
        : ['default', '^default'],
    outputs: ['{projectRoot}/dist'],
    syncGenerators: ['@nx/js:typescript-sync'],
  };
}

export function getEsBuildConfig(
  tree: Tree,
  project: ProjectConfiguration,
  options: NormalizedSchema
): TargetConfiguration {
  const sourceRoot = getProjectSourceRoot(project, tree);
  return {
    executor: '@nx/esbuild:esbuild',
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      platform: 'node',
      outputPath: options.outputPath,
      // CJS for widest compatibility, unless the app is ESM (`"type": "module"`).
      format: [options.serveRuntime === 'node' ? 'esm' : 'cjs'],
      bundle: false,
      main: joinPathFragments(
        sourceRoot,
        'main' + (options.js ? '.js' : '.ts')
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [joinPathFragments(sourceRoot, 'assets')],
      generatePackageJson: options.isUsingTsSolutionConfig ? undefined : true,
      esbuildOptions: {
        sourcemap: true,
        // Generate CJS files as .js so imports can be './foo' rather than './foo.cjs'.
        outExtension: { '.js': '.js' },
      },
    },
    configurations: {
      development: {},
      production: {
        ...(options.docker && { generateLockfile: true }),
        esbuildOptions: {
          sourcemap: false,
          // Generate CJS files as .js so imports can be './foo' rather than './foo.cjs'.
          outExtension: { '.js': '.js' },
        },
      },
    },
  };
}

export function getServeConfig(options: NormalizedSchema): TargetConfiguration {
  if (options.bundler === 'tsc' || options.bundler === 'rolldown') {
    // These build targets have no development/production configurations.
    return {
      continuous: true,
      executor: '@nx/js:node',
      dependsOn: [options.buildTargetName],
      options: {
        buildTarget: `${options.name}:${options.buildTargetName}`,
        runBuildTargetDependencies: false,
      },
    };
  }
  return {
    continuous: true,
    executor: '@nx/js:node',
    defaultConfiguration: 'development',
    // Run build, which includes dependency on "^build" by default, so the first run
    // won't error out due to missing build artifacts.
    dependsOn: ['build'],
    options: {
      buildTarget: `${options.name}:build`,
      // Even though `false` is the default, set this option so users know it
      // exists if they want to always run dependencies during each rebuild.
      runBuildTargetDependencies: false,
    },
    configurations: {
      development: {
        buildTarget: `${options.name}:build:development`,
      },
      production: {
        buildTarget: `${options.name}:build:production`,
      },
    },
  };
}

export function getPruneTargets(
  buildTarget: string,
  outputPath: string
): {
  prune: TargetConfiguration;
  'prune-lockfile': TargetConfiguration;
  'copy-workspace-modules': TargetConfiguration;
} {
  const packageManager = detectPackageManager() ?? 'npm';
  const lockFileName = getLockFileName(packageManager) ?? 'package-lock.json';
  const pruneLockfileOutputs = [
    `{workspaceRoot}/${joinPathFragments(outputPath, 'package.json')}`,
    `{workspaceRoot}/${joinPathFragments(outputPath, lockFileName)}`,
  ];
  let pruneLockfileInputs: TargetConfiguration['inputs'] | undefined;
  if (packageManager === 'pnpm') {
    // Beside the pruned lockfile the executor emits a settings-only
    // pnpm-workspace.yaml, a `pnpm patch` workspace emits the referenced `.patch`
    // files under `patches/`, and any non-workspace local-path deps (`file:`
    // tarballs/dirs, `link:` targets) ship under `local_path_modules/`; declare
    // all three so a cache replay restores them and native build-script
    // approvals, patches, or vendored dependencies are not silently dropped.
    // The last two are declared for any pnpm since the generator can't know
    // whether the workspace uses them; Nx tolerates absent outputs.
    pruneLockfileOutputs.push(
      `{workspaceRoot}/${joinPathFragments(outputPath, 'pnpm-workspace.yaml')}`,
      `{workspaceRoot}/${joinPathFragments(outputPath, 'patches')}`,
      `{workspaceRoot}/${joinPathFragments(outputPath, 'local_path_modules')}`
    );
    // The build approvals and `supportedArchitectures` those artifacts carry are
    // recorded nowhere in the lockfile, so without the root files in the hash a
    // revoked approval replays the previous artifact, and the ambient pnpm
    // major (probed at hash time) decides which emitted file carries them.
    // `default` and `^default` keep what an undeclared `inputs` would have
    // hashed. Deliberately coarser than the settings-narrowed json input the
    // bundler build targets use: over-invalidating this small, rarely-run task
    // costs nothing.
    pruneLockfileInputs = [
      'default',
      '^default',
      `{workspaceRoot}/pnpm-workspace.yaml`,
      `{workspaceRoot}/package.json`,
      PNPM_MAJOR_RUNTIME_INPUT,
    ];
  }
  return {
    'prune-lockfile': {
      dependsOn: [buildTarget],
      cache: true,
      executor: '@nx/js:prune-lockfile',
      ...(pruneLockfileInputs ? { inputs: pruneLockfileInputs } : {}),
      outputs: pruneLockfileOutputs,
      options: {
        buildTarget,
      },
    },
    'copy-workspace-modules': {
      dependsOn: [buildTarget],
      cache: true,
      outputs: [
        `{workspaceRoot}/${joinPathFragments(outputPath, 'workspace_modules')}`,
      ],
      executor: '@nx/js:copy-workspace-modules',
      options: {
        buildTarget,
      },
    },
    prune: {
      dependsOn: ['prune-lockfile', 'copy-workspace-modules'],
      executor: 'nx:noop',
    },
  };
}
