import { extraEslintDependencies, reactEslintJson } from '../../utils/lint';
import { NormalizedSchema, Schema } from './schema';
import { createApplicationFiles } from './lib/create-application-files';
import { updateJestConfig } from './lib/update-jest-config';
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
import reactInitGenerator from '../init/init';
import { lintProjectGenerator } from '@nrwl/linter';

async function addLinting(host: Tree, options: NormalizedSchema) {
  let installTask: GeneratorCallback;
  installTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    eslintFilePatterns: [`${options.appProjectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });

  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
    (json) => {
      json.extends = [...reactEslintJson.extends, ...json.extends];
      return json;
    }
  );

  installTask = await addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return installTask;
}

export async function applicationGenerator(host: Tree, schema: Schema) {
  let installTask: GeneratorCallback;

  const options = normalizeOptions(host, schema);

  installTask = await reactInitGenerator(host, {
    ...options,
    skipFormat: true,
  });

  createApplicationFiles(host, options);
  addProject(host, options);
  await addLinting(host, options);
  await addCypress(host, options);
  await addJest(host, options);
  updateJestConfig(host, options);
  addStyledModuleDependencies(host, options.styledModule);
  addRouting(host, options);
  setDefaults(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return installTask;
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);
