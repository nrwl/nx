import {
  joinPathFragments,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { NormalizedSchema } from './normalized-schema';

export function getWebpackBuildConfig(
  project: ProjectConfiguration,
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: `@nx/webpack:webpack`,
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      target: 'node',
      compiler: 'tsc',
      outputPath: options.outputPath,
      main: joinPathFragments(
        project.sourceRoot,
        'main' + (options.js ? '.js' : '.ts')
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [joinPathFragments(project.sourceRoot, 'assets')],
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
  project: ProjectConfiguration,
  options: NormalizedSchema
): TargetConfiguration {
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
        project.sourceRoot,
        'main' + (options.js ? '.js' : '.ts')
      ),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [joinPathFragments(project.sourceRoot, 'assets')],
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
