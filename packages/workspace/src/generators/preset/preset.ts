import { installPackagesTask, names, readNxJson, Tree } from '@nx/devkit';
import { Schema } from './schema';
import { Preset } from '../utils/presets';
import { join } from 'path';

export async function presetGenerator(tree: Tree, options: Schema) {
  const presetTask = await createPreset(tree, options);
  return async () => {
    installPackagesTask(tree);
    if (presetTask) await presetTask();
  };
}

export default presetGenerator;

async function createPreset(tree: Tree, options: Schema) {
  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  if (options.preset === Preset.Apps) {
    return;
  } else if (options.preset === Preset.AngularMonorepo) {
    const {
      applicationGenerator: angularApplicationGenerator,
    } = require('@nx' + '/angular/generators');

    return angularApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      style: options.style,
      linter: options.linter,
      standalone: options.standaloneApi,
      routing: options.routing,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      bundler: options.bundler,
      ssr: options.ssr,
      prefix: options.prefix,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.AngularStandalone) {
    const {
      applicationGenerator: angularApplicationGenerator,
    } = require('@nx' + '/angular/generators');

    return angularApplicationGenerator(tree, {
      name: options.name,
      directory: '.',
      style: options.style,
      linter: options.linter,
      routing: options.routing,
      rootProject: true,
      standalone: options.standaloneApi,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      bundler: options.bundler,
      ssr: options.ssr,
      prefix: options.prefix,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.ReactMonorepo) {
    const { applicationGenerator: reactApplicationGenerator } = require('@nx' +
      '/react');

    return reactApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      style: options.style,
      linter: options.linter,
      bundler: options.bundler ?? 'webpack',
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.ReactStandalone) {
    const { applicationGenerator: reactApplicationGenerator } = require('@nx' +
      '/react');

    return reactApplicationGenerator(tree, {
      name: options.name,
      directory: '.',
      style: options.style,
      linter: options.linter,
      rootProject: true,
      bundler: options.bundler ?? 'vite',
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      unitTestRunner: options.bundler === 'vite' ? 'vitest' : 'jest',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.RemixMonorepo) {
    const { applicationGenerator: remixApplicationGenerator } = require('@nx' +
      '/remix/generators');

    return remixApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      unitTestRunner: 'vitest',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.RemixStandalone) {
    const { applicationGenerator: remixApplicationGenerator } = require('@nx' +
      '/remix/generators');

    return remixApplicationGenerator(tree, {
      name: options.name,
      directory: '.',
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      rootProject: true,
      unitTestRunner: 'vitest',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.VueMonorepo) {
    const { applicationGenerator: vueApplicationGenerator } = require('@nx' +
      '/vue');

    return vueApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      style: options.style,
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.VueStandalone) {
    const { applicationGenerator: vueApplicationGenerator } = require('@nx' +
      '/vue');

    return vueApplicationGenerator(tree, {
      name: options.name,
      directory: '.',
      style: options.style,
      linter: options.linter,
      rootProject: true,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      unitTestRunner: 'vitest',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.Nuxt) {
    const { applicationGenerator: nuxtApplicationGenerator } = require('@nx' +
      '/nuxt');

    return nuxtApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      style: options.style,
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.NuxtStandalone) {
    const { applicationGenerator: nuxtApplicationGenerator } = require('@nx' +
      '/nuxt');

    return nuxtApplicationGenerator(tree, {
      name: options.name,
      directory: '.',
      style: options.style,
      linter: options.linter,
      rootProject: true,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      unitTestRunner: 'vitest',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.NextJs) {
    const { applicationGenerator: nextApplicationGenerator } = require('@nx' +
      '/next');

    return nextApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      style: options.style,
      linter: options.linter,
      appDir: options.nextAppDir,
      src: options.nextSrcDir,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      addPlugin,
    });
  } else if (options.preset === Preset.NextJsStandalone) {
    const { applicationGenerator: nextApplicationGenerator } = require('@nx' +
      '/next');
    return nextApplicationGenerator(tree, {
      name: options.name,
      directory: '.',
      style: options.style,
      linter: options.linter,
      appDir: options.nextAppDir,
      src: options.nextSrcDir,
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      rootProject: true,
      addPlugin,
    });
  } else if (options.preset === Preset.WebComponents) {
    const { applicationGenerator: webApplicationGenerator } = require('@nx' +
      '/web');

    return webApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      style: options.style,
      linter: options.linter,
      bundler: 'vite',
      e2eTestRunner: options.e2eTestRunner ?? 'playwright',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.Nest) {
    const { applicationGenerator: nestApplicationGenerator } = require('@nx' +
      '/nest');

    return nestApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'jest',
      addPlugin,
    });
  } else if (options.preset === Preset.Express) {
    const {
      applicationGenerator: expressApplicationGenerator,
    } = require('@nx' + '/express');
    return expressApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'jest',
      addPlugin,
    });
  } else if (options.preset === Preset.ReactNative) {
    const { reactNativeApplicationGenerator } = require('@nx' +
      '/react-native');
    return reactNativeApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'detox',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.Expo) {
    const { expoApplicationGenerator } = require('@nx' + '/expo');
    return expoApplicationGenerator(tree, {
      name: options.name,
      directory: join('apps', options.name),
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'detox',
      addPlugin,
      nxCloudToken: options.nxCloudToken,
    });
  } else if (options.preset === Preset.TS) {
    const { initGenerator } = require('@nx' + '/js');
    return initGenerator(tree, {
      formatter: options.formatter,
      addTsPlugin:
        process.env.NX_ADD_PLUGINS !== 'false' &&
        process.env.NX_ADD_TS_PLUGIN !== 'false',
    });
  } else if (options.preset === Preset.TsStandalone) {
    const { libraryGenerator } = require('@nx' + '/js');
    return libraryGenerator(tree, {
      name: options.name,
      directory: '.',
      bundler: 'tsc',
      unitTestRunner: 'vitest',
      testEnvironment: 'node',
      js: options.js,
      rootProject: true,
      addPlugin,
    });
  } else if (options.preset === Preset.NodeStandalone) {
    const { applicationGenerator: nodeApplicationGenerator } = require('@nx' +
      '/node');
    const bundler = options.bundler === 'webpack' ? 'webpack' : 'esbuild';
    return nodeApplicationGenerator(tree, {
      bundler,
      name: options.name,
      directory: '.',
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
      framework: options.framework,
      docker: options.docker,
      rootProject: true,
      e2eTestRunner: options.e2eTestRunner ?? 'jest',
      addPlugin,
    });
  } else if (options.preset === Preset.NodeMonorepo) {
    const { applicationGenerator: nodeApplicationGenerator } = require('@nx' +
      '/node');
    const bundler = options.bundler === 'webpack' ? 'webpack' : 'esbuild';
    return nodeApplicationGenerator(tree, {
      bundler,
      name: options.name,
      directory: join('apps', options.name),
      linter: options.linter,
      framework: options.framework,
      docker: options.docker,
      rootProject: false,
      e2eTestRunner: options.e2eTestRunner ?? 'jest',
      addPlugin,
    });
  } else {
    throw new Error(`Invalid preset ${options.preset}`);
  }
}
