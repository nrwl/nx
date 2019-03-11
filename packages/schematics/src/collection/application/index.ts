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
  url,
  MergeStrategy
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
  readJsonInTree,
  addDepsToPackageJson
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
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { Framework } from '../../utils/frameworks';
import {
  reactVersions,
  documentRegisterElementVersion,
  angularVersion,
  rxjsVersion,
  angularDevkitVersion
} from '../../lib-versions';

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

function updateBuilders(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    return updateJsonInTree(getWorkspacePath(host), json => {
      const project = json.projects[options.name];

      delete project.architect['extract-i18n'];

      const buildOptions = project.architect.build;
      const serveOptions = project.architect.serve;

      buildOptions.builder = '@nrwl/builders:web-build';
      delete buildOptions.options.es5BrowserSupport;
      delete buildOptions.configurations.production.aot;
      delete buildOptions.configurations.production.buildOptimizer;

      serveOptions.builder = '@nrwl/builders:web-dev-server';
      serveOptions.options.buildTarget = serveOptions.options.browserTarget;
      delete serveOptions.options.browserTarget;
      serveOptions.configurations.production.buildTarget =
        serveOptions.configurations.production.browserTarget;
      delete serveOptions.configurations.production.browserTarget;

      if (options.framework === Framework.React) {
        buildOptions.options.main = buildOptions.options.main.replace(
          '.ts',
          '.tsx'
        );
      }
      return json;
    });
  };
}

function updateApplicationFiles(options: NormalizedSchema): Rule {
  return chain([
    deleteAngularApplicationFiles(options),
    addApplicationFiles(options)
  ]);
}

function addApplicationFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/${options.framework}`), [
      template({
        ...options,
        tmpl: ''
      }),
      move(options.appProjectRoot)
    ]),
    MergeStrategy.Overwrite
  );
}

function deleteAngularApplicationFiles(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const projectRoot = normalize(options.appProjectRoot);
    [
      'src/main.ts',
      'src/polyfills.ts',
      'src/app/app.module.ts',
      'src/app/app.component.ts',
      'src/app/app.component.spec.ts',
      `src/app/app.component.${options.style}`,
      'src/app/app.component.html'
    ].forEach(path => {
      path = join(projectRoot, path);
      if (host.exists(path)) {
        host.delete(path);
      }
    });
  };
}

function updateDependencies(options: NormalizedSchema): Rule {
  let deps = {};
  let devDeps = {};
  switch (options.framework) {
    case Framework.React:
      deps = {
        react: reactVersions.framework,
        'react-dom': reactVersions.framework
      };
      devDeps = {
        '@types/react': reactVersions.reactTypes,
        '@types/react-dom': reactVersions.reactDomTypes,
        'react-testing-library': reactVersions.testingLibrary
      };
      break;

    case Framework.Angular:
      deps = {
        '@angular/animations': angularVersion,
        '@angular/common': angularVersion,
        '@angular/compiler': angularVersion,
        '@angular/core': angularVersion,
        '@angular/forms': angularVersion,
        '@angular/platform-browser': angularVersion,
        '@angular/platform-browser-dynamic': angularVersion,
        '@angular/router': angularVersion,
        'core-js': '^2.5.4',
        rxjs: rxjsVersion,
        'zone.js': '^0.8.26'
      };
      devDeps = {
        '@angular/compiler-cli': angularVersion,
        '@angular/language-service': angularVersion,
        '@angular-devkit/build-angular': angularDevkitVersion,
        codelyzer: '~4.5.0'
      };
      break;

    case Framework.WebComponents:
      deps = {
        'document-register-element': documentRegisterElementVersion
      };
      break;
  }

  return addDepsToPackageJson(deps, devDeps);
}

function updateLinting(options: NormalizedSchema): Rule {
  switch (options.framework) {
    case Framework.Angular:
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
    case Framework.React:
    case Framework.WebComponents:
      return updateJsonInTree(`${options.appProjectRoot}/tslint.json`, json => {
        json.extends = `${offsetFromRoot(options.appProjectRoot)}tslint.json`;
        json.rules = [];
        return json;
      });
  }
}

function addTsconfigs(options: NormalizedSchema): Rule {
  return chain([
    mergeWith(
      apply(url('./files/app'), [
        template({
          ...options,
          offsetFromRoot: offsetFromRoot(options.appProjectRoot)
        }),
        move(options.appProjectRoot)
      ])
    ),
    mergeWith(
      apply(url('./files/app'), [
        template({
          ...options,
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
      options.e2eTestRunner === 'protractor'
        ? addDepsToPackageJson({}, { protractor: '~5.4.0' })
        : noop()
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
        skipInstall: true,
        skipPackageJson: options.framework !== Framework.Angular
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

      options.framework !== Framework.Angular
        ? updateBuilders(options)
        : noop(),
      options.framework === Framework.Angular
        ? updateComponentTemplate(options)
        : updateApplicationFiles(options),
      options.framework === Framework.Angular && options.routing
        ? addRouterRootConfiguration(options)
        : noop(),
      updateDependencies(options),
      updateLinting(options),
      options.unitTestRunner === 'jest'
        ? schematic('jest-project', {
            project: options.name,
            supportTsx: options.framework === Framework.React,
            skipSerializers: options.framework !== Framework.Angular,
            setupFile:
              options.framework === Framework.Angular
                ? 'angular'
                : options.framework === Framework.WebComponents
                ? 'web-components'
                : 'none'
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
  if (options.framework !== Framework.Angular && options.routing) {
    throw new Error(
      `Routing is not supported yet with frameworks other than Angular`
    );
  }

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
