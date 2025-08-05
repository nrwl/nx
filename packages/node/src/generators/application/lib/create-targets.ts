import {
  joinPathFragments,
  ProjectConfiguration,
  Tree,
  TargetConfiguration,
  detectPackageManager,
} from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
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
      // Use CJS for Node apps for widest compatibility.
      format: ['cjs'],
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

export function getNestWebpackBuildConfig(): TargetConfiguration {
  return {
    executor: 'nx:run-commands',
    options: {
      command: 'webpack-cli build',
      args: ['--node-env=production'],
    },
    configurations: {
      development: {
        args: ['--node-env=development'],
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
  const lockFileName =
    getLockFileName(detectPackageManager() ?? 'npm') ?? 'package-lock.json';
  return {
    'prune-lockfile': {
      dependsOn: ['build'],
      cache: true,
      executor: '@nx/js:prune-lockfile',
      outputs: [
        `{workspaceRoot}/${joinPathFragments(outputPath, 'package.json')}`,
        `{workspaceRoot}/${joinPathFragments(outputPath, lockFileName)}`,
      ],
      options: {
        buildTarget,
      },
    },
    'copy-workspace-modules': {
      dependsOn: ['build'],
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
