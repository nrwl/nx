import {
  chain,
  externalSchematic,
  noop,
  Rule,
  Tree,
  SchematicContext,
  schematic,
  mergeWith,
  apply,
  template,
  move,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as ts from 'typescript';
import { insertImport } from '@schematics/angular/utility/ast-utils';
import {
  addImportToModule,
  addImportToTestBed,
  getDecoratorPropertyValueNode,
  insert,
  replaceNodeValue,
  updateJsonInTree,
  readJsonInTree
} from '../../utils/ast-utils';
import { toFileName } from '../../utils/name-utils';
import { offsetFromRoot } from '../../utils/common';
import {
  getNpmScope,
  getWorkspacePath,
  replaceAppNameWithPath,
  angularSchematicNames
} from '../../utils/cli-config-utils';
import { formatFiles } from '../../utils/rules/format-files';
import { join, normalize } from '@angular-devkit/core';
import { readJson } from '../../../../../e2e/utils';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

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

    if (options.skipTests !== true) {
      const componentSpecPath = `${
        options.appProjectRoot
      }/src/app/app.component.spec.ts`;
      const componentSpecSource = host
        .read(componentSpecPath)!
        .toString('utf-8');
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
    }

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

    if (!options.inlineTemplate) {
      return host.overwrite(
        `${options.appProjectRoot}/src/app/app.component.html`,
        content
      );
    }

    const modulePath = `${options.appProjectRoot}/src/app/app.component.ts`;
    const templateNodeValue = getDecoratorPropertyValueNode(
      host,
      modulePath,
      'Component',
      'template',
      '@angular/core'
    );
    replaceNodeValue(
      host,
      modulePath,
      templateNodeValue,
      `\`\n${baseContent}\n\`,\n`
    );
  };
}

function addTsconfigs(options: NormalizedSchema): Rule {
  return chain([
    mergeWith(
      apply(url('./files'), [
        template({
          offsetFromRoot: offsetFromRoot(options.appProjectRoot)
        }),
        move(options.appProjectRoot)
      ])
    ),
    mergeWith(
      apply(url('./files'), [
        template({
          offsetFromRoot: offsetFromRoot(options.e2eProjectRoot)
        }),
        move(options.e2eProjectRoot)
      ])
    )
  ]);
}

