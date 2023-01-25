import {
  formatFiles,
  installPackagesTask,
  names,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nrwl/devkit';
import { Schema } from './schema';
import { Preset } from '../utils/presets';

export async function presetGenerator(tree: Tree, options: Schema) {
  options = normalizeOptions(options);
  await createPreset(tree, options);
  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}

export default presetGenerator;

async function createPreset(tree: Tree, options: Schema) {
  if (options.preset === Preset.Empty || options.preset === Preset.Apps) {
    return;
  } else if (options.preset === Preset.AngularMonorepo) {
    const {
      applicationGenerator: angularApplicationGenerator,
    } = require('@nrwl' + '/angular/generators');

    await angularApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
    });
  } else if (options.preset === Preset.AngularStandalone) {
    const {
      applicationGenerator: angularApplicationGenerator,
    } = require('@nrwl' + '/angular/generators');

    await angularApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      rootProject: true,
    });
  } else if (options.preset === Preset.ReactMonorepo) {
    const {
      applicationGenerator: reactApplicationGenerator,
    } = require('@nrwl' + '/react');

    await reactApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      bundler: 'webpack',
    });
  } else if (options.preset === Preset.ReactStandalone) {
    const {
      applicationGenerator: reactApplicationGenerator,
    } = require('@nrwl' + '/react');

    await reactApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      rootProject: true,
      bundler: options.bundler ?? 'vite',
      e2eTestRunner: 'cypress',
      unitTestRunner: options.bundler === 'vite' ? 'vitest' : 'jest',
    });
  } else if (options.preset === Preset.NextJs) {
    const { applicationGenerator: nextApplicationGenerator } = require('@nrwl' +
      '/next');

    await nextApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
    });
  } else if (options.preset === Preset.WebComponents) {
    const { applicationGenerator: webApplicationGenerator } = require('@nrwl' +
      '/web');

    await webApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      bundler: 'vite',
    });
  } else if (options.preset === Preset.Nest) {
    const { applicationGenerator: nestApplicationGenerator } = require('@nrwl' +
      '/nest');

    await nestApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
    });
  } else if (options.preset === Preset.Express) {
    const {
      applicationGenerator: expressApplicationGenerator,
    } = require('@nrwl' + '/express');
    await expressApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
    });
  } else if (options.preset === Preset.ReactNative) {
    const { reactNativeApplicationGenerator } = require('@nrwl' +
      '/react-native');
    await reactNativeApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      e2eTestRunner: 'detox',
    });
  } else if (options.preset === Preset.Expo) {
    const { expoApplicationGenerator } = require('@nrwl' + '/expo');
    await expoApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      e2eTestRunner: 'detox',
    });
  } else if (options.preset === Preset.TS) {
    const c = readNxJson(tree);
    c.workspaceLayout = {
      appsDir: 'packages',
      libsDir: 'packages',
    };
    updateNxJson(tree, c);
  } else if (options.preset === Preset.NodeServer) {
    const { applicationGenerator: nodeApplicationGenerator } = require('@nrwl' +
      '/node');
    await nodeApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
      framework: options.framework,
      docker: options.docker,
      rootProject: true,
    });
  } else {
    throw new Error(`Invalid preset ${options.preset}`);
  }
}

function normalizeOptions(options: Schema): Schema {
  options.name = names(options.name).fileName;
  return options;
}
