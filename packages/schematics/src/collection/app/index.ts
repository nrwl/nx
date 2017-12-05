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
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as stringUtils from '@schematics/angular/strings';
import { addImportToModule, insert, toFileName } from '@nrwl/schematics';
import * as ts from 'typescript';
import { addBootstrapToModule } from '@schematics/angular/utility/ast-utils';
import { insertImport } from '@schematics/angular/utility/route-utils';
import { addApp, serializeJson } from '../utility/fileutils';
import { addImportToTestBed } from '../utility/ast-utils';
import { offsetFromRoot } from '../utility/common';

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
      test: `${offsetFromRoot(options)}test.js`,
      tsconfig: `${offsetFromRoot(options)}tsconfig.app.json`,
      testTsconfig: `${offsetFromRoot(options)}tsconfig.spec.json`,
      prefix: options.prefix,
      styles: [`styles.${options.style}`],
      scripts: [],
      environmentSource: 'environments/environment.ts',
      environments: {
        dev: 'environments/environment.ts',
        prod: 'environments/environment.prod.ts'
      }
    });

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

export default function(schema: Schema): Rule {
  const options = normalizeOptions(schema);

  const templateSource = apply(url('./files'), [
    template({ utils: stringUtils, dot: '.', tmpl: '', ...(options as object) })
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

    mergeWith(
      apply(url('./component-files'), [
        options.inlineTemplate ? filter(path => !path.endsWith('.html')) : noop(),
        template({ ...options, tmpl: '' }),
        move(`${options.fullPath}/app`)
      ]),
      MergeStrategy.Overwrite
    ),
    addBootstrap(options.fullPath),
    addNxModule(options.fullPath),
    addAppToAngularCliJson(options),
    options.routing ? addRouterRootConfiguration(options.fullPath) : noop()
  ]);
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const fullName = options.directory ? `${toFileName(options.directory)}/${name}` : name;
  const fullPath = `apps/${fullName}/${options.sourceDir}`;
  return { ...options, name, fullName, fullPath };
}
