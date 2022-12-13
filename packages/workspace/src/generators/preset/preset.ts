import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
  names,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { Schema } from './schema';
import { insertStatement } from '../utils/insert-statement';
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
      standaloneConfig: options.standaloneConfig,
    });
  } else if (options.preset === Preset.AngularStandalone) {
    const {
      applicationGenerator: angularApplicationGenerator,
    } = require('@nrwl' + '/angular/generators');

    await angularApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
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
      standaloneConfig: options.standaloneConfig,
    });
  } else if (options.preset === Preset.ReactStandalone) {
    const {
      applicationGenerator: reactApplicationGenerator,
    } = require('@nrwl' + '/react');

    await reactApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
      rootProject: true,
      bundler: 'vite',
      e2eTestRunner: 'none',
      unitTestRunner: 'vitest',
    });
  } else if (options.preset === Preset.NextJs) {
    const { applicationGenerator: nextApplicationGenerator } = require('@nrwl' +
      '/next');

    await nextApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
    });
  } else if (options.preset === Preset.WebComponents) {
    const { applicationGenerator: webApplicationGenerator } = require('@nrwl' +
      '/web');

    await webApplicationGenerator(tree, {
      name: options.name,
      style: options.style,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
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
      standaloneConfig: options.standaloneConfig,
    });
  } else if (options.preset === Preset.ReactNative) {
    const { reactNativeApplicationGenerator } = require('@nrwl' +
      '/react-native');
    await reactNativeApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
      e2eTestRunner: 'detox',
    });
  } else if (options.preset === Preset.Expo) {
    const { expoApplicationGenerator } = require('@nrwl' + '/expo');
    await expoApplicationGenerator(tree, {
      name: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
      e2eTestRunner: 'detox',
    });
  } else if (options.preset === Preset.TS) {
    const c = readWorkspaceConfiguration(tree);
    c.workspaceLayout = {
      appsDir: 'packages',
      libsDir: 'packages',
    };
    updateWorkspaceConfiguration(tree, c);
  } else {
    throw new Error(`Invalid preset ${options.preset}`);
  }
}

function addPolyfills(host: Tree, polyfillsPath: string, polyfills: string[]) {
  for (const polyfill of polyfills) {
    insertStatement(host, polyfillsPath, `import '${polyfill}';\n`);
  }
}

function normalizeOptions(options: Schema): Schema {
  options.name = names(options.name).fileName;
  return options;
}
