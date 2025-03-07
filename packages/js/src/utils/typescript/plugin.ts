import type {
  ExpandedPluginConfiguration,
  NxJsonConfiguration,
} from '@nx/devkit';
import { findMatchingConfigFiles } from 'nx/src/devkit-internals';
import type { TscPluginOptions } from '../../plugins/typescript/plugin';

export function ensureProjectIsIncludedInPluginRegistrations(
  nxJson: NxJsonConfiguration,
  projectRoot: string,
  buildTargetName: string | null
): void {
  nxJson.plugins ??= [];
  let isIncluded = false;
  let index = 0;
  for (const registration of nxJson.plugins) {
    if (!isTypeScriptPluginRegistration(registration)) {
      index++;
      continue;
    }

    if (typeof registration === 'string') {
      if (buildTargetName) {
        // if it's a string all projects are included but the are no user-specified options
        // and the build task is not inferred by default, so we need to exclude it
        nxJson.plugins[index] = {
          plugin: '@nx/js/typescript',
          exclude: [`${projectRoot}/*`],
        };
      } else {
        isIncluded = true;
      }
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
        // in the appropriate build task being inferred, if not, we need to exclude it
        if (
          registration.options?.typecheck !== false &&
          matchesBuildTargetDefinition(
            registration.options?.build,
            buildTargetName
          )
        ) {
          // it has the desired options, do nothing, but continue processing
          // other registrations to exclude as needed
          isIncluded = true;
        } else {
          // it would not have the typecheck or build task inferred, so we need to exclude it
          registration.exclude ??= [];
          registration.exclude.push(`${projectRoot}/*`);
        }
      } else if (
        !isIncluded &&
        registration.options?.typecheck !== false &&
        matchesBuildTargetDefinition(
          registration.options?.build,
          buildTargetName
        )
      ) {
        if (!registration.exclude?.length) {
          // negative pattern are not supported by the `exclude` option so we
          // can't update it to not exclude the project, so we only update the
          // plugin registration if there's no `exclude` option, in which case
          // the plugin registration should have an `include` options that doesn't
          // include the project
          isIncluded = true;
          registration.include ??= [];
          registration.include.push(`${projectRoot}/*`);
        } else if (registration.exclude?.includes(`${projectRoot}/*`)) {
          isIncluded = true;
          registration.exclude = registration.exclude.filter(
            (e) => e !== `${projectRoot}/*`
          );
          if (!registration.exclude.length) {
            // if there's no `exclude` option left, we can remove the exclude option
            delete registration.exclude;
          }
        }
      }
    }
    index++;
  }

  if (!isIncluded) {
    // the project is not included by any plugin registration with an inferred build task
    // with the given name, so we create a new plugin registration for it
    const registration: ExpandedPluginConfiguration<TscPluginOptions> = {
      plugin: '@nx/js/typescript',
      include: [`${projectRoot}/*`],
      options: {
        typecheck: { targetName: 'typecheck' },
      },
    };

    if (buildTargetName) {
      registration.options.build = {
        targetName: buildTargetName,
        configName: 'tsconfig.lib.json',
      };
    }

    nxJson.plugins.push(registration);
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

function matchesBuildTargetDefinition(
  buildOptions: TscPluginOptions['build'],
  buildTargetName: string | null
): boolean {
  if (buildOptions === undefined || buildOptions === false) {
    return !buildTargetName;
  }

  if (!buildTargetName) {
    return false;
  }

  if (buildOptions === true && buildTargetName === 'build') {
    return true;
  }

  return (
    typeof buildOptions === 'object' &&
    buildOptions.targetName === buildTargetName
  );
}
