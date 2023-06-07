import {
  addDependenciesToPackageJson,
  installPackagesTask,
  names,
  PackageManager,
  Tree,
} from '@nx/devkit';

import { join } from 'path';
import { Preset } from '../utils/presets';
import { Linter } from '../../utils/lint';
import { generateWorkspaceFiles } from './generate-workspace-files';
import { addPresetDependencies, generatePreset } from './generate-preset';

interface Schema {
  directory: string;
  name: string;
  appName?: string;
  skipInstall?: boolean;
  style?: string;
  nxCloud?: boolean;
  preset: string;
  defaultBase: string;
  framework?: string;
  docker?: boolean;
  js?: boolean;
  nextAppDir?: boolean;
  linter?: Linter;
  bundler?: 'vite' | 'webpack';
  standaloneApi?: boolean;
  routing?: boolean;
  packageManager?: PackageManager;
  e2eTestRunner?: 'cypress' | 'detox' | 'jest' | 'none';
}

export interface NormalizedSchema extends Schema {
  presetVersion?: string;
  isCustomPreset: boolean;
}

export async function newGenerator(host: Tree, opts: Schema) {
  const options = normalizeOptions(opts);
  validateOptions(options, host);

  await generateWorkspaceFiles(host, { ...options, nxCloud: undefined } as any);

  addPresetDependencies(host, options);
  addCloudDependencies(host, options);

  return async () => {
    installPackagesTask(host, false, options.directory, options.packageManager);
    // TODO: move all of these into create-nx-workspace
    if (
      options.preset !== Preset.NPM &&
      options.preset !== Preset.Core &&
      !options.isCustomPreset
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

  if (
    (options.preset === Preset.NodeStandalone ||
      options.preset === Preset.NodeMonorepo) &&
    !options.framework
  ) {
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

function parsePresetName(input: string): { package: string; version?: string } {
  // If the preset already contains a version in the name
  // -- my-package@2.0.1
  // -- @scope/package@version
  const atIndex = input.indexOf('@', 1); // Skip the beginning @ because it denotes a scoped package.

  if (atIndex > 0) {
    return {
      package: input.slice(0, atIndex),
      version: input.slice(atIndex + 1),
    };
  } else {
    if (!input) {
      throw new Error(`Invalid package name: ${input}`);
    }
    return { package: input };
  }
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const normalized: Partial<NormalizedSchema> = {
    ...options,
  };

  normalized.name = names(options.name).fileName;
  if (!options.directory) {
    normalized.directory = normalized.name;
  }

  const parsed = parsePresetName(options.preset);

  normalized.preset = parsed.package;
  // explicitly specified "presetVersion" takes priority over the one from the package name
  normalized.presetVersion ??= parsed.version;

  normalized.isCustomPreset = !Object.values(Preset).includes(
    options.preset as any
  );

  return normalized as NormalizedSchema;
}

function addCloudDependencies(host: Tree, options: Schema) {
  if (options.nxCloud) {
    return addDependenciesToPackageJson(
      host,
      {},
      { 'nx-cloud': 'latest' },
      join(options.directory, 'package.json')
    );
  }
}
