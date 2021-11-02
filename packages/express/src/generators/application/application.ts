import {
  convertNxGenerator,
  formatFiles,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  toJS,
  Tree,
  updateJson,
} from '@nrwl/devkit';

import { applicationGenerator as nodeApplicationGenerator } from '@nrwl/node';

import { join } from 'path';
import { Schema } from './schema';
import { initGenerator } from '../init/init';

interface NormalizedSchema extends Schema {
  appProjectRoot: string;
}

function addTypes(tree: Tree, options: NormalizedSchema) {
  const tsConfigPath = join(options.appProjectRoot, 'tsconfig.app.json');
  updateJson(tree, tsConfigPath, (json) => {
    json.compilerOptions.types = [...json.compilerOptions.types, 'express'];
    return json;
  });
}

function addAppFiles(tree: Tree, options: NormalizedSchema) {
  tree.write(
    join(options.appProjectRoot, `src/main.${options.js ? 'js' : 'ts'}`),
    `/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import * as express from 'express';

const app = express();

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to ${options.name}!' });
});

const port = process.env.port || 3333;
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
  const options = normalizeOptions(tree, schema);
  const initTask = await initGenerator(tree, { ...options, skipFormat: true });
  const applicationTask = await nodeApplicationGenerator(tree, {
    ...schema,
    skipFormat: true,
  });
  addAppFiles(tree, options);
  addTypes(tree, options);
  await formatFiles(tree);

  return async () => {
    await initTask();
    await applicationTask();
  };
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${names(options.directory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;
  const { appsDir } = getWorkspaceLayout(host);
  const appProjectRoot = joinPathFragments(appsDir, appDirectory);

  return {
    ...options,
    appProjectRoot,
  };
}
