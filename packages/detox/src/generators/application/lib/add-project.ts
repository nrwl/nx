import {
  addProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import { NormalizedSchema } from './normalize-options';

export function addProject(host: Tree, options: NormalizedSchema) {
  addProjectConfiguration(host, options.projectName, {
    root: options.projectRoot,
    sourceRoot: `${options.projectRoot}/src`,
    projectType: 'application',
    targets: { ...getTargets(options) },
    tags: [],
    implicitDependencies: options.project ? [options.project] : undefined,
  });
}

function getTargets(options: NormalizedSchema) {
  const architect: { [key: string]: TargetConfiguration } = {};

  architect['build-ios'] = {
    executor: '@nrwl/detox:build',
    options: {
      detoxConfiguration: 'ios.sim.debug',
    },
    configurations: {
      production: {
        detoxConfiguration: 'ios.sim.release',
      },
    },
  };

  architect['test-ios'] = {
    executor: '@nrwl/detox:test',
    options: {
      detoxConfiguration: 'ios.sim.debug',
      buildTarget: `${options.name}:build-ios`,
    },
    configurations: {
      production: {
        detoxConfiguration: 'ios.sim.release',
        buildTarget: `${options.name}:build-ios:prod`,
      },
    },
  };

  architect['build-android'] = {
    executor: '@nrwl/detox:build',
    options: {
      detoxConfiguration: 'android.emu.debug',
    },
    configurations: {
      production: {
        detoxConfiguration: 'android.emu.release',
      },
    },
  };

  architect['test-android'] = {
    executor: '@nrwl/detox:test',
    options: {
      detoxConfiguration: 'android.emu.debug',
      buildTarget: `${options.name}:build-android`,
    },
    configurations: {
      production: {
        detoxConfiguration: 'android.emu.release',
        buildTarget: `${options.name}:build-android:prod`,
      },
    },
  };

  return architect;
}
