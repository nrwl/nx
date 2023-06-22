import {
  addDependenciesToPackageJson,
  getPackageManagerCommand,
  Tree,
} from '@nx/devkit';
import { Preset } from '../utils/presets';
import {
  angularCliVersion,
  nxVersion,
  typescriptVersion,
} from '../../utils/versions';
import { getNpmPackageVersion } from '../utils/get-npm-package-version';
import { NormalizedSchema } from './new';
import { join } from 'path';
import * as yargsParser from 'yargs-parser';
import { spawn, SpawnOptions } from 'child_process';

export function addPresetDependencies(host: Tree, options: NormalizedSchema) {
  if (
    options.preset === Preset.Apps ||
    options.preset === Preset.Core ||
    options.preset === Preset.Empty ||
    options.preset === Preset.NPM
  ) {
    return;
  }
  const { dependencies, dev } = getPresetDependencies(options);
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
    default: {
      interactive: true,
    },
  });
  const spawnOptions: SpawnOptions = {
    stdio: 'inherit',
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
    // supported presets
    return getDefaultArgs(options);
  }

  function getDefaultArgs(opts: NormalizedSchema) {
    return [
      `g`,
      `@nx/workspace:preset`,
      `--name=${opts.appName}`,
      opts.style ? `--style=${opts.style}` : null,
      opts.linter ? `--linter=${opts.linter}` : null,
      opts.preset ? `--preset=${opts.preset}` : null,
      opts.bundler ? `--bundler=${opts.bundler}` : null,
      opts.framework ? `--framework=${opts.framework}` : null,
      opts.docker ? `--docker=${opts.docker}` : null,
      opts.js ? `--js` : null,
      opts.nextAppDir ? '--nextAppDir=true' : '--nextAppDir=false',
      opts.packageManager ? `--packageManager=${opts.packageManager}` : null,
      opts.standaloneApi !== undefined
        ? `--standaloneApi=${opts.standaloneApi}`
        : null,
      parsedArgs.interactive ? '--interactive=true' : '--interactive=false',
      opts.routing !== undefined ? `--routing=${opts.routing}` : null,
      opts.e2eTestRunner !== undefined
        ? `--e2eTestRunner=${opts.e2eTestRunner}`
        : null,
    ].filter((e) => !!e);
  }
}

function getPresetDependencies({
  preset,
  presetVersion,
  bundler,
  e2eTestRunner,
}: NormalizedSchema) {
  switch (preset) {
    case Preset.TS:
    case Preset.TsStandalone:
      return { dependencies: {}, dev: { '@nx/js': nxVersion } };

    case Preset.AngularMonorepo:
    case Preset.AngularStandalone:
      return {
        dependencies: { '@nx/angular': nxVersion },
        dev: {
          '@angular-devkit/core': angularCliVersion,
          typescript: typescriptVersion,
        },
      };

    case Preset.Express:
      return { dependencies: {}, dev: { '@nx/express': nxVersion } };

    case Preset.Nest:
      return {
        dependencies: {},
        dev: { '@nx/nest': nxVersion, typescript: typescriptVersion },
      };

    case Preset.NextJs:
    case Preset.NextJsStandalone:
      return { dependencies: { '@nx/next': nxVersion }, dev: {} };

    case Preset.ReactMonorepo:
    case Preset.ReactStandalone:
      return {
        dependencies: {},
        dev: {
          '@nx/react': nxVersion,
          '@nx/cypress': e2eTestRunner !== 'none' ? nxVersion : undefined,
          '@nx/jest': bundler !== 'vite' ? nxVersion : undefined,
          '@nx/vite': bundler === 'vite' ? nxVersion : undefined,
          '@nx/webpack': bundler === 'webpack' ? nxVersion : undefined,
        },
      };

    case Preset.ReactNative:
      return { dependencies: {}, dev: { '@nx/react-native': nxVersion } };

    case Preset.Expo:
      return { dependencies: {}, dev: { '@nx/expo': nxVersion } };

    case Preset.WebComponents:
      return {
        dependencies: {},
        dev: { '@nx/web': nxVersion, typescript: typescriptVersion },
      };

    case Preset.NodeStandalone:
    case Preset.NodeMonorepo:
      return {
        dependencies: {},
        dev: {
          '@nx/node': nxVersion,
          '@nx/webpack': bundler === 'webpack' ? nxVersion : undefined,
        },
      };

    default: {
      return {
        dev: {},
        dependencies: {
          [preset]:
            process.env['NX_E2E_PRESET_VERSION'] ??
            getNpmPackageVersion(preset, presetVersion),
        },
      };
    }
  }
}
