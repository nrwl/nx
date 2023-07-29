import {
  installPackagesTask,
  names,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { Schema } from './schema';
import { Preset } from '../utils/presets';

export async function presetGenerator(tree: Tree, options: Schema) {
  options = normalizeOptions(options);
  const presetTask = await createPreset(tree, options);
  return async () => {
    installPackagesTask(tree);
    if (presetTask) await presetTask();
  };
}

export default presetGenerator;

async function createPreset(tree: Tree, options: Schema) {
  if (options.preset === Preset.Empty || options.preset === Preset.Apps) {
    return;
  } else if (options.preset === Preset.AngularMonorepo) {
    const {
      applicationGenerator: angularApplicationGenerator,
    } = require('@nx' + '/angular/generators');

    return angularApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standalone: options.standaloneApi,
      routing: options.routing,
      e2eTestRunner: options.e2eTestRunner ?? 'cypress',
    });
  } else if (options.preset === Preset.AngularStandalone) {
    const {
      applicationGenerator: angularApplicationGenerator,
    } = require('@nx' + '/angular/generators');

    return angularApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      routing: options.routing,
      rootProject: true,
      standalone: options.standaloneApi,
      e2eTestRunner: options.e2eTestRunner ?? 'cypress',
    });
  } else if (options.preset === Preset.ReactMonorepo) {
    const { applicationGenerator: reactApplicationGenerator } = require('@nx' +
      '/react');

    return reactApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      bundler: options.bundler ?? 'webpack',
      e2eTestRunner: options.e2eTestRunner ?? 'cypress',
    });
  } else if (options.preset === Preset.ReactStandalone) {
    const { applicationGenerator: reactApplicationGenerator } = require('@nx' +
      '/react');

    return reactApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      rootProject: true,
      bundler: options.bundler ?? 'vite',
      e2eTestRunner: options.e2eTestRunner ?? 'cypress',
      unitTestRunner: options.bundler === 'vite' ? 'vitest' : 'jest',
    });
  } else if (options.preset === Preset.NextJs) {
    const { applicationGenerator: nextApplicationGenerator } = require('@nx' +
      '/next');

    return nextApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      appDir: options.nextAppDir,
      e2eTestRunner: options.e2eTestRunner ?? 'cypress',
    });
  } else if (options.preset === Preset.NextJsStandalone) {
    const { applicationGenerator: nextApplicationGenerator } = require('@nx' +
      '/next');
    return nextApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      appDir: options.nextAppDir,
      e2eTestRunner: options.e2eTestRunner ?? 'cypress',
      rootProject: true,
    });
  } else if (options.preset === Preset.WebComponents) {
    const { applicationGenerator: webApplicationGenerator } = require('@nx' +
      '/web');

    return webApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      bundler: 'vite',
      e2eTestRunner: options.e2eTestRunner ?? 'cypress',
    });
  } else if (options.preset === Preset.Nest) {
    const { applicationGenerator: nestApplicationGenerator } = require('@nx' +
      '/nest');

    return nestApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'jest',
    });
  } else if (options.preset === Preset.Express) {
    const {
      applicationGenerator: expressApplicationGenerator,
    } = require('@nx' + '/express');
    return expressApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'jest',
    });
  } else if (options.preset === Preset.ReactNative) {
    const { reactNativeApplicationGenerator } = require('@nx' +
      '/react-native');
    return reactNativeApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'detox',
    });
  } else if (options.preset === Preset.Expo) {
    const { expoApplicationGenerator } = require('@nx' + '/expo');
    return expoApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      e2eTestRunner: options.e2eTestRunner ?? 'detox',
    });
  } else if (options.preset === Preset.TS) {
    const c = readNxJson(tree);
    const { initGenerator } = require('@nx' + '/js');
    c.workspaceLayout = {
      appsDir: 'packages',
      libsDir: 'packages',
    };
    updateNxJson(tree, c);
    return initGenerator(tree, {});
  } else if (options.preset === Preset.TsStandalone) {
    const c = readNxJson(tree);
    const { libraryGenerator } = require('@nx' + '/js');
    updateNxJson(tree, c);
    return libraryGenerator(tree, {
      name: options.name,
      bundler: 'tsc',
      unitTestRunner: 'vitest',
      testEnvironment: 'node',
      js: options.js,
      rootProject: true,
    });
  } else if (options.preset === Preset.NodeStandalone) {
    const { applicationGenerator: nodeApplicationGenerator } = require('@nx' +
      '/node');
    const bundler = options.bundler === 'webpack' ? 'webpack' : 'esbuild';
    return nodeApplicationGenerator(tree, {
      bundler,
      name: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
      framework: options.framework,
      docker: options.docker,
      rootProject: true,
      e2eTestRunner: options.e2eTestRunner ?? 'jest',
    });
  } else if (options.preset === Preset.NodeMonorepo) {
    const { applicationGenerator: nodeApplicationGenerator } = require('@nx' +
      '/node');
    const bundler = options.bundler === 'webpack' ? 'webpack' : 'esbuild';
    return nodeApplicationGenerator(tree, {
      bundler,
      name: options.name,
      linter: options.linter,
      framework: options.framework,
      docker: options.docker,
      rootProject: false,
      e2eTestRunner: options.e2eTestRunner ?? 'jest',
    });
  } else {
    throw new Error(`Invalid preset ${options.preset}`);
  }
}

function normalizeOptions(options: Schema): Schema {
  options.name = names(options.name).fileName;
  return options;
}
