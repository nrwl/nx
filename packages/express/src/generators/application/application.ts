import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  readNxJson,
  runTasksInSerial,
  toJS,
  updateJson,
} from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { applicationGenerator as nodeApplicationGenerator } from '@nx/node';
import { tslibVersion } from '@nx/node/src/utils/versions';
import { join } from 'path';
import { nxVersion } from '../../utils/versions';
import { initGenerator } from '../init/init';
import type { Schema } from './schema';

interface NormalizedSchema extends Schema {
  appProjectName: string;
  appProjectRoot: string;
}

function addTypes(tree: Tree, options: NormalizedSchema) {
  updateJson(
    tree,
    join(options.appProjectRoot, 'tsconfig.app.json'),
    (json) => {
      json.compilerOptions.types = [...json.compilerOptions.types, 'express'];
      return json;
    }
  );
}

function addMainFile(tree: Tree, options: NormalizedSchema) {
  tree.write(
    join(options.appProjectRoot, `src/main.${options.js ? 'js' : 'ts'}`),
    `/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import express from 'express';
import * as path from 'path';

const app = express();

app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to ${options.appProjectName}!' });
});

const port = process.env.PORT || 3333;
const server = app.listen(port, () => {
  console.log(\`Listening at http://localhost:\${port}/api\`);
});
server.on('error', console.error);
`
  );

  if (options.js) {
    toJS(tree);
  }
}

export async function applicationGenerator(tree: Tree, schema: Schema) {
  return await applicationGeneratorInternal(tree, {
    addPlugin: false,
    ...schema,
  });
}

export async function applicationGeneratorInternal(tree: Tree, schema: Schema) {
  assertNotUsingTsSolutionSetup(tree, 'express', 'application');

  const options = await normalizeOptions(tree, schema);

  const tasks: GeneratorCallback[] = [];
  const initTask = await initGenerator(tree, { ...options, skipFormat: true });
  tasks.push(initTask);
  const applicationTask = await nodeApplicationGenerator(tree, {
    ...options,
    bundler: 'webpack',
    skipFormat: true,
  });
  tasks.push(applicationTask);
  addMainFile(tree, options);
  addTypes(tree, options);

  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(tree));
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureProjectName(host, options, 'application');
  const { projectName: appProjectName, projectRoot: appProjectRoot } =
    await determineProjectNameAndRootOptions(host, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
    });
  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPlugin;

  return {
    ...options,
    appProjectName,
    appProjectRoot,
  };
}

function ensureDependencies(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    { tslib: tslibVersion },
    { '@nx/express': nxVersion }
  );
}
