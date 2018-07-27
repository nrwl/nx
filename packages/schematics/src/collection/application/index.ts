import {
  chain,
  externalSchematic,
  move,
  noop,
  Rule,
  Tree,
  SchematicContext
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as ts from 'typescript';
import { insertImport } from '@schematics/angular/utility/ast-utils';
import {
  addImportToModule,
  addImportToTestBed,
  insert,
  updateJsonInTree
} from '../../utils/ast-utils';
import { toFileName } from '../../utils/name-utils';
import { offsetFromRoot } from '@nrwl/schematics/src/utils/common';
import {
  getNpmScope,
  getWorkspacePath,
  replaceAppNameWithPath
} from '@nrwl/schematics/src/utils/cli-config-utils';
import { formatFiles } from '../../utils/rules/format-files';
import { updateKarmaConf } from '../../utils/rules/update-karma-conf';

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

function updateComponentTemplate(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const baseContent = `
<div style="text-align:center">
  <h1>Welcome to {{title}}!</h1>
  <img width="300" src="https://raw.githubusercontent.com/nrwl/nx/master/nx-logo.png">
</div>

<h2>This is an Angular CLI app built with Nrwl Nx!</h2>

An open source toolkit for enterprise Angular applications.

Nx is designed to help you create and build enterprise grade Angular applications. It provides an opinionated approach to application project structure and patterns.

<h2>Quick Start & Documentation</h2>

<a href="https://nrwl.io/nx">Watch a 5-minute video on how to get started with Nx.</a>`;
    const content = options.routing
      ? `${baseContent}\n<router-outlet></router-outlet>`
      : baseContent;
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
        json.exclude = json.exclude || [];
        return {
          ...json,
          extends: `${offsetFromRoot(options.appProjectRoot)}tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.appProjectRoot)}dist/out-tsc/${
              options.appProjectRoot
            }`
          },
          include: ['**/*.ts'],
          exclude: [...json.exclude, 'karma.conf.ts']
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
      }),
      host => {
        const karma = host
          .read(`${options.appProjectRoot}/karma.conf.js`)
          .toString();
        host.overwrite(
          `${options.appProjectRoot}/karma.conf.js`,
          karma.replace(
            `'../../coverage${options.appProjectRoot}'`,
            `'${offsetFromRoot(options.appProjectRoot)}coverage'`
          )
        );
      }
    ])(host, null);
  };
}

function updateE2eProject(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    // patching the spec file because of a bug in the CLI application schematic
    // it hardcodes "app" in the e2e tests
    const spec = `${options.e2eProjectRoot}/src/app.e2e-spec.ts`;
    const content = host.read(spec).toString();
    host.overwrite(
      spec,
      content.replace('Welcome to app!', `Welcome to ${options.prefix}!`)
    );

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
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);
    return chain([
      externalSchematic('@schematics/angular', 'application', {
        name: options.name,
        inlineStyle: options.inlineStyle,
        inlineTemplate: options.inlineTemplate,
        prefix: options.prefix,
        skipTests: options.skipTests,
        style: options.style,
        viewEncapsulation: options.viewEncapsulation,
        routing: false
      }),

      move(options.e2eProjectName, options.e2eProjectRoot),
      updateE2eProject(options),

      move(options.name, options.appProjectRoot),
      updateProject(options),

      updateComponentTemplate(options),
      addNxModule(options),
      options.routing ? addRouterRootConfiguration(options) : noop(),
      updateKarmaConf({
        projectName: options.name
      }),
      formatFiles(options)
    ])(host, context);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
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

  const defaultPrefix = getNpmScope(host);
  return {
    ...options,
    prefix: options.prefix ? options.prefix : defaultPrefix,
    name: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags
  };
}
