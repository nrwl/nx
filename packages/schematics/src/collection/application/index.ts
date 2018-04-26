import {
  chain,
  externalSchematic,
  move,
  noop,
  Rule,
  Tree
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as ts from 'typescript';
import { insertImport } from '@schematics/angular/utility/route-utils';
import {
  addImportToModule,
  addImportToTestBed,
  insert,
  updateJsonInTree
} from '../../utils/ast-utils';
import { wrapIntoFormat } from '../../utils/tasks';
import { toFileName } from '../../utils/name-utils';
import { offsetFromRoot } from '@nrwl/schematics/src/utils/common';
import {
  getWorkspacePath,
  replaceAppNameWithPath
} from '@nrwl/schematics/src/utils/cli-config-utils';

interface NormalizedSchema extends Schema {
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
}

function addNxModule(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const modulePath = `${options.appProjectRoot}/src/app/app.module.ts`;
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

function addRouterRootConfiguration(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const modulePath = `${options.appProjectRoot}/src/app/app.module.ts`;
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

    const componentSpecPath = `${
      options.appProjectRoot
    }/src/app/app.component.spec.ts`;
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
  <h1>Welcome to app!</h1>
  <img width="300" src="assets/nx-logo.png">
</div>

<h2>This is an Angular CLI app built with Nrwl Nx!</h2>

An open source toolkit for enterprise Angular applications.

Nx is designed to help you create and build enterprise grade Angular applications. It provides an opinionated approach to application project structure and patterns.

<h2>Quick Start & Documentation</h2>

<a href="https://nrwl.io/nx">Watch a 5-minute video on how to get started with Nx.</a>`;

function updateComponentTemplate(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const content = options.routing
      ? `${staticComponentContent}\n<router-outlet></router-outlet>`
      : staticComponentContent;
    host.overwrite(
      `${options.appProjectRoot}/src/app/app.component.html`,
      content
    );
  };
}

function updateProject(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    return chain([
      updateJsonInTree(getWorkspacePath(host), json => {
        const project = json.projects[options.name];
        const fixedProject = replaceAppNameWithPath(
          project,
          options.name,
          options.appProjectRoot
        );
        json.projects[options.name] = fixedProject;
        return json;
      }),
      updateJsonInTree(`${options.appProjectRoot}/tsconfig.app.json`, json => {
        return {
          ...json,
          extends: `${offsetFromRoot(options.appProjectRoot)}tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.appProjectRoot)}dist/out-tsc/${
              options.appProjectRoot
            }`
          }
        };
      }),
      updateJsonInTree(`${options.appProjectRoot}/tsconfig.spec.json`, json => {
        return {
          ...json,
          extends: `${offsetFromRoot(options.appProjectRoot)}tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.appProjectRoot)}dist/out-tsc/${
              options.appProjectRoot
            }`
          }
        };
      }),
      updateJsonInTree(`${options.appProjectRoot}/tslint.json`, json => {
        return {
          ...json,
          extends: `${offsetFromRoot(options.appProjectRoot)}tslint.json`
        };
      }),
      updateJsonInTree(`/nx.json`, json => {
        return {
          ...json,
          projects: {
            ...json.projects,
            [options.name]: { tags: options.parsedTags },
            [options.e2eProjectName]: { tags: [] }
          }
        };
      })
    ])(host, null);
  };
}

function updateE2eProject(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    return chain([
      updateJsonInTree(getWorkspacePath(host), json => {
        const project = json.projects[options.e2eProjectName];
        const fixedProject = replaceAppNameWithPath(
          project,
          options.e2eProjectName,
          options.e2eProjectRoot
        );
        json.projects[options.e2eProjectName] = fixedProject;
        return json;
      }),
      updateJsonInTree(`${options.e2eProjectRoot}/tsconfig.e2e.json`, json => {
        return {
          ...json,
          extends: `${offsetFromRoot(options.e2eProjectRoot)}tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.e2eProjectRoot)}dist/out-tsc/${
              options.e2eProjectRoot
            }`
          }
        };
      })
    ])(host, null);
  };
}

export default function(schema: Schema): Rule {
  return wrapIntoFormat(() => {
    const options = normalizeOptions(schema);
    return chain([
      externalSchematic('@schematics/angular', 'application', {
        ...options,
        routing: false
      }),

      move(options.e2eProjectName, options.e2eProjectRoot),
      updateE2eProject(options),

      move(options.name, options.appProjectRoot),
      updateProject(options),

      updateComponentTemplate(options),
      addNxModule(options),
      options.routing ? addRouterRootConfiguration(options) : noop()
    ]);
  });
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
  const e2eProjectName = `${appProjectName}-e2e`;

  const appProjectRoot = `apps/${appDirectory}`;
  const e2eProjectRoot = `apps/${appDirectory}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];

  return {
    ...options,
    name: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags
  };
}
