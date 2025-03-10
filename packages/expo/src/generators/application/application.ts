import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  addProjectToTsSolutionWorkspace,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';

import { addLinting } from '../../utils/add-linting';
import { addJest } from '../../utils/add-jest';

import { normalizeOptions } from './lib/normalize-options';
import initGenerator from '../init/init';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { addEasScripts } from './lib/add-eas-scripts';
import { addE2e } from './lib/add-e2e';
import { Schema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { initRootBabelConfig } from '../../utils/init-root-babel-config';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';

export async function expoApplicationGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  return await expoApplicationGeneratorInternal(host, {
    addPlugin: false,
    useProjectJson: true,
    ...schema,
  });
}

export async function expoApplicationGeneratorInternal(
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

  const options = await normalizeOptions(host, schema);

  tasks.push(jsInitTask);
  const initTask = await initGenerator(host, { ...options, skipFormat: true });
  tasks.push(initTask);
  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(host));
  }
  initRootBabelConfig(host);

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
    options.addPlugin
  );
  tasks.push(jestTask);
  const e2eTask = await addE2e(host, options);
  tasks.push(e2eTask);
  addEasScripts(host);

  updateTsconfigFiles(
    host,
    options.appProjectRoot,
    'tsconfig.app.json',
    {
      jsx: 'react-jsx',
      module: 'esnext',
      moduleResolution: 'bundler',
      noUnusedLocals: false,
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

export default expoApplicationGenerator;
