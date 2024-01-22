import {
  Tree,
  formatFiles,
  getProjects,
  updateJson,
  ProjectConfiguration,
  offsetFromRoot,
  detectPackageManager,
  getPackageManagerCommand,
  names,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * Update .detoxrc.json under detox project for expo:
 * - fix the eas build command
 * - fix the local build command
 * - update project.json targets
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((project) => {
    if (project.targets?.['test-ios']?.executor !== '@nx/detox:test') return;
    updateDetoxrcJson(tree, project);
    updateProjectJson(tree, project);
  });

  await formatFiles(tree);
}

function updateDetoxrcJson(host: Tree, project: ProjectConfiguration) {
  const detoxConfigPath = `${project.root}/.detoxrc.json`;
  const projectName = project.name?.endsWith('-e2e')
    ? project.name.substring(0, project.name.indexOf('-e2e'))
    : project.name;
  const appRoot = getProjects(host).get(projectName)?.root;
  const appName = names(projectName).className;
  const offset = offsetFromRoot(project.root);
  const exec = getPackageManagerCommand(detectPackageManager(host.root)).exec;
  if (!host.exists(detoxConfigPath)) return;
  updateJson(host, detoxConfigPath, (json) => {
    if (json.apps?.['ios.eas']) {
      json.apps[
        'ios.eas'
      ].build = `${exec} nx run ${projectName}:download --platform ios --distribution simulator --output=${offset}${appRoot}/dist/`;
    }
    if (json.apps?.['android.eas']) {
      json.apps[
        'android.eas'
      ].build = `${exec} nx run ${projectName}:download --platform android --distribution simulator --output=${offset}${appRoot}/dist/`;
      json.apps['android.eas'].type = 'android.apk';
    }
    if (json.apps?.['ios.local']) {
      json.apps[
        'ios.local'
      ].build = `${exec} nx run ${projectName}:build --platform ios --profile preview --wait --local --no-interactive --output=${offset}${appRoot}/dist/${appName}.tar.gz`;
    }
    if (json.apps?.['android.local']) {
      json.apps[
        'android.local'
      ].build = `${exec} nx run ${projectName}:build --platform android --profile preview --wait --local --no-interactive --output=${offset}${appRoot}/dist/${appName}.apk`;
      json.apps['android.local'].type = 'android.apk';
    }
    return json;
  });
}

function updateProjectJson(host: Tree, project: ProjectConfiguration) {
  if (
    project.targets?.['test-ios']?.options?.detoxConfiguration == 'ios.sim.eas'
  ) {
    project.targets['build-ios'].options.detoxConfiguration = 'ios.sim.eas';
  }
  if (
    project.targets?.['test-android']?.options?.detoxConfiguration ==
    'android.sim.eas'
  ) {
    project.targets['build-android'].options.detoxConfiguration =
      'android.sim.eas';
    project.targets['test-android'] = {
      executor: '@nx/detox:test',
      options: {
        detoxConfiguration: 'android.sim.eas',
        buildTarget: `${project.name}:build-android`,
      },
      configurations: {
        local: {
          detoxConfiguration: 'android.emu.local',
          buildTarget: `${project.name}:build-android:local`,
        },
        bare: {
          detoxConfiguration: 'android.emu.debug',
          buildTarget: `${project.name}:build-android:bare`,
        },
        production: {
          detoxConfiguration: 'android.emu.release',
          buildTarget: `${project.name}:build-android:production`,
        },
      },
    };
  }
  updateProjectConfiguration(host, project.name, project);
}
