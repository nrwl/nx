import {
  chain,
  externalSchematic,
  Rule,
  SchematicContext,
  Tree,
  noop,
} from '@angular-devkit/schematics';
import { join, normalize, Path } from '@angular-devkit/core';
import { updateJsonInTree, toFileName, formatFiles } from '@nrwl/workspace';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';
import { appsDir } from '@nrwl/workspace/src/utils/ast-utils';
import init from '../init/init';
import { Schema } from './schema';
import { mainModule } from 'process';

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

function addMainFile(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    host.overwrite(
      join(options.appProjectRoot, options.js ? 'src/main.js' : 'src/main.ts'),
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
      addMainFile(options),
      addTypes(options),
      options.js ? toJS() : noop(),
      formatFiles(options),
    ])(host, context);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);
  const appProjectRoot = join(normalize(appsDir(host)), appDirectory);

  return {
    ...options,
    appProjectRoot,
  };
}