function updateProject(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    return chain([
      updateJsonInTree(getWorkspacePath(host), json => {
        const project = json.projects[options.name];
        let fixedProject = replaceAppNameWithPath(
          project,
          options.name,
          options.appProjectRoot
        );

        if (fixedProject.schematics) {
          angularSchematicNames.forEach(type => {
            const schematic = `@schematics/angular:${type}`;
            if (schematic in fixedProject.schematics) {
              fixedProject.schematics[`@nrwl/schematics:${type}`] =
                fixedProject.schematics[schematic];
              delete fixedProject.schematics[schematic];
            }
          });
        }

        delete fixedProject.architect.test;

        fixedProject.architect.lint.options.tsConfig = fixedProject.architect.lint.options.tsConfig.filter(
          path =>
            path !==
            join(normalize(options.appProjectRoot), 'tsconfig.spec.json')
        );
        if (options.e2eTestRunner === 'none') {
          delete json.projects[options.e2eProjectName];
        }
        json.projects[options.name] = fixedProject;
        return json;
      }),
      updateJsonInTree(`${options.appProjectRoot}/tsconfig.app.json`, json => {
        return {
          ...json,
          extends: `./tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.appProjectRoot)}dist/out-tsc/${
              options.appProjectRoot
            }`
          },
          exclude:
            options.unitTestRunner === 'jest'
              ? ['src/test-setup.ts', '**/*.spec.ts']
              : ['src/test.ts', '**/*.spec.ts'],
          include: ['**/*.ts']
        };
      }),
      host => {
        host.delete(`${options.appProjectRoot}/tsconfig.spec.json`);
        return host;
      },
      updateJsonInTree(`${options.appProjectRoot}/tslint.json`, json => {
        return {
          ...json,
          extends: `${offsetFromRoot(options.appProjectRoot)}tslint.json`
        };
      }),
      updateJsonInTree(`/nx.json`, json => {
        const resultJson = {
          ...json,
          projects: {
            ...json.projects,
            [options.name]: { tags: options.parsedTags }
          }
        };
        if (options.e2eTestRunner !== 'none') {
          resultJson.projects[options.e2eProjectName] = { tags: [] };
        }
        return resultJson;
      }),
      host => {
        host.delete(`${options.appProjectRoot}/karma.conf.js`);
        host.delete(`${options.appProjectRoot}/src/test.ts`);
        if (options.e2eTestRunner !== 'protractor') {
          host.delete(`${options.e2eProjectRoot}/src/app.e2e-spec.ts`);
          host.delete(`${options.e2eProjectRoot}/src/app.po.ts`);
          host.delete(`${options.e2eProjectRoot}/protractor.conf.js`);
        }
      },
      (host, context) => {
        if (options.e2eTestRunner === 'protractor') {
          updateJsonInTree('/package.json', json => {
            if (!json.devDependencies.protractor) {
              json.devDependencies.protractor = '~5.4.0';
              context.addTask(new NodePackageInstallTask());
            }
          });
        }
      }
    ]);
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

        project.root = options.e2eProjectRoot;

        project.architect.e2e.options.protractorConfig = `${
          options.e2eProjectRoot
        }/protractor.conf.js`;
        project.architect.lint.options.tsConfig = `${
          options.e2eProjectRoot
        }/tsconfig.e2e.json`;

        json.projects[options.e2eProjectName] = project;
        return json;
      }),
      updateJsonInTree(`${options.e2eProjectRoot}/tsconfig.json`, json => {
        return {
          ...json,
          compilerOptions: {
            ...json.compilerOptions,
            types: [
              ...(json.compilerOptions.types || []),
              'jasmine',
              'jasminewd2'
            ]
          }
        };
      }),
      updateJsonInTree(`${options.e2eProjectRoot}/tsconfig.e2e.json`, json => {
        return {
          ...json,
          extends: `./tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.e2eProjectRoot)}dist/out-tsc/${
              options.e2eProjectRoot
            }`
          }
        };
      })
    ]);
  };
}

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    // Determine the roots where @schematics/angular will place the projects
    // This is not where the projects actually end up
    const angularJson = readJsonInTree(host, getWorkspacePath(host));

    const appProjectRoot = angularJson.newProjectRoot
      ? `${angularJson.newProjectRoot}/${options.name}`
      : options.name;
    const e2eProjectRoot = angularJson.newProjectRoot
      ? `${angularJson.newProjectRoot}/${options.e2eProjectName}`
      : 'e2e';

    return chain([
      externalSchematic('@schematics/angular', 'application', {
        name: options.name,
        inlineStyle: options.inlineStyle,
        inlineTemplate: options.inlineTemplate,
        prefix: options.prefix,
        skipTests: options.skipTests,
        style: options.style,
        viewEncapsulation: options.viewEncapsulation,
        routing: false,
        skipInstall: true
      }),
      addTsconfigs(options),

      move(e2eProjectRoot, options.e2eProjectRoot),

      options.e2eTestRunner === 'protractor'
        ? updateE2eProject(options)
        : noop(),
      options.e2eTestRunner === 'cypress'
        ? schematic('cypress-project', {
            ...options,
            project: options.name
          })
        : noop(),

      move(appProjectRoot, options.appProjectRoot),
      updateProject(options),

      updateComponentTemplate(options),
      addNxModule(options),
      options.routing ? addRouterRootConfiguration(options) : noop(),
      options.unitTestRunner === 'jest'
        ? schematic('jest-project', {
            project: options.name
          })
        : noop(),
      options.unitTestRunner === 'karma'
        ? schematic('karma-project', {
            project: options.name
          })
        : noop(),
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
