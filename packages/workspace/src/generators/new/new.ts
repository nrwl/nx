import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  getPackageManagerCommand,
  getWorkspacePath as devkitGetWorkspacePath,
  installPackagesTask,
  names,
  PackageManager,
  Tree,
  updateJson,
} from '@nrwl/devkit';

import { join } from 'path';
import * as yargsParser from 'yargs-parser';
import { spawn } from 'child_process';
import { workspaceGenerator } from '../workspace/workspace';
import { nxVersion } from '../../utils/versions';
import { Preset } from '../utils/presets';
import { getNpmPackageVersion } from '../utils/get-npm-package-version';

export interface Schema {
  cli: 'nx' | 'angular';
  directory: string;
  name: string;
  appName: string;
  npmScope?: string;
  skipInstall?: boolean;
  style?: string;
  nxCloud?: boolean;
  preset: string;
  defaultBase: string;
  linter: 'tslint' | 'eslint';
  packageManager?: PackageManager;
}

export interface NormalizedSchema extends Schema {
  presetVersion?: string;
}

function generatePreset(host: Tree, opts: NormalizedSchema) {
  const cliCommand = opts.cli === 'angular' ? 'ng' : 'nx';
  const parsedArgs = yargsParser(process.argv, {
    boolean: ['interactive'],
  });
  const spawnOptions = {
    stdio: [process.stdin, process.stdout, process.stderr],
    shell: true,
    cwd: join(host.root, opts.directory),
  };
  const pmc = getPackageManagerCommand();
  const executable = `${pmc.exec} ${cliCommand}`;
  const args = getPresetArgs(opts);

  return new Promise<void>((resolve, reject) => {
    spawn(executable, args, spawnOptions).on('close', (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        const message = 'Workspace creation failed, see above.';
        reject(new Error(message));
      }
    });
  });

  function getPresetArgs(options: NormalizedSchema) {
    if (Object.values(Preset).some((val) => val === options.preset)) {
      // supported presets
      return getDefaultArgs(options);
    }
    return getThirdPartyPresetArgs();
  }

  function getDefaultArgs(opts: Schema) {
    return [
      `g`,
      `@nrwl/workspace:preset`,
      `--name=${opts.appName}`,
      opts.style ? `--style=${opts.style}` : null,
      opts.linter ? `--linter=${opts.linter}` : null,
      opts.npmScope ? `--npmScope=${opts.npmScope}` : `--npmScope=${opts.name}`,
      opts.preset ? `--preset=${opts.preset}` : null,
      opts.packageManager ? `--packageManager=${opts.packageManager}` : null,
      `--cli=${cliCommand}`,
      parsedArgs.interactive ? '--interactive=true' : '--interactive=false',
    ].filter((e) => !!e);
  }

  function getThirdPartyPresetArgs() {
    const thirdPartyPkgArgs = Object.entries(opts).reduce(
      (acc, [key, value]) => {
        if (value === true) {
          acc.push(`--${key}`);
        } else if (value === false) {
          acc.push(`--no-${key}`);
          // nxWorkspaceRoot breaks CLI if incorrectly set, so need to exclude it.
          // TODO(jack): Should read in the preset schema and only pass the options specified.
        } else if (key !== 'nxWorkspaceRoot') {
          // string, number (don't handle arrays or nested objects)
          acc.push(`--${key}=${value}`);
        }
        return acc;
      },
      []
    );
    return [`g`, `${opts.preset}:preset`, ...thirdPartyPkgArgs];
  }
}

export async function newGenerator(host: Tree, options: Schema) {
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

  if (devkitGetWorkspacePath(host)) {
    throw new Error(
      'Cannot generate a new workspace within an existing workspace'
    );
  }

  options = normalizeOptions(options);

  if (
    host.exists(options.name) &&
    !host.isFile(options.name) &&
    host.children(options.name).length > 0
  ) {
    throw new Error(
      `${join(host.root, options.name)} is not an empty directory.`
    );
  }

  await workspaceGenerator(host, { ...options, nxCloud: undefined } as any);

  setDefaultLinter(host, options);
  addPresetDependencies(host, options);
  addCloudDependencies(host, options);

  await formatFiles(host);
  return async () => {
    installPackagesTask(host, false, options.directory, options.packageManager);
    await generatePreset(host, options);
  };
}

export default newGenerator;
export const newSchematic = convertNxGenerator(newGenerator);

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

