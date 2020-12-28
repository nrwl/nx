import {
  apply,
  chain,
  externalSchematic,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { join, normalize, Path } from '@angular-devkit/core';
import { Schema } from './schema';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';
import init from '../init/init';
import { appsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { names } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

interface NormalizedSchema extends Schema {
  appProjectRoot: Path;
}

function addMainFile(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    host.overwrite(
      join(options.appProjectRoot, 'src/main.ts'),
      `/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3333;
  await app.listen(port, () => {
    Logger.log('Listening at http://localhost:' + port + '/' + globalPrefix);
  });
}

bootstrap();
    `
    );
  };
}

function addAppFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files`), [
      template({
        tmpl: '',
        name: options.name,
        root: options.appProjectRoot,
      }),
      move(join(options.appProjectRoot, 'src')),
    ])
  );
}

export default function (schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);
    return chain([
      init({
        ...options,
        skipFormat: true,
      }),
      externalSchematic('@nrwl/node', 'application', schema),
      addMainFile(options),
      addAppFiles(options),
      updateJsonInTree(
        join(options.appProjectRoot, 'tsconfig.app.json'),
        (json) => {
          json.compilerOptions.emitDecoratorMetadata = true;
          json.compilerOptions.target = 'es2015';
          return json;
        }
      ),
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
  '@nrwl/nest',
  'application'
);
