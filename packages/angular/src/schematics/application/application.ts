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
  url,
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
  addLintFiles,
  NxJson,
  Linter,
} from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';
import init from '../init/init';
import {
  addImportToModule,
  addImportToTestBed,
  getDecoratorPropertyValueNode,
} from '../../utils/ast-utils';
import {
  insertImport,
  getProjectConfig,
  updateWorkspaceInTree,
  appsDir,
} from '@nrwl/workspace/src/utils/ast-utils';

interface NormalizedSchema extends Schema {
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
}

const nrwlHomeTemplate = {
  html: `
<header class="flex">
    <img alt="Nx logo" width="75" src="https://nx.dev/assets/images/nx-logo-white.svg" />
    <h1>Welcome to {{title}}!</h1>
</header>
<main>
    <h2>Resources &amp; Tools</h2>
    <p>
      Thank you for using and showing some ♥ for Nx.
    </p>
    <div class="flex github-star-container">
      <a href="https://github.com/nrwl/nx" target="_blank" rel="noopener noreferrer"> If you like Nx, please give it a star:
        <div class="github-star-badge">
          <svg class="material-icons" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            Star
        </div>
      </a>
    </div>
    <p>
      Here are some links to help you get started.
    </p>
    <ul class="resources">
        <li class="col-span-2">
            <a
                    class="resource flex"
                    href="https://connect.nrwl.io/app/courses/nx-workspaces/intro"
            >
                Nx video course
            </a>
        </li>
        <li class="col-span-2">
            <a
                    class="resource flex"
                    href="https://nx.dev/angular/getting-started/what-is-nx"
            >
                Nx video tutorial
            </a>
        </li>
        <li class="col-span-2">
            <a
                    class="resource flex"
                    href="https://nx.dev/angular/tutorial/01-create-application"
            >
                Interactive tutorial
            </a>
        </li>
        <li class="col-span-2">
            <a class="resource flex" href="https://nx.app/">
                <svg width="36" height="36" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M120 15V30C103.44 30 90 43.44 90 60C90 76.56 76.56 90 60 90C43.44 90 30 103.44 30 120H15C6.72 120 0 113.28 0 105V15C0 6.72 6.72 0 15 0H105C113.28 0 120 6.72 120 15Z" fill="#0E2039"/>
                  <path d="M120 30V105C120 113.28 113.28 120 105 120H30C30 103.44 43.44 90 60 90C76.56 90 90 76.56 90 60C90 43.44 103.44 30 120 30Z" fill="white"/>
                </svg>
                <span class="gutter-left">Nx Cloud</span>
            </a>
        </li>
    </ul>
    <h2>Next Steps</h2>
    <p>Here are some things you can do with Nx.</p>
    <details open>
        <summary>Add UI library</summary>
        <pre>
# Generate UI lib
ng g @nrwl/angular:lib ui

# Add a component
ng g @nrwl/angular:component xyz --project ui</pre
        >
    </details>
    <details>
        <summary>View dependency graph</summary>
        <pre>nx dep-graph</pre>
    </details>
    <details>
        <summary>Run affected commands</summary>
        <pre>
# see what's been affected by changes
ng affected:dep-graph

# run tests for current changes
ng affected:test

# run e2e tests for current changes
ng affected:e2e
</pre
        >
    </details>
</main>
  `,
  css: `
/*
 * Remove template code below
 */
:host {
  display: block;
  font-family: sans-serif;
  min-width: 300px;
  max-width: 600px;
  margin: 50px auto;
}

.gutter-left {
  margin-left: 9px;
}

.col-span-2 {
  grid-column: span 2;
}

.flex {
  display: flex;
  align-items: center;
  justify-content: center;
}

header {
  background-color: #143055;
  color: white;
  padding: 5px;
  border-radius: 3px;
}

main {
  padding: 0 36px;
}

p {
  text-align: center;
}

h1 {
  text-align: center;
  margin-left: 18px;
  font-size: 24px;
}

h2 {
  text-align: center;
  font-size: 20px;
  margin: 40px 0 10px 0;
}

.resources {
  text-align: center;
  list-style: none;
  padding: 0;
  display: grid;
  grid-gap: 9px;
  grid-template-columns: 1fr 1fr;
}

.resource {
  color: #0094ba;
  height: 36px;
  background-color: rgba(0, 0, 0, 0);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 3px 9px;
  text-decoration: none;
}

.resource:hover {
  background-color: rgba(68, 138, 255, 0.04);
}

pre {
  padding: 9px;
  border-radius: 4px;
  background-color: black;
  color: #eee;
}

details {
  border-radius: 4px;
  color: #333;
  background-color: rgba(0, 0, 0, 0);
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 3px 9px;
  margin-bottom: 9px;
}

summary {
  cursor: pointer;
  outline: none;
  height: 36px;
  line-height: 36px;
}

.github-star-container {
  margin-top: 12px;
  line-height: 20px;
}

.github-star-container a {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: #333;
}

.github-star-badge {
  color: #24292e;
  display: flex;
  align-items: center;
  font-size: 12px;
  padding: 3px 10px;
  border: 1px solid rgba(27,31,35,.2);
  border-radius: 3px;
  background-image: linear-gradient(-180deg,#fafbfc,#eff3f6 90%);
  margin-left: 4px;
  font-weight: 600;
}

.github-star-badge:hover {
  background-image: linear-gradient(-180deg,#f0f3f6,#e6ebf1 90%);
  border-color: rgba(27,31,35,.35);
  background-position: -.5em;
}
.github-star-badge .material-icons {
  height: 16px;
  width: 16px;
  margin-right: 4px;
}
  `,
};

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
      ),
    ]);

    return host;
  };
}

