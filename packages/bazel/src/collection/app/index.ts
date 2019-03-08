import {
  apply,
  branchAndMerge,
  chain,
  externalSchematic,
  mergeWith,
  noop,
  Rule,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { strings } from '@angular-devkit/core';
import {
  addImportToModule,
  insert,
  addImportToTestBed,
  updateJsonInTree
} from '../../utils/ast-utils';
import { toFileName } from '../../utils/name-utils';
import * as ts from 'typescript';
import {
  addBootstrapToModule,
  insertImport
} from '@schematics/angular/utility/ast-utils';
import { addApp, readCliConfigFile } from '../../utils/fileutils';
import { offsetFromRoot } from '../../utils/common';
import { formatFiles } from '../../utils/rules/format-files';

interface NormalizedSchema extends Schema {
  fullName: string;
  fullPath: string;
  workspaceName: string;
}

function addBootstrap(path: string): Rule {
  return (host: Tree) => {
    const modulePath = `${path}/app/app.module.ts`;
    const moduleSource = host.read(modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(
      modulePath,
      moduleSource,
      ts.ScriptTarget.Latest,
      true
    );
    insert(host, modulePath, [
      insertImport(
        sourceFile,
        modulePath,
        'BrowserModule',
        '@angular/platform-browser'
      ),
      ...addImportToModule(sourceFile, modulePath, 'BrowserModule'),
      ...addBootstrapToModule(
        sourceFile,
        modulePath,
        'AppComponent',
        './app.component'
      )
    ]);
    return host;
  };
}

function addNxModule(path: string): Rule {
  return (host: Tree) => {
    const modulePath = `${path}/app/app.module.ts`;
    const moduleSource = host.read(modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(
      modulePath,
      moduleSource,
      ts.ScriptTarget.Latest,
      true
    );
    insert(host, modulePath, [
      insertImport(sourceFile, modulePath, 'NxModule', '@nrwl/nx'),
      ...addImportToModule(sourceFile, modulePath, 'NxModule.forRoot()')
    ]);
    return host;
  };
}
function addAppToAngularCliJson(options: NormalizedSchema): Rule {
  return updateJsonInTree('.angular-cli.json', angularCliJson => {
    angularCliJson.apps = addApp(angularCliJson.apps, {
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

    angularCliJson.lint = [
      ...(angularCliJson.lint || []),
      {
        project: `${options.fullPath}/tsconfig.app.json`,
        exclude: '**/node_modules/**'
      },
      {
        project: `apps/${options.fullName}/e2e/tsconfig.e2e.json`,
        exclude: '**/node_modules/**'
      }
    ];

    return angularCliJson;
  });
}

function addRouterRootConfiguration(path: string): Rule {
  return (host: Tree) => {
    const modulePath = `${path}/app/app.module.ts`;
    const moduleSource = host.read(modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(
      modulePath,
      moduleSource,
      ts.ScriptTarget.Latest,
      true
    );
    insert(host, modulePath, [
      insertImport(sourceFile, modulePath, 'RouterModule', '@angular/router'),
      ...addImportToModule(
        sourceFile,
        modulePath,
        `RouterModule.forRoot([], {initialNavigation: 'enabled'})`
      )
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
      insertImport(
        componentSpecSourceFile,
        componentSpecPath,
        'RouterTestingModule',
        '@angular/router/testing'
      ),
      ...addImportToTestBed(
        componentSpecSourceFile,
        componentSpecPath,
        `RouterTestingModule`
      )
    ]);
    return host;
  };
}

const staticComponentContent = `
<div style="text-align:center">
  <h1>
    Welcome to an Angular CLI app built with Nrwl Nx!
  </h1>
  <img width="450" src="assets/nx-logo.png">
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

function addBazelBuildFile(path: string): Rule {
  return (host: Tree) => {
    const ngModule = `package(default_visibility = ["//visibility:public"])

load("@angular//:index.bzl", "ng_module")
load("@build_bazel_rules_typescript//:defs.bzl", "ts_library", "ts_web_test")

ng_module(
    name = "app",
    srcs = glob(
        ["*.ts"],
        exclude = ["*.spec.ts"],
    ),
    assets = [
        "app.component.css",
        "app.component.html",
    ],
    deps = [
        "@rxjs",
    ],
)

ts_library(
    name = "test_lib",
    testonly = 1,
    srcs = glob(["*.spec.ts"]),
    deps = [
        ":app",
    ],
)

ts_web_test(
    name = "test",
    bootstrap = ["//:angular_bootstrap_scripts"],
    deps = [
        ":test_lib",
        "//:angular_bundles",
        "//:angular_test_bundles",
    ],
)    
`;

    host.create(`${path}/app/BUILD.bazel`, ngModule);
  };
}

export default function(schema: Schema): Rule {
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
    addBazelBuildFile(options.fullPath),
    addAppToAngularCliJson(options),
    options.routing ? addRouterRootConfiguration(options.fullPath) : noop(),
    formatFiles(options)
  ]);
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const fullName = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;
  const fullPath = `apps/${fullName}/src`;
  const workspaceName = readCliConfigFile().project.name;
  return {
    ...options,
    sourceDir: 'src',
    name,
    fullName,
    fullPath,
    workspaceName
  };
}