function getPresetDependencies(preset: string, version?: string) {
  switch (preset) {
    case Preset.TS:
      return { dependencies: {}, dev: { '@nrwl/js': nxVersion } };

    case Preset.Angular:
      return { dependencies: { '@nrwl/angular': nxVersion }, dev: {} };

    case Preset.AngularWithNest:
      return {
        dependencies: { '@nrwl/angular': nxVersion },
        dev: { '@nrwl/nest': nxVersion },
      };

    case Preset.Express:
      return { dependencies: {}, dev: { '@nrwl/express': nxVersion } };

    case Preset.Nest:
      return { dependencies: {}, dev: { '@nrwl/nest': nxVersion } };

    case Preset.NextJs:
      return { dependencies: { '@nrwl/next': nxVersion }, dev: {} };

    case Preset.React:
      return { dependencies: {}, dev: { '@nrwl/react': nxVersion } };

    case Preset.ReactWithExpress:
      return {
        dependencies: {},
        dev: {
          '@nrwl/react': nxVersion,
          '@nrwl/express': nxVersion,
        },
      };

    case Preset.ReactNative:
      return { dependencies: {}, dev: { '@nrwl/react-native': nxVersion } };

    case Preset.WebComponents:
      return { dependencies: {}, dev: { '@nrwl/web': nxVersion } };

    default: {
      return {
        dev: {},
        dependencies: { [preset]: version ?? getNpmPackageVersion(preset) },
      };
    }
  }
}

function addPresetDependencies(host: Tree, options: NormalizedSchema) {
  if (
    options.preset === Preset.Apps ||
    options.preset === Preset.Core ||
    options.preset === Preset.Empty ||
    options.preset === Preset.NPM
  ) {
    return;
  }
  const { dependencies, dev } = getPresetDependencies(
    options.preset,
    options.presetVersion
  );
  return addDependenciesToPackageJson(
    host,
    dependencies,
    dev,
    join(options.directory, 'package.json')
  );
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

function setDefaultLinter(host: Tree, options: Schema) {
  const { linter, preset } = options;
  // Don't do anything if someone doesn't pick angular
  if (preset !== Preset.Angular && preset !== Preset.AngularWithNest) {
    return;
  }

  switch (linter) {
    case 'eslint': {
      setESLintDefault(host, options);
      break;
    }
    case 'tslint': {
      setTSLintDefault(host, options);
      break;
    }
  }
}

/**
 * This sets ESLint as the default for any schematics that default to TSLint
 */
function setESLintDefault(host: Tree, options: Schema) {
  updateJson(host, getWorkspacePath(host, options), (json) => {
    setDefault(json, '@nrwl/angular', 'application', 'linter', 'eslint');
    setDefault(json, '@nrwl/angular', 'library', 'linter', 'eslint');
    setDefault(
      json,
      '@nrwl/angular',
      'storybook-configuration',
      'linter',
      'eslint'
    );
    return json;
  });
}

/**
 * This sets TSLint as the default for any schematics that default to ESLint
 */
function setTSLintDefault(host: Tree, options: Schema) {
  updateJson(host, getWorkspacePath(host, options), (json) => {
    setDefault(json, '@nrwl/workspace', 'library', 'linter', 'tslint');
    setDefault(json, '@nrwl/cypress', 'cypress-project', 'linter', 'tslint');
    setDefault(json, '@nrwl/cypress', 'cypress-project', 'linter', 'tslint');
    setDefault(json, '@nrwl/node', 'application', 'linter', 'tslint');
    setDefault(json, '@nrwl/node', 'library', 'linter', 'tslint');
    setDefault(json, '@nrwl/nest', 'application', 'linter', 'tslint');
    setDefault(json, '@nrwl/nest', 'library', 'linter', 'tslint');
    setDefault(json, '@nrwl/express', 'application', 'linter', 'tslint');
    setDefault(json, '@nrwl/express', 'library', 'linter', 'tslint');

    return json;
  });
}

function getWorkspacePath(host: Tree, { directory, cli }: Schema) {
  return join(directory, cli === 'angular' ? 'angular.json' : 'workspace.json');
}

function setDefault(
  json: any,
  collectionName: string,
  generatorName: string,
  key: string,
  value: any
) {
  if (!json.schematics) json.schematics = {};
  if (
    json.schematics[collectionName] &&
    json.schematics[collectionName][generatorName]
  ) {
    json.schematics[collectionName][generatorName][key] = value;
  } else if (json.schematics[`${collectionName}:${generatorName}`]) {
    json.schematics[`${collectionName}:${generatorName}`][key] = value;
  } else {
    json.schematics[collectionName] = json.schematics[collectionName] || {};
    json.schematics[collectionName][generatorName] = { [key]: value };
  }
}