function updateComponentStyles(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const content = nrwlHomeTemplate.css;

    if (!options.inlineStyle) {
      const filesMap = {
        css: `${options.appProjectRoot}/src/app/app.component.css`,
        scss: `${options.appProjectRoot}/src/app/app.component.scss`,
        less: `${options.appProjectRoot}/src/app/app.component.less`,
        styl: `${options.appProjectRoot}/src/app/app.component.styl`,
      };
      return host.overwrite(filesMap[options.style], content);
    }

    // Inline component update
    const modulePath = `${options.appProjectRoot}/src/app/app.component.ts`;
    const templateNodeValue = getDecoratorPropertyValueNode(
      host,
      modulePath,
      'Component',
      'styles',
      '@angular/core'
    );
    replaceNodeValue(
      host,
      modulePath,
      templateNodeValue,
      `[\`\n${content}\n\`],\n`
    );
  };
}

/**
 *
 * @param options
 */
function updateComponentTemplate(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const content = options.routing
      ? `${nrwlHomeTemplate.html}\n<router-outlet></router-outlet>`
      : nrwlHomeTemplate.html;

    if (!options.inlineTemplate) {
      return host.overwrite(
        `${options.appProjectRoot}/src/app/app.component.html`,
        content
      );
    }

    // Inline component update
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
      `\`\n${nrwlHomeTemplate.html}\n\`,\n`
    );
  };
}

function updateComponentSpec(options: NormalizedSchema) {
  return (host: Tree) => {
    if (options.skipTests !== true) {
      const componentSpecPath = `${options.appProjectRoot}/src/app/app.component.spec.ts`;
      const componentSpecSource = host
        .read(componentSpecPath)!
        .toString('utf-8');
      const componentSpecSourceFile = ts.createSourceFile(
        componentSpecPath,
        componentSpecSource,
        ts.ScriptTarget.Latest,
        true
      );

      host.overwrite(
        componentSpecPath,
        componentSpecSource
          .replace('.content span', 'h1')
          .replace(
            `${options.name} app is running!`,
            `Welcome to ${options.name}!`
          )
      );

      if (options.routing) {
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
          ),
        ]);
      }
    }

    return host;
  };
}

function updateTsLintConfig(options: NormalizedSchema): Rule {
  return chain([
    updateJsonInTree('tslint.json', (json) => {
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
          'use-pipe-transform-interface': true,
        };
      }
      return json;
    }),
    updateJsonInTree(`${options.appProjectRoot}/tslint.json`, (json) => {
      json.extends = `${offsetFromRoot(options.appProjectRoot)}tslint.json`;
      json.linterOptions = {
        exclude: ['!**/*'],
      };
      return json;
    }),
  ]);
}

function addSchematicFiles(
  appProjectRoot: string,
  options: NormalizedSchema
): Rule {
  return chain([
    (host) => host.delete(`${appProjectRoot}/src/favicon.ico`),
    mergeWith(
      apply(url('./files'), [
        template({
          ...options,
          offsetFromRoot: offsetFromRoot(options.appProjectRoot),
        }),
        move(options.appProjectRoot),
      ])
    ),
  ]);
}

