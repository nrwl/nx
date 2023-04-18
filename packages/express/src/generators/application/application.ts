import {
  convertNxGenerator,
  extractLayoutDirectory,
  formatFiles,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  toJS,
  updateJson,
} from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { applicationGenerator as nodeApplicationGenerator } from '@nx/node';
import { join } from 'path';
import { initGenerator } from '../init/init';
import type { Schema } from './schema';

interface NormalizedSchema extends Schema {
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
  res.send({ message: 'Welcome to ${options.name}!' });
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
  const options = normalizeOptions(tree, schema);
  const initTask = await initGenerator(tree, { ...options, skipFormat: true });
  const applicationTask = await nodeApplicationGenerator(tree, {
    ...schema,
    bundler: 'webpack',
    skipFormat: true,
  });
  addMainFile(tree, options);
  addTypes(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return async () => {
    await initTask();
    await applicationTask();
  };
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const appDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;

  const appsDir = layoutDirectory ?? getWorkspaceLayout(host).appsDir;
  const appProjectRoot = joinPathFragments(appsDir, appDirectory);

  return {
    ...options,
    appProjectRoot,
  };
}
