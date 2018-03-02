import {
  apply,
  branchAndMerge,
  chain,
  externalSchematic,
  filter,
  MergeStrategy,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  Tree,
  url,
  SchematicContext
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import {strings} from '@angular-devkit/core';
import { addImportToModule, insert, toFileName } from '@nrwl/schematics';
import * as ts from 'typescript';
import { addBootstrapToModule } from '@schematics/angular/utility/ast-utils';
import { insertImport } from '@schematics/angular/utility/route-utils';
import { addApp, serializeJson, cliConfig, readCliConfigFile } from '../../../../shared/fileutils';
import { addImportToTestBed } from '../../../../shared/ast-utils';
import { offsetFromRoot } from '../../../../shared/common';
import {FormatFiles, wrapIntoFormat} from '../../../../shared/tasks';

interface NormalizedSchema extends Schema {
  fullName: string;
  fullPath: string;
}

function addBootstrap(path: string): Rule {
  return (host: Tree) => {
    const modulePath = `${path}/app/app.module.ts`;
    const moduleSource = host.read(modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(modulePath, moduleSource, ts.ScriptTarget.Latest, true);
    insert(host, modulePath, [
      insertImport(sourceFile, modulePath, 'BrowserModule', '@angular/platform-browser'),
      ...addImportToModule(sourceFile, modulePath, 'BrowserModule'),
      ...addBootstrapToModule(sourceFile, modulePath, 'AppComponent', './app.component')
    ]);
    return host;
  };
}

function addNxModule(path: string): Rule {
  return (host: Tree) => {
    const modulePath = `${path}/app/app.module.ts`;
    const moduleSource = host.read(modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(modulePath, moduleSource, ts.ScriptTarget.Latest, true);
    insert(host, modulePath, [
      insertImport(sourceFile, modulePath, 'NxModule', '@nrwl/nx'),
      ...addImportToModule(sourceFile, modulePath, 'NxModule.forRoot()')
    ]);
    return host;
  };
}
function addAppToAngularCliJson(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    if (!host.exists('.angular-cli.json')) {
      throw new Error('Missing .angular-cli.json');
    }

    const sourceText = host.read('.angular-cli.json')!.toString('utf-8');
    const json = JSON.parse(sourceText);
    json.apps = addApp(json.apps, {
      name: options.fullName,
      root: options.fullPath,
      outDir: `dist/apps/${options.fullName}`,
      assets: ['assets', 'favicon.ico'],
      index: 'index.html',
      main: 'main.ts',
      polyfills: 'polyfills.ts',
      test: `${offsetFromRoot(options.fullPath)}test.js`,
      tsconfig: `tsconfig.app.json`,
      testTsconfig: `${offsetFromRoot(options.fullPath)}tsconfig.spec.json`,
      prefix: options.prefix,
      styles: [`styles.${options.style}`],
      scripts: [],
      environmentSource: 'environments/environment.ts',
      environments: {
        dev: 'environments/environment.ts',
        prod: 'environments/environment.prod.ts'
      }
    });

    json.lint = [
      ...(json.lint || []),
      {
        project: `${options.fullPath}/tsconfig.app.json`,
        exclude: '**/node_modules/**'
      },
      {
        project: `apps/${options.fullName}/e2e/tsconfig.e2e.json`,
        exclude: '**/node_modules/**'
      }
    ];

    host.overwrite('.angular-cli.json', serializeJson(json));
    return host;
  };
}

function addRouterRootConfiguration(path: string): Rule {
  return (host: Tree) => {
    const modulePath = `${path}/app/app.module.ts`;
    const moduleSource = host.read(modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(modulePath, moduleSource, ts.ScriptTarget.Latest, true);
    insert(host, modulePath, [
      insertImport(sourceFile, modulePath, 'RouterModule', '@angular/router'),
      ...addImportToModule(sourceFile, modulePath, `RouterModule.forRoot([], {initialNavigation: 'enabled'})`)
    ]);

    const componentSpecPath = `${path}/app/app.component.spec.ts`;
    const componentSpecSource = host.read(componentSpecPath)!.toString('utf-8');
    const componentSpecSourceFile = ts.createSourceFile(
      componentSpecPath,
      componentSpecSource,
      ts.ScriptTarget.Latest,
      true
    );
    insert(host, componentSpecPath, [
      insertImport(componentSpecSourceFile, componentSpecPath, 'RouterTestingModule', '@angular/router/testing'),
      ...addImportToTestBed(componentSpecSourceFile, componentSpecPath, `RouterTestingModule`)
    ]);
    return host;
  };
}

const staticComponentContent = `
<div style="text-align:center">
  <h1>
    Welcome to an Angular CLI app built with Nrwl Nx!
  </h1>
  <img width="300" src="assets/nx-logo.png">
</div>

<h2>Nx</h2>

An open source toolkit for enterprise Angular applications.

Nx is designed to help you create and build enterprise grade Angular applications. It provides an opinionated approach to application project structure and patterns.

<h2>Quick Start & Documentation</h2>

<a href="https://nrwl.io/nx">Watch a 5-minute video on how to get started with Nx.</a>`;

function updateComponentTemplate(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const content = options.routing
      ? `${staticComponentContent}\n<router-outlet></router-outlet>`
      : staticComponentContent;
    host.overwrite(`${options.fullPath}/app/app.component.html`, content);
  };
}

export default function(schema: Schema): Rule {
  return wrapIntoFormat(() => {
    let npmScope = schema.npmScope;
    if (!npmScope) {
      npmScope = readCliConfigFile().project.npmScope;
    }

    const options = normalizeOptions(schema);
    const templateSource = apply(url('./files'), [
      template({
        utils: strings,
        dot: '.',
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.fullPath),
        ...(options as object),
        npmScope
      })
    ]);

    const selector = `${options.prefix}-root`;

    return chain([
      branchAndMerge(chain([mergeWith(templateSource)])),
      externalSchematic('@schematics/angular', 'module', {
        name: 'app',
        commonModule: false,
        flat: true,
        routing: false,
        sourceDir: options.fullPath,
        spec: false
      }),
      externalSchematic('@schematics/angular', 'component', {
        name: 'app',
        selector: selector,
        sourceDir: options.fullPath,
        flat: true,
        inlineStyle: options.inlineStyle,
        inlineTemplate: options.inlineTemplate,
        spec: !options.skipTests,
        styleext: options.style,
        viewEncapsulation: options.viewEncapsulation,
        changeDetection: options.changeDetection
      }),
      updateComponentTemplate(options),
      addBootstrap(options.fullPath),
      addNxModule(options.fullPath),
      addAppToAngularCliJson(options),
      options.routing ? addRouterRootConfiguration(options.fullPath) : noop()
    ]);
  });
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const fullName = options.directory ? `${toFileName(options.directory)}/${name}` : name;
  const fullPath = `apps/${fullName}/src`;
  return { ...options, sourceDir: 'src', name, fullName, fullPath };
}
