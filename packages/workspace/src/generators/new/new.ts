import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
  names,
  PackageManager,
  Tree,
} from '@nrwl/devkit';

import { join } from 'path';
import { Preset } from '../utils/presets';
import { Linter } from '../../utils/lint';
import { generateWorkspaceFiles } from './generate-workspace-files';
import { addPresetDependencies, generatePreset } from './generate-preset';

interface Schema {
  directory: string;
  name: string;
  appName?: string;
  npmScope?: string;
  skipInstall?: boolean;
  style?: string;
  nxCloud?: boolean;
  preset: string;
  defaultBase: string;
  framework?: string;
  docker?: boolean;
  linter?: Linter;
  bundler?: 'vite' | 'webpack';
  packageManager?: PackageManager;
}

export interface NormalizedSchema extends Schema {
  presetVersion?: string;
}

export async function newGenerator(host: Tree, options: Schema) {
  options = normalizeOptions(options);
  validateOptions(options, host);

  await generateWorkspaceFiles(host, { ...options, nxCloud: undefined } as any);

  addPresetDependencies(host, options);
  const isCustomPreset = !Object.values(Preset).includes(options.preset as any);
  addCloudDependencies(host, options);

  await formatFiles(host);

  return async () => {
    installPackagesTask(host, false, options.directory, options.packageManager);
    // TODO: move all of these into create-nx-workspace
    if (
      options.preset !== Preset.NPM &&
      options.preset !== Preset.Core &&
      !isCustomPreset
    ) {
      await generatePreset(host, options);
    }
  };
}

export default newGenerator;

function validateOptions(options: Schema, host: Tree) {
  if (
    options.skipInstall &&
    options.preset !== Preset.Apps &&
    options.preset !== Preset.Core &&
    options.preset !== Preset.TS &&
    options.preset !== Preset.Empty &&
    options.preset !== Preset.NPM
  ) {
    throw new Error(`Cannot select a preset when skipInstall is set to true.`);
  }
  if (options.skipInstall && options.nxCloud) {
    throw new Error(`Cannot select nxCloud when skipInstall is set to true.`);
  }

  if (options.preset === Preset.NodeServer && !options.framework) {
    throw new Error(
      `Cannot generate ${options.preset} without selecting a framework`
    );
  }

  if (
    host.exists(options.name) &&
    !host.isFile(options.name) &&
    host.children(options.name).length > 0
  ) {
    throw new Error(
      `${join(host.root, options.name)} is not an empty directory.`
    );
  }
}

function normalizeOptions(options: NormalizedSchema): NormalizedSchema {
  options.name = names(options.name).fileName;
  if (!options.directory) {
    options.directory = options.name;
  }

  // If the preset already contains a version in the name
  // -- my-package@2.0.1
  // -- @scope/package@version
  const match = options.preset.match(
    /^(?<package>(@.+\/)?[^@]+)(@(?<version>\d+\.\d+\.\d+))?$/
  );
  if (match) {
    options.preset = match.groups.package;
    options.presetVersion = match.groups.version;
  }

  return options;
}

function addCloudDependencies(host: Tree, options: Schema) {
  if (options.nxCloud) {
    return addDependenciesToPackageJson(
      host,
      {},
      { '@nrwl/nx-cloud': 'latest' },
      join(options.directory, 'package.json')
    );
  }
}
