import {
  formatFiles,
  getPackageManagerCommand,
  installPackagesTask,
  joinPathFragments,
  PackageManager,
  Tree,
} from '@nx/devkit';

import { join } from 'path';
import { Preset } from '../utils/presets';
import { Linter, LinterType } from '../../utils/lint';
import { generateWorkspaceFiles } from './generate-workspace-files';
import { addPresetDependencies, generatePreset } from './generate-preset';
import { execSync } from 'child_process';

interface Schema {
  directory: string;
  name: string;
  appName?: string;
  skipInstall?: boolean;
  style?: string;
  preset: string;
  defaultBase: string;
  framework?: string;
  docker?: boolean;
  js?: boolean;
  nextAppDir?: boolean;
  nextSrcDir?: boolean;
  linter?: Linter | LinterType;
  bundler?: 'vite' | 'webpack';
  standaloneApi?: boolean;
  routing?: boolean;
  packageManager?: PackageManager;
  e2eTestRunner?: 'cypress' | 'playwright' | 'detox' | 'jest' | 'none';
  ssr?: boolean;
  prefix?: string;
  useGitHub?: boolean;
  nxCloud?: 'yes' | 'skip' | 'circleci' | 'github';
  formatter?: 'none' | 'prettier';
}

export interface NormalizedSchema extends Schema {
  presetVersion?: string;
  isCustomPreset: boolean;
  nxCloudToken?: string;
}

export async function newGenerator(tree: Tree, opts: Schema) {
  const options = normalizeOptions(opts);
  validateOptions(options, tree);

  options.nxCloudToken = await generateWorkspaceFiles(tree, options);

  addPresetDependencies(tree, options);

  await formatFiles(tree);

  return async () => {
    if (!options.skipInstall) {
      const pmc = getPackageManagerCommand(options.packageManager);
      if (pmc.preInstall) {
        execSync(pmc.preInstall, {
          cwd: joinPathFragments(tree.root, options.directory),
          stdio:
            process.env.NX_GENERATE_QUIET === 'true' ? 'ignore' : 'inherit',
          windowsHide: true,
        });
      }
      installPackagesTask(
        tree,
        false,
        options.directory,
        options.packageManager
      );
    }
    // TODO: move all of these into create-nx-workspace
    if (options.preset !== Preset.NPM && !options.isCustomPreset) {
      await generatePreset(tree, options);
    }
  };
}

export default newGenerator;

function validateOptions(options: Schema, host: Tree) {
  if (
    options.skipInstall &&
    options.preset !== Preset.Apps &&
    options.preset !== Preset.TS &&
    options.preset !== Preset.NPM
  ) {
    throw new Error(`Cannot select a preset when skipInstall is set to true.`);
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
