import {
  apply,
  chain,
  externalSchematic,
  mergeWith,
  move,
  noop,
  Rule,
  schematic,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import * as ts from 'typescript';
import {
  formatFiles,
  getNpmScope,
  getWorkspacePath,
  insert,
  offsetFromRoot,
  readJsonInTree,
  replaceAppNameWithPath,
  replaceNodeValue,
  toFileName,
  updateJsonInTree,
  updateWorkspace,
  addLintFiles
} from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';
import ngAdd from '../ng-add/ng-add';
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

<p>This is an Angular app built with <a href="https://nx.dev/angular">Nx</a>.</p>
<p>🔎 **Nx is a set of Extensible Dev Tools for Monorepos.**</p>

<h2>Quick Start & Documentation</h2>

<ul>
<li><a href="https://nx.dev/angular/getting-started/what-is-nx">10-minute video showing all Nx features</a></li>
<li><a href="https://nx.dev/angular/tutorial/01-create-application">Interactive tutorial</a></li>
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
          'no-conflicting-lifecycle': true,
          'no-host-metadata-property': true,
          'no-input-rename': true,
          'no-inputs-metadata-property': true,
          'no-output-native': true,
          'no-output-on-prefix': true,
          'no-output-rename': true,
          'no-outputs-metadata-property': true,
          'template-banana-in-box': true,
          'template-no-negated-async': true,
          'use-lifecycle-interface': true,
          'use-pipe-transform-interface': true
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

        const angularSchematicNames = [
          'class',
          'component',
          'directive',
          'guard',
          'module',
          'pipe',
          'service'
        ];

        if (fixedProject.schematics) {
          angularSchematicNames.forEach(type => {
            const schematic = `@schematics/angular:${type}`;
            if (schematic in fixedProject.schematics) {
              fixedProject.schematics[`@nrwl/angular:${type}`] =
                fixedProject.schematics[schematic];
              delete fixedProject.schematics[schematic];
            }
          });
        }

        delete fixedProject.architect.test;

        fixedProject.architect.lint.options.tsConfig = fixedProject.architect.lint.options.tsConfig.filter(
          path =>
            path !==
              join(normalize(options.appProjectRoot), 'tsconfig.spec.json') &&
            path !==
              join(normalize(options.appProjectRoot), 'e2e/tsconfig.json')
        );
        fixedProject.architect.lint.options.exclude.push(
          '!' + join(normalize(options.appProjectRoot), '**')
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
            outDir: `${offsetFromRoot(options.appProjectRoot)}dist/out-tsc`
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

function removeE2e(options: NormalizedSchema, e2eProjectRoot: string): Rule {
  return chain([
    host => {
      host.delete(`${e2eProjectRoot}/src/app.e2e-spec.ts`);
      host.delete(`${e2eProjectRoot}/src/app.po.ts`);
      host.delete(`${e2eProjectRoot}/protractor.conf.js`);
      host.delete(`${e2eProjectRoot}/tsconfig.json`);
    },
    updateWorkspace(workspace => {
      workspace.projects.get(options.name).targets.delete('e2e');
    })
  ]);
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
        const project = {
          root: options.e2eProjectRoot,
          projectType: 'application',
          architect: {
            e2e: json.projects[options.name].architect.e2e,
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: `${options.e2eProjectRoot}/tsconfig.e2e.json`,
                exclude: [
                  '**/node_modules/**',
                  '!' + join(normalize(options.e2eProjectRoot), '**')
                ]
              }
            }
          }
        };

        project.architect.e2e.options.protractorConfig = `${
          options.e2eProjectRoot
        }/protractor.conf.js`;

        json.projects[options.e2eProjectName] = project;
        delete json.projects[options.name].architect.e2e;
        return json;
      }),
      updateJsonInTree(`${options.e2eProjectRoot}/tsconfig.e2e.json`, json => {
        return {
          ...json,
          extends: `./tsconfig.json`,
          compilerOptions: {
            ...json.compilerOptions,
            outDir: `${offsetFromRoot(options.e2eProjectRoot)}dist/out-tsc`
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
    const workspaceJson = readJsonInTree(host, getWorkspacePath(host));

    const appProjectRoot = workspaceJson.newProjectRoot
      ? `${workspaceJson.newProjectRoot}/${options.name}`
      : options.name;
    const e2eProjectRoot = workspaceJson.newProjectRoot
      ? `${workspaceJson.newProjectRoot}/${options.e2eProjectName}`
      : `${options.name}/e2e`;

    return chain([
      ngAdd({
        ...options,
        skipFormat: true
      }),
      addLintFiles(options.appProjectRoot, options.linter, {
        onlyGlobal: true
      }),
      externalSchematic('@schematics/angular', 'application', {
        name: options.name,
        inlineStyle: options.inlineStyle,
        inlineTemplate: options.inlineTemplate,
        prefix: options.prefix,
        skipTests: options.skipTests,
        style: options.style,
        viewEncapsulation: options.viewEncapsulation,
        enableIvy: options.enableIvy,
        routing: false,
        skipInstall: true,
        skipPackageJson: false
      }),
      addTsconfigs(options),
      options.e2eTestRunner === 'protractor'
        ? move(e2eProjectRoot, options.e2eProjectRoot)
        : removeE2e(options, e2eProjectRoot),
      options.e2eTestRunner === 'protractor'
        ? updateE2eProject(options)
        : noop(),
      options.e2eTestRunner === 'cypress'
        ? externalSchematic('@nrwl/cypress', 'cypress-project', {
            name: options.e2eProjectName,
            directory: options.directory,
            project: options.name,
            linter: options.linter
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
