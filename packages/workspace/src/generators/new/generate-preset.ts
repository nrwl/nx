import {
  addDependenciesToPackageJson,
  getPackageManagerCommand,
  Tree,
} from '@nrwl/devkit';
import { Preset } from '../utils/presets';
import { nxVersion } from '../../utils/versions';
import { getNpmPackageVersion } from '../utils/get-npm-package-version';
import { NormalizedSchema } from './new';
import { join } from 'path';
import * as yargsParser from 'yargs-parser';
import { spawn } from 'child_process';

export function addPresetDependencies(host: Tree, options: NormalizedSchema) {
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

export function generatePreset(host: Tree, opts: NormalizedSchema) {
  const parsedArgs = yargsParser(process.argv, {
    boolean: ['interactive'],
  });
  const spawnOptions = {
    stdio: [process.stdin, process.stdout, process.stderr],
    shell: true,
    cwd: join(host.root, opts.directory),
  };
  const pmc = getPackageManagerCommand();
  const executable = `${pmc.exec} nx`;
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

  function getDefaultArgs(opts: NormalizedSchema) {
    return [
      `g`,
      `@nrwl/workspace:preset`,
      `--name=${opts.appName}`,
      opts.style ? `--style=${opts.style}` : null,
      opts.linter ? `--linter=${opts.linter}` : null,
      opts.npmScope ? `--npmScope=${opts.npmScope}` : `--npmScope=${opts.name}`,
      opts.preset ? `--preset=${opts.preset}` : null,
      opts.packageManager ? `--packageManager=${opts.packageManager}` : null,
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

function getPresetDependencies(preset: string, version?: string) {
  switch (preset) {
    case Preset.TS:
      return { dependencies: {}, dev: { '@nrwl/js': nxVersion } };

    case Preset.Angular:
      return { dependencies: { '@nrwl/angular': nxVersion }, dev: {} };

    case Preset.Express:
      return { dependencies: {}, dev: { '@nrwl/express': nxVersion } };

    case Preset.Nest:
      return { dependencies: {}, dev: { '@nrwl/nest': nxVersion } };

    case Preset.NextJs:
      return { dependencies: { '@nrwl/next': nxVersion }, dev: {} };

    case Preset.React:
      return { dependencies: {}, dev: { '@nrwl/react': nxVersion } };

    case Preset.ReactExperimental:
      return { dependencies: {}, dev: { '@nrwl/react': nxVersion } };

    case Preset.ReactNative:
      return { dependencies: {}, dev: { '@nrwl/react-native': nxVersion } };

    case Preset.Expo:
      return { dependencies: {}, dev: { '@nrwl/expo': nxVersion } };

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
