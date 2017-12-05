import {
  apply,
  branchAndMerge,
  chain,
  externalSchematic,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { addImportToModule, insert, names, toClassName, toFileName, toPropertyName } from '@nrwl/schematics';
import * as path from 'path';
import { serializeJson, addApp, cliConfig } from '../utility/fileutils';
import { insertImport } from '@schematics/angular/utility/route-utils';
import * as ts from 'typescript';
import { addGlobal, addReexport, addRoute } from '../utility/ast-utils';
import { offsetFromRoot } from '../utility/common';

interface NormalizedSchema extends Schema {
  name: string;
  fullName: string;
  fullPath: string;
}

function addLibToAngularCliJson(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const json = cliConfig(host);
    json.apps = addApp(json.apps, {
      name: options.fullName,
      root: options.fullPath,
      test: `${offsetFromRoot(options)}test.js`,
      appRoot: ''
    });

    host.overwrite('.angular-cli.json', serializeJson(json));
    return host;
  };
}

function addLazyLoadedRouterConfiguration(modulePath: string): Rule {
  return (host: Tree) => {
    const moduleSource = host.read(modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(modulePath, moduleSource, ts.ScriptTarget.Latest, true);
    insert(host, modulePath, [
      insertImport(sourceFile, modulePath, 'RouterModule', '@angular/router'),
      ...addImportToModule(
        sourceFile,
        modulePath,
        `
        RouterModule.forChild([ 
        /* {path: '', pathMatch: 'full', component: InsertYourComponentHere} */ 
       ]) `
      )
    ]);
    return host;
  };
}

function addRouterConfiguration(
  schema: NormalizedSchema,
  indexFilePath: string,
  moduleFileName: string,
  modulePath: string
): Rule {
  return (host: Tree) => {
    const indexSource = host.read(indexFilePath)!.toString('utf-8');
    const indexSourceFile = ts.createSourceFile(indexFilePath, indexSource, ts.ScriptTarget.Latest, true);
    const moduleSource = host.read(modulePath)!.toString('utf-8');
    const moduleSourceFile = ts.createSourceFile(modulePath, moduleSource, ts.ScriptTarget.Latest, true);
    const constName = `${toPropertyName(schema.name)}Routes`;

    insert(host, modulePath, [
      insertImport(moduleSourceFile, modulePath, 'RouterModule, Route', '@angular/router'),
      ...addImportToModule(moduleSourceFile, modulePath, `RouterModule`),
      ...addGlobal(moduleSourceFile, modulePath, `export const ${constName}: Route[] = [];`)
    ]);
    insert(host, indexFilePath, [...addReexport(indexSourceFile, indexFilePath, moduleFileName, constName)]);
    return host;
  };
}

function addLoadChildren(schema: NormalizedSchema): Rule {
  return (host: Tree) => {
    const json = cliConfig(host);

    const moduleSource = host.read(schema.parentModule)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(schema.parentModule, moduleSource, ts.ScriptTarget.Latest, true);

    const loadChildren = `@${json.project.npmScope}/${toFileName(schema.fullName)}#${toClassName(schema.name)}Module`;
    insert(host, schema.parentModule, [
      ...addRoute(
        schema.parentModule,
        sourceFile,
        `{path: '${toFileName(schema.name)}', loadChildren: '${loadChildren}'}`
      )
    ]);
    return host;
  };
}

function addChildren(schema: NormalizedSchema): Rule {
  return (host: Tree) => {
    const json = cliConfig(host);

    const moduleSource = host.read(schema.parentModule)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(schema.parentModule, moduleSource, ts.ScriptTarget.Latest, true);
    const constName = `${toPropertyName(schema.name)}Routes`;
    const importPath = `@${json.project.npmScope}/${toFileName(schema.fullName)}`;

    insert(host, schema.parentModule, [
      insertImport(sourceFile, schema.parentModule, constName, importPath),
      ...addRoute(schema.parentModule, sourceFile, `{path: '${toFileName(schema.name)}', children: ${constName}}`)
    ]);
    return host;
  };
}

function updateTsLint(schema: NormalizedSchema): Rule {
  return (host: Tree) => {
    const tsLint = JSON.parse(host.read('tslint.json')!.toString('utf-8'));
    if (
      tsLint['rules'] &&
      tsLint['rules']['nx-enforce-module-boundaries'] &&
      tsLint['rules']['nx-enforce-module-boundaries'][1] &&
      tsLint['rules']['nx-enforce-module-boundaries'][1]['lazyLoad']
    ) {
      tsLint['rules']['nx-enforce-module-boundaries'][1]['lazyLoad'].push(toFileName(schema.fullName));
      host.overwrite('tslint.json', serializeJson(tsLint));
    }
    return host;
  };
}

export default function(schema: Schema): Rule {
  const options = normalizeOptions(schema);
  const moduleFileName = `${toFileName(options.name)}.module`;
  const modulePath = `${options.fullPath}/${moduleFileName}.ts`;
  const indexFile = `libs/${toFileName(options.fullName)}/index.ts`;

  if (options.routing && options.nomodule) {
    throw new Error(`nomodule and routing cannot be used together`);
  }

  if (!options.routing && options.lazy) {
    throw new Error(`routing must be set`);
  }

  const templateSource = apply(url(options.nomodule ? './files' : './ngfiles'), [
    template({
      ...names(options.name),
      dot: '.',
      tmpl: '',
      ...(options as object)
    })
  ]);

  return chain([
    branchAndMerge(chain([mergeWith(templateSource)])),
    addLibToAngularCliJson(options),
    options.routing && options.lazy ? addLazyLoadedRouterConfiguration(modulePath) : noop(),
    options.routing && options.lazy ? updateTsLint(options) : noop(),
    options.routing && options.lazy && options.parentModule ? addLoadChildren(options) : noop(),

    options.routing && !options.lazy ? addRouterConfiguration(options, indexFile, moduleFileName, modulePath) : noop(),
    options.routing && !options.lazy && options.parentModule ? addChildren(options) : noop()
  ]);
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const fullName = options.directory ? `${toFileName(options.directory)}/${name}` : name;
  const fullPath = `libs/${fullName}/${options.sourceDir}`;
  return { ...options, name, fullName, fullPath };
}
