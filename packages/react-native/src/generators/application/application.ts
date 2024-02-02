import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  output,
  readJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';

import { addLinting } from '../../utils/add-linting';
import { addJest } from '../../utils/add-jest';
import { chmodAndroidGradlewFilesTask } from '../../utils/chmod-android-gradle-files';
import { runPodInstall } from '../../utils/pod-install-task';
import { webConfigurationGenerator } from '../web-configuration/web-configuration';

import { normalizeOptions } from './lib/normalize-options';
import initGenerator from '../init/init';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { addE2e } from './lib/add-e2e';
import { Schema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { syncDeps } from '../../executors/sync-deps/sync-deps.impl';
import { PackageJson } from 'nx/src/utils/package-json';

export async function reactNativeApplicationGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return await reactNativeApplicationGeneratorInternal(host, {
    addPlugin: false,
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function reactNativeApplicationGeneratorInternal(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const options = await normalizeOptions(host, schema);

  const tasks: GeneratorCallback[] = [];
  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    skipFormat: true,
  });
  tasks.push(jsInitTask);
  const initTask = await initGenerator(host, { ...options, skipFormat: true });
  tasks.push(initTask);

  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(host));
  }

  createApplicationFiles(host, options);
  addProject(host, options);

  const lintTask = await addLinting(host, {
    ...options,
    projectRoot: options.appProjectRoot,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
  });
  tasks.push(lintTask);

  const jestTask = await addJest(
    host,
    options.unitTestRunner,
    options.projectName,
    options.appProjectRoot,
    options.js,
    options.skipPackageJson,
    options.addPlugin
  );
  tasks.push(jestTask);

  const webTask = await webConfigurationGenerator(host, {
    ...options,
    project: options.name,
    skipFormat: true,
  });
  tasks.push(webTask);

  const e2eTask = await addE2e(host, options);
  tasks.push(e2eTask);

  const chmodTaskGradlewTask = chmodAndroidGradlewFilesTask(
    joinPathFragments(host.root, options.androidProjectRoot)
  );
  tasks.push(chmodTaskGradlewTask);

  const podInstallTask = runPodInstall(
    joinPathFragments(host.root, options.iosProjectRoot)
  );
  if (options.install) {
    const workspacePackageJsonPath = joinPathFragments('package.json');
    const projectPackageJsonPath = joinPathFragments(
      options.appProjectRoot,
      'package.json'
    );

    const workspacePackageJson = readJson<PackageJson>(
      host,
      workspacePackageJsonPath
    );
    const projectPackageJson = readJson<PackageJson>(
      host,
      projectPackageJsonPath
    );

    await syncDeps(
      projectPackageJson,
      projectPackageJsonPath,
      workspacePackageJson
    );
    tasks.push(podInstallTask);
  } else {
    output.log({
      title: 'Skip `pod install`',
      bodyLines: [
        `run 'nx run ${options.name}:pod-install' to install native modules before running iOS app`,
      ],
    });
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

export default reactNativeApplicationGenerator;
