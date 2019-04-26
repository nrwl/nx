import {
  chain,
  externalSchematic,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { join, normalize, Path } from '@angular-devkit/core';
import { Schema } from './schema';
import { updateJsonInTree } from '@nrwl/workspace';
import { toFileName } from '@nrwl/workspace';
import ngAdd from '../ng-add/ng-add';

interface NormalizedSchema extends Schema {
  appProjectRoot: Path;
}

function addTypes(options: NormalizedSchema): Rule {
  const tsConfigPath = join(options.appProjectRoot, 'tsconfig.json');
  return updateJsonInTree(tsConfigPath, json => {
    json.compilerOptions.types = [...json.compilerOptions.types, 'express'];
    return json;
  });
}

function addMainFile(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    host.overwrite(
      join(options.appProjectRoot, 'src/main.ts'),
      `/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 **/

import * as express from 'express';

const app = express();

app.get('/api', (req, res) => {
  res.send({message: 'Welcome to ${options.name}!'});
});

const port = process.env.port || 3333;
app.listen(port, (err) => {
  if (err) {
    console.error(err);
  }
  console.log('Listening at http://localhost:' + port);
});    
    `
    );
  };
}

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(schema);
    return chain([
      ngAdd(),
      externalSchematic('@nrwl/node', 'application', schema),
      addMainFile(options),
      addTypes(options)
    ])(host, context);
  };
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);
  const appProjectRoot = join(normalize('apps'), appDirectory);

  return {
    ...options,
    appProjectRoot
  };
}
