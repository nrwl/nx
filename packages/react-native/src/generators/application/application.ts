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

import { NormalizedSchema, normalizeOptions } from './lib/normalize-options';
import initGenerator from '../init/init';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { addE2e } from './lib/add-e2e';
import { Schema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { syncDeps } from '../../executors/sync-deps/sync-deps.impl';
import { PackageJson } from 'nx/src/utils/package-json';
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';

export async function reactNativeApplicationGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return await reactNativeApplicationGeneratorInternal(host, {
    addPlugin: false,
    useProjectJson: true,
    ...schema,
  });
}

export async function reactNativeApplicationGeneratorInternal(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    skipFormat: true,
    addTsPlugin: schema.useTsSolution,
    formatter: schema.formatter,
    platform: 'web',
  });
  tasks.push(jsInitTask);

  const options = await normalizeOptions(host, schema);
  const initTask = await initGenerator(host, { ...options, skipFormat: true });
  tasks.push(initTask);

  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(host));
  }

  await createApplicationFiles(host, options);
  addProject(host, options);

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isTsSolutionSetup) {
    await addProjectToTsSolutionWorkspace(host, options.appProjectRoot);
  }

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
    options.addPlugin,
    'tsconfig.app.json'
  );
  tasks.push(jestTask);

  const webTask = await webConfigurationGenerator(host, {
    ...options,
    project: options.projectName,
    skipFormat: true,
  });
  tasks.push(webTask);

  const e2eTask = await addE2e(host, options);
  tasks.push(e2eTask);

  const chmodTaskGradlewTask = chmodAndroidGradlewFilesTask(
    joinPathFragments(host.root, options.androidProjectRoot)
  );
  tasks.push(chmodTaskGradlewTask);
  tasks.push(addSyncDepsTask(host, options));
  tasks.push(addPodInstallTask(host, options));

  updateTsconfigFiles(
    host,
    options.appProjectRoot,
    'tsconfig.app.json',
    {
      jsx: 'react-jsx',
      module: 'esnext',
      moduleResolution: 'bundler',
      noUnusedLocals: false,
      lib: ['dom'],
    },
    options.linter === 'eslint'
      ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
      : undefined
  );

  sortPackageJsonFields(host, options.appProjectRoot);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

function addSyncDepsTask(
  host: Tree,
  options: NormalizedSchema
): GeneratorCallback {
  const projectPackageJsonPath = joinPathFragments(
    options.appProjectRoot,
    'package.json'
  );
  return async () => {
    const workspacePackageJson = readJson<PackageJson>(host, 'package.json');
    const projectPackageJson = readJson<PackageJson>(
      host,
      projectPackageJsonPath
    );
    await syncDeps(
      options.projectName,
      projectPackageJson,
      projectPackageJsonPath,
      workspacePackageJson
    );
  };
}

function addPodInstallTask(
  host: Tree,
  options: NormalizedSchema
): GeneratorCallback {
  const podInstallTask = runPodInstall(
    joinPathFragments(host.root, options.iosProjectRoot)
  );
  if (options.install) {
    return podInstallTask;
  }
  output.log({
    title: 'Skip `pod install`',
    bodyLines: [
      `run 'nx run ${options.name}:pod-install' to install native modules before running iOS app`,
    ],
  });
  return () => {};
}

export default reactNativeApplicationGenerator;
