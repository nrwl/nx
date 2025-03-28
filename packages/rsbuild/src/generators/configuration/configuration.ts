import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  generateFiles,
  GeneratorCallback,
  readProjectConfiguration,
  readProjectsConfigurationFromProjectGraph,
  runTasksInSerial,
  type Tree,
} from '@nx/devkit';
import { type Schema } from './schema';
import { normalizeOptions } from './lib';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { initGenerator } from '../init/init';
import { rsbuildVersion } from '../../utils/versions';
import { join } from 'path';

export async function configurationGenerator(tree: Tree, schema: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const projects = readProjectsConfigurationFromProjectGraph(projectGraph);
  let project = projects.projects[schema.project];
  if (!project) {
    project = readProjectConfiguration(tree, schema.project);
    if (!project) {
      throw new Error(
        `Could not find project '${schema.project}'. Please choose a project that exists in the Nx Workspace.`
      );
    }
  }

  const options = await normalizeOptions(tree, schema, project);
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(tree, {
    ...schema,
    skipFormat: true,
    tsConfigName:
      options.projectRoot === '.' ? 'tsconfig.json' : 'tsconfig.base.json',
  });
  tasks.push(jsInitTask);
  const initTask = await initGenerator(tree, { skipFormat: true });
  tasks.push(initTask);

  if (options.skipValidation) {
    const projectJson = readProjectConfiguration(tree, project.name);
    if (projectJson.targets['build']) {
      delete projectJson.targets['build'];
    }
    if (projectJson.targets['serve']) {
      delete projectJson.targets['serve'];
    }
    if (projectJson.targets['dev']) {
      delete projectJson.targets['dev'];
    }
  }

  tasks.push(
    addDependenciesToPackageJson(tree, {}, { '@rsbuild/core': rsbuildVersion })
  );

  generateFiles(tree, join(__dirname, 'files'), options.projectRoot, {
    ...options,
    tpl: '',
  });

  return runTasksInSerial(...tasks);
}

export default configurationGenerator;