function updateProject(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    return chain([
      updateJsonInTree(getWorkspacePath(host), (json) => {
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
          'service',
        ];

        if (fixedProject.schematics) {
          angularSchematicNames.forEach((type) => {
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
          (path) =>
            path !==
              join(normalize(options.appProjectRoot), 'tsconfig.spec.json') &&
            path !==
              join(normalize(options.appProjectRoot), 'e2e/tsconfig.json')
        );
        fixedProject.architect.lint.options.exclude.push(
          '!' + join(normalize(options.appProjectRoot), '**/*')
        );

        if (options.linter === Linter.EsLint) {
          fixedProject.architect.lint.options.linter = Linter.EsLint;
          fixedProject.architect.lint.builder = '@nrwl/linter:lint';
          host.delete(`${options.appProjectRoot}/tslint.json`);
        }

        if (options.e2eTestRunner === 'none') {
          delete json.projects[options.e2eProjectName];
        }
        json.projects[options.name] = fixedProject;
        return json;
      }),
      updateJsonInTree(
        `${options.appProjectRoot}/tsconfig.app.json`,
        (json) => {
          return {
            ...json,
            extends: `./tsconfig.json`,
            compilerOptions: {
              ...json.compilerOptions,
              outDir: `${offsetFromRoot(options.appProjectRoot)}dist/out-tsc`,
            },
            exclude: options.enableIvy
              ? undefined
              : options.unitTestRunner === 'jest'
              ? ['src/test-setup.ts', '**/*.spec.ts']
              : ['src/test.ts', '**/*.spec.ts'],
            include: options.enableIvy ? undefined : ['src/**/*.d.ts'],
          };
        }
      ),
      (host) => {
        host.delete(`${options.appProjectRoot}/tsconfig.spec.json`);
        return host;
      },
      updateJsonInTree(`/nx.json`, (json) => {
        const resultJson = {
          ...json,
          projects: {
            ...json.projects,
            [options.name]: { tags: options.parsedTags },
          },
        };
        if (options.e2eTestRunner === 'protractor') {
          resultJson.projects[options.e2eProjectName] = { tags: [] };
          resultJson.projects[options.e2eProjectName].implicitDependencies = [
            options.name,
          ];
        }
        return resultJson;
      }),
      (host) => {
        host.delete(`${options.appProjectRoot}/karma.conf.js`);
        host.delete(`${options.appProjectRoot}/src/test.ts`);
      },
    ]);
  };
}

function removeE2e(options: NormalizedSchema, e2eProjectRoot: string): Rule {
  return chain([
    (host) => {
      if (host.read(`${e2eProjectRoot}/src/app.e2e-spec.ts`)) {
        host.delete(`${e2eProjectRoot}/src/app.e2e-spec.ts`);
      }
      if (host.read(`${e2eProjectRoot}/src/app.po.ts`)) {
        host.delete(`${e2eProjectRoot}/src/app.po.ts`);
      }
      if (host.read(`${e2eProjectRoot}/protractor.conf.js`)) {
        host.delete(`${e2eProjectRoot}/protractor.conf.js`);
      }
      if (host.read(`${e2eProjectRoot}/tsconfig.json`)) {
        host.delete(`${e2eProjectRoot}/tsconfig.json`);
      }
    },
    updateWorkspace((workspace) => {
      workspace.projects.get(options.name).targets.delete('e2e');
    }),
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
      content.replace(
        `${options.name} app is running!`,
        `Welcome to ${options.name}!`
      )
    );
    const page = `${options.e2eProjectRoot}/src/app.po.ts`;
    const pageContent = host.read(page).toString();
    host.overwrite(page, pageContent.replace(`.content span`, `header h1`));

    return chain([
      updateJsonInTree(getWorkspacePath(host), (json) => {
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
                  '!' + join(normalize(options.e2eProjectRoot), '**/*'),
                ],
              },
            },
          },
        };

        project.architect.e2e.options.protractorConfig = `${options.e2eProjectRoot}/protractor.conf.js`;

        json.projects[options.e2eProjectName] = project;
        delete json.projects[options.name].architect.e2e;
        return json;
      }),
      updateJsonInTree(
        `${options.e2eProjectRoot}/tsconfig.e2e.json`,
        (json) => {
          return {
            ...json,
            extends: `./tsconfig.json`,
            compilerOptions: {
              ...json.compilerOptions,
              outDir: `${offsetFromRoot(options.e2eProjectRoot)}dist/out-tsc`,
            },
          };
        }
      ),
    ]);
  };
}

