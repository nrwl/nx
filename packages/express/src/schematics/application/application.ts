import {
  chain,
  externalSchematic,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { join, normalize, Path } from '@angular-devkit/core';
import { Schema } from './schema';
import { updateJsonInTree } from '@nrwl/workspace';
import { formatFiles } from '@nrwl/workspace';
import init from '../init/init';
import { appsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { maybeJs } from '@nrwl/workspace/src/utils/rules/to-js';
import { names } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

interface NormalizedSchema extends Schema {
  appProjectRoot: Path;
}

function addTypes(options: NormalizedSchema): Rule {
  const tsConfigPath = join(options.appProjectRoot, 'tsconfig.app.json');
  return updateJsonInTree(tsConfigPath, (json) => {
    json.compilerOptions.types = [...json.compilerOptions.types, 'express'];
    return json;
  });
}

function addAppFiles(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    host.overwrite(
      maybeJs(options, join(options.appProjectRoot, 'src/main.ts')),
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
  };
}

export default function (schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);
    return chain([
      init({ ...options, skipFormat: true }),
      externalSchematic('@nrwl/node', 'application', schema),
      addAppFiles(options),
      addTypes(options),
      formatFiles(options),
    ])(host, context);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${names(options.directory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;
  const appProjectRoot = join(normalize(appsDir(host)), appDirectory);

  return {
    ...options,
    appProjectRoot,
  };
}

export const applicationGenerator = wrapAngularDevkitSchematic(
  '@nrwl/express',
  'application'
);
