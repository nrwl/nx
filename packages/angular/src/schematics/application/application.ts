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
import { updateJsonInTree, readJsonInTree } from '@nrwl/workspace';
import { insert, replaceNodeValue } from '@nrwl/workspace';
import { toFileName } from '@nrwl/workspace';
import { offsetFromRoot } from '@nrwl/workspace';
import {
  getNpmScope,
  getWorkspacePath,
  replaceAppNameWithPath,
  angularSchematicNames
} from '@nrwl/workspace';
import { formatFiles } from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';
import { addE2eTestRunner, addUnitTestRunner } from '../ng-add/ng-add';
import {
  addImportToModule,
  addImportToTestBed,
  getDecoratorPropertyValueNode
} from '../../utils/ast-utils';
import { insertImport } from '@nrwl/workspace/src/utils/ast-utils';

interface NormalizedSchema extends Schema {
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
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
  <img width="450" src="https://raw.githubusercontent.com/nrwl/nx/master/nx-logo.png">
</div>

<p>This is an Angular app built with <a href="https://nx.dev">Nx</a>.</p>
<p>🔎 **Nx is a set of Angular CLI power-ups for modern development.**</p>

<h2>Quick Start & Documentation</h2>

<ul>
<li><a href="https://nx.dev/getting-started/what-is-nx">30-minute video showing all Nx features</a></li>
<li><a href="https://nx.dev/tutorial/01-create-application">Interactive tutorial</a></li>
</ul>
`;
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

function updateLinting(options: NormalizedSchema): Rule {
  return chain([
    updateJsonInTree('tslint.json', json => {
      if (
        json.rulesDirectory &&
        json.rulesDirectory.indexOf('node_modules/codelyzer') === -1
      ) {
        json.rulesDirectory.push('node_modules/codelyzer');
        json.rules = {
          ...json.rules,

          'directive-selector': [true, 'attribute', 'app', 'camelCase'],
          'component-selector': [true, 'element', 'app', 'kebab-case'],
          'no-output-on-prefix': true,
          'use-input-property-decorator': true,
          'use-output-property-decorator': true,
          'use-host-property-decorator': true,
          'no-input-rename': true,
          'no-output-rename': true,
          'use-life-cycle-interface': true,
          'use-pipe-transform-interface': true,
          'component-class-suffix': true,
          'directive-class-suffix': true
        };
      }
      return json;
    }),
    updateJsonInTree(`${options.appProjectRoot}/tslint.json`, json => {
      json.extends = `${offsetFromRoot(options.appProjectRoot)}tslint.json`;
      return json;
    })
  ]);
}

function addTsconfigs(options: NormalizedSchema): Rule {
  return chain([
    mergeWith(
      apply(url('./files'), [
        template({
          ...options,
          offsetFromRoot: offsetFromRoot(options.appProjectRoot)
        }),
        move(options.appProjectRoot)
      ])
    ),
    options.e2eTestRunner === 'protractor'
      ? mergeWith(
          apply(url('./files'), [
            template({
              ...options,
              offsetFromRoot: offsetFromRoot(options.e2eProjectRoot)
            }),
            move(options.e2eProjectRoot)
          ])
        )
      : noop()
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
              fixedProject.schematics[`@nrwl/workspace:${type}`] =
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
      updateJsonInTree(`/nx.json`, json => {
        const resultJson = {
          ...json,
          projects: {
            ...json.projects,
            [options.name]: { tags: options.parsedTags }
          }
        };
        if (options.e2eTestRunner === 'protractor') {
          resultJson.projects[options.e2eProjectName] = { tags: [] };
        }
        return resultJson;
      }),
      host => {
        host.delete(`${options.appProjectRoot}/karma.conf.js`);
        host.delete(`${options.appProjectRoot}/src/test.ts`);
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

function setupTestRunners(options: NormalizedSchema): Rule {
  return chain([addUnitTestRunner(options), addE2eTestRunner(options)]);
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
      setupTestRunners(options),
      externalSchematic('@schematics/angular', 'application', {
        name: options.name,
        inlineStyle: options.inlineStyle,
        inlineTemplate: options.inlineTemplate,
        prefix: options.prefix,
        skipTests: options.skipTests,
        style: options.style,
        viewEncapsulation: options.viewEncapsulation,
        routing: false,
        skipInstall: true,
        skipPackageJson: false
      }),
      addTsconfigs(options),

      options.e2eTestRunner === 'protractor'
        ? move(e2eProjectRoot, options.e2eProjectRoot)
        : host => {
            host.delete(`${e2eProjectRoot}/src/app.e2e-spec.ts`);
            host.delete(`${e2eProjectRoot}/src/app.po.ts`);
            host.delete(`${e2eProjectRoot}/protractor.conf.js`);
            host.delete(`${e2eProjectRoot}/tsconfig.e2e.json`);
          },

      options.e2eTestRunner === 'protractor'
        ? updateE2eProject(options)
        : noop(),
      options.e2eTestRunner === 'cypress'
        ? externalSchematic('@nrwl/cypress', 'cypress-project', {
            name: options.e2eProjectName,
            directory: options.directory,
            project: options.name
          })
        : noop(),

      move(appProjectRoot, options.appProjectRoot),
      updateProject(options),

      updateComponentTemplate(options),
      options.routing ? addRouterRootConfiguration(options) : noop(),
      updateLinting(options),
      options.unitTestRunner === 'jest'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.name,
            supportTsx: false,
            skipSerializers: false,
            setupFile: 'angular'
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

  let e2eProjectName = `${toFileName(options.name)}-e2e`;
  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
  if (options.e2eTestRunner !== 'cypress') {
    e2eProjectName = `${appProjectName}-e2e`;
  }

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