function addProxyConfig(options: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.name);
    if (projectConfig.architect && projectConfig.architect.serve) {
      const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;

      return chain([
        updateJsonInTree(pathToProxyFile, (json) => {
          return {
            [`/${options.backendProject}`]: {
              target: 'http://localhost:3333',
              secure: false,
            },
          };
        }),
        updateWorkspaceInTree((json) => {
          projectConfig.architect.serve.options.proxyConfig = pathToProxyFile;
          json.projects[options.name] = projectConfig;
          return json;
        }),
      ])(host, context);
    }
  };
}

function enableStrictTypeChecking(schema: Schema): Rule {
  return (host) => {
    const options = normalizeOptions(host, schema);

    // define all the tsconfig files to update
    const configFiles = [
      `${options.appProjectRoot}/tsconfig.json`,
      `${options.e2eProjectRoot}/tsconfig.e2e.json`,
    ];

    const rules: Rule[] = [];

    // iterate each config file, if it exists then update it
    for (const configFile of configFiles) {
      if (!host.exists(configFile)) {
        continue;
      }

      // Update the settings in the tsconfig.app.json to enable strict type checking.
      // This matches the settings defined by the Angular CLI https://angular.io/guide/strict-mode
      const rule = updateJsonInTree(configFile, (json) => {
        // update the TypeScript settings
        json.compilerOptions = {
          ...(json.compilerOptions ?? {}),
          forceConsistentCasingInFileNames: true,
          strict: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        };

        // update Angular Template Settings
        json.angularCompilerOptions = {
          ...(json.angularCompilerOptions ?? {}),
          strictInjectionParameters: true,
          strictTemplates: true,
        };

        return json;
      });

      rules.push(rule);
    }

    // set the default so future applications will default to strict mode
    // unless the user has previously set this to false by default
    const updateAngularWorkspace = updateWorkspace((workspace) => {
      workspace.extensions.schematics = workspace.extensions.schematics || {};

      workspace.extensions.schematics['@nrwl/angular:application'] =
        workspace.extensions.schematics['@nrwl/angular:application'] || {};

      workspace.extensions.schematics['@nrwl/angular:application'].strict =
        workspace.extensions.schematics['@nrwl/angular:application'].strict ??
        options.strict;
    });

    return chain([...rules, updateAngularWorkspace]);
  };
}

export default function (schema: Schema): Rule {
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
      init({
        ...options,
        skipFormat: true,
      }),
      // TODO: Remove this after Angular 10.1.0
      updateJsonInTree('tsconfig.json', () => ({
        files: [],
        include: [],
        references: [],
      })),
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
        skipPackageJson: false,
      }),
      // TODO: Remove this after Angular 10.1.0
      (host) => {
        host.delete('tsconfig.json');
      },
      addSchematicFiles(appProjectRoot, options),
      options.e2eTestRunner === 'protractor'
        ? move(e2eProjectRoot, options.e2eProjectRoot)
        : removeE2e(options, e2eProjectRoot),
      options.e2eTestRunner === 'protractor'
        ? updateE2eProject(options)
        : noop(),
      move(appProjectRoot, options.appProjectRoot),
      updateProject(options),
      updateComponentTemplate(options),
      updateComponentStyles(options),
      updateComponentSpec(options),
      options.routing ? addRouterRootConfiguration(options) : noop(),
      addLintFiles(options.appProjectRoot, options.linter, {
        onlyGlobal: options.linter === Linter.TsLint, // local lint files are added differently when tslint
      }),
      options.linter === 'tslint' ? updateTsLintConfig(options) : noop(),
      options.unitTestRunner === 'jest'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.name,
            supportTsx: false,
            skipSerializers: false,
            setupFile: 'angular',
          })
        : noop(),
      options.unitTestRunner === 'karma'
        ? schematic('karma-project', {
            project: options.name,
          })
        : noop(),
      options.e2eTestRunner === 'cypress'
        ? externalSchematic('@nrwl/cypress', 'cypress-project', {
            name: options.e2eProjectName,
            directory: options.directory,
            project: options.name,
            linter: options.linter,
          })
        : noop(),
      options.backendProject ? addProxyConfig(options) : noop(),
      options.strict ? enableStrictTypeChecking(options) : noop(),
      formatFiles(options),
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

  const appProjectRoot = `${appsDir(host)}/${appDirectory}`;
  const e2eProjectRoot = `${appsDir(host)}/${appDirectory}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const defaultPrefix = getNpmScope(host);
  return {
    ...options,
    prefix: options.prefix ? options.prefix : defaultPrefix,
    name: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags,
  };
}
