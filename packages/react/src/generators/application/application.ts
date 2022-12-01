import {
  extendReactEslintJson,
  extraEslintDependencies,
} from '../../utils/lint';
import { NormalizedSchema, Schema } from './schema';
import { createApplicationFiles } from './lib/create-application-files';
import { updateSpecConfig } from './lib/update-jest-config';
import { normalizeOptions } from './lib/normalize-options';
import { addProject } from './lib/add-project';
import { addCypress } from './lib/add-cypress';
import { addJest } from './lib/add-jest';
import { addRouting } from './lib/add-routing';
import { setDefaults } from './lib/set-defaults';
import { addStyledModuleDependencies } from '../../rules/add-styled-dependencies';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import reactInitGenerator from '../init/init';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { swcCoreVersion } from '@nrwl/js/src/utils/versions';
import { swcLoaderVersion } from '@nrwl/webpack/src/utils/versions';
import { viteConfigurationGenerator, vitestGenerator } from '@nrwl/vite';
import { mapLintPattern } from '@nrwl/linter/src/generators/lint-project/lint-project';

async function addLinting(host: Tree, options: NormalizedSchema) {
  const tasks: GeneratorCallback[] = [];
  if (options.linter === Linter.EsLint) {
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      eslintFilePatterns: [
        mapLintPattern(
          options.appProjectRoot,
          '{ts,tsx,js,jsx}',
          options.rootProject
        ),
      ],
      skipFormat: true,
      rootProject: options.rootProject,
    });
    tasks.push(lintTask);

    updateJson(
      host,
      joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
      extendReactEslintJson
    );

    const installTask = await addDependenciesToPackageJson(
      host,
      extraEslintDependencies.dependencies,
      {
        ...extraEslintDependencies.devDependencies,
        ...(options.compiler === 'swc'
          ? { '@swc/core': swcCoreVersion, 'swc-loader': swcLoaderVersion }
          : {}),
      }
    );
    tasks.push(installTask);
  }
  return runTasksInSerial(...tasks);
}

export async function applicationGenerator(host: Tree, schema: Schema) {
  const tasks = [];

  const options = normalizeOptions(host, schema);

  const initTask = await reactInitGenerator(host, {
    ...options,
    skipFormat: true,
    skipBabelConfig: options.bundler === 'vite',
    skipHelperLibs: options.bundler === 'vite',
  });

  tasks.push(initTask);

  createApplicationFiles(host, options);
  addProject(host, options);

  if (options.bundler === 'vite') {
    // We recommend users use `import.meta.env.MODE` and other variables in their code to differentiate between production and development.
    // See: https://vitejs.dev/guide/env-and-mode.html
    host.delete(joinPathFragments(options.appProjectRoot, 'src/environments'));

    const viteTask = await viteConfigurationGenerator(host, {
      uiFramework: 'react',
      project: options.projectName,
      newProject: true,
      includeVitest: true,
    });
    tasks.push(viteTask);
  }

  if (options.bundler !== 'vite' && options.unitTestRunner === 'vitest') {
    const vitestTask = await vitestGenerator(host, {
      uiFramework: 'react',
      project: options.projectName,
      inSourceTests: options.inSourceTests,
    });
    tasks.push(vitestTask);
  }

  if (
    (options.bundler === 'vite' || options.unitTestRunner === 'vitest') &&
    options.inSourceTests
  ) {
    host.delete(
      joinPathFragments(
        options.appProjectRoot,
        `src/app/${options.fileName}.spec.tsx`
      )
    );
  }

  const lintTask = await addLinting(host, options);
  tasks.push(lintTask);

  const cypressTask = await addCypress(host, options);
  tasks.push(cypressTask);

  if (options.unitTestRunner === 'jest') {
    const jestTask = await addJest(host, options);
    tasks.push(jestTask);
  }

  // Handle tsconfig.spec.json for jest or vitest
  updateSpecConfig(host, options);
  const styledTask = addStyledModuleDependencies(host, options.styledModule);
  tasks.push(styledTask);
  const routingTask = addRouting(host, options);
  tasks.push(routingTask);
  setDefaults(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);
