import type {
  ExpandedPluginConfiguration,
  NxJsonConfiguration,
} from '@nx/devkit';
import { findMatchingConfigFiles } from 'nx/src/devkit-internals';
import type { TscPluginOptions } from '../../../plugins/typescript/plugin';

export function ensureProjectIsIncludedInPluginRegistrations(
  nxJson: NxJsonConfiguration,
  projectRoot: string
): void {
  if (
    !nxJson.plugins?.length ||
    !nxJson.plugins.some(isTypeScriptPluginRegistration)
  ) {
    return;
  }

  let isIncluded = false;
  let index = 0;
  for (const registration of nxJson.plugins) {
    if (!isTypeScriptPluginRegistration(registration)) {
      index++;
      continue;
    }

    if (typeof registration === 'string') {
      // if it's a string all projects are included but the are no user-specified options
      // and the `build` task is not inferred by default, so we need to exclude it
      nxJson.plugins[index] = {
        plugin: '@nx/js/typescript',
        exclude: [`${projectRoot}/*`],
      };
    } else {
      // check if the project would be included by the plugin registration
      const matchingConfigFiles = findMatchingConfigFiles(
        [`${projectRoot}/tsconfig.json`],
        '**/tsconfig.json',
        registration.include,
        registration.exclude
      );
      if (matchingConfigFiles.length) {
        // it's included by the plugin registration, check if the user-specified options would result
        // in a `build` task being inferred, if not, we need to exclude it
        if (registration.options?.typecheck && registration.options?.build) {
          // it has the desired options, do nothing
          isIncluded = true;
        } else {
          // it would not have the `build` task inferred, so we need to exclude it
          registration.exclude ??= [];
          registration.exclude.push(`${projectRoot}/*`);
        }
      } else if (
        registration.options?.typecheck &&
        registration.options?.build &&
        !registration.exclude?.length
      ) {
        // negative pattern are not supported by the `exclude` option so we
        // can't update it to not exclude the project, so we only update the
        // plugin registration if there's no `exclude` option, in which case
        // the plugin registration should have an `include` options that doesn't
        // include the project
        isIncluded = true;
        registration.include ??= [];
        registration.include.push(`${projectRoot}/*`);
      }
    }
    index++;
  }

  if (!isIncluded) {
    // the project is not included by any plugin registration with an inferred `build` task,
    // so we create a new plugin registration for it
    nxJson.plugins.push({
      plugin: '@nx/js/typescript',
      include: [`${projectRoot}/*`],
      options: {
        typecheck: { targetName: 'typecheck' },
        build: {
          targetName: 'build',
          configName: 'tsconfig.lib.json',
        },
      },
    });
  }
}

export function ensureProjectIsExcludedFromPluginRegistrations(
  nxJson: NxJsonConfiguration,
  projectRoot: string
): void {
  if (
    !nxJson.plugins?.length ||
    !nxJson.plugins.some(isTypeScriptPluginRegistration)
  ) {
    return;
  }

  let index = 0;
  for (const registration of nxJson.plugins) {
    if (!isTypeScriptPluginRegistration(registration)) {
      index++;
      continue;
    }

    if (typeof registration === 'string') {
      // if it's a string, it includes all projects, so we need to exclude it
      nxJson.plugins[index] = {
        plugin: '@nx/js/typescript',
        exclude: [`${projectRoot}/*`],
      };
    } else {
      // check if the project would be included by the plugin registration
      const matchingConfigFiles = findMatchingConfigFiles(
        [`${projectRoot}/tsconfig.json`],
        '**/tsconfig.json',
        registration.include,
        registration.exclude
      );
      if (
        matchingConfigFiles.length &&
        (registration.options?.typecheck !== false ||
          registration.options?.build)
      ) {
        // the project is included by a plugin registration that infers any of the targets, so we need to exclude it
        registration.exclude ??= [];
        registration.exclude.push(`${projectRoot}/*`);
      }
    }
    index++;
  }
}

function isTypeScriptPluginRegistration(
  plugin: string | ExpandedPluginConfiguration
): plugin is string | ExpandedPluginConfiguration<TscPluginOptions> {
  return (
    (typeof plugin === 'string' && plugin === '@nx/js/typescript') ||
    (typeof plugin !== 'string' && plugin.plugin === '@nx/js/typescript')
  );
}
