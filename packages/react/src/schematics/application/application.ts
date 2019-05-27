import { join, normalize, Path } from '@angular-devkit/core';
import {
  apply,
  chain,
  externalSchematic,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import {
  formatFiles,
  insert,
  names,
  NxJson,
  offsetFromRoot,
  toFileName,
  updateJsonInTree
} from '@nrwl/workspace';
import { addDepsToPackageJson } from '@nrwl/workspace/src/utils/ast-utils';
import ngAdd from '../ng-add/ng-add';
import * as ts from 'typescript';

import { Schema } from './schema';
import { CSS_IN_JS_DEPENDENCIES } from '../../utils/styled';
import { addRouter } from '../../utils/ast-utils';
import { reactRouterVersion } from '../../utils/versions';

interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: Path;
  e2eProjectName: string;
  e2eProjectRoot: Path;
  parsedTags: string[];
  fileName: string;
  styledModule: null | string;
}

export default function(schema: Schema): Rule {
  return (host: Tree) => {
    const options = normalizeOptions(host, schema);

    return chain([
      ngAdd({
        skipFormat: true
      }),
      createApplicationFiles(options),
      updateNxJson(options),
      addProject(options),
      options.e2eTestRunner === 'cypress'
        ? externalSchematic('@nrwl/cypress', 'cypress-project', {
            ...options,
            name: options.name + '-e2e',
            directory: options.directory,
            project: options.projectName
          })
        : noop(),
      options.unitTestRunner === 'jest'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.projectName,
            supportTsx: true,
            skipSerializers: true,
            setupFile: 'none'
          })
        : noop(),
      addStyledModuleDependencies(options),
      addRouting(options),
      formatFiles(options)
    ]);
  };
}

function createApplicationFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/app`), [
      template({
        ...names(options.name),
        ...options,
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.appProjectRoot)
      }),
      options.styledModule
        ? filter(file => !file.endsWith(`.${options.style}`))
        : noop(),
      options.unitTestRunner === 'none'
        ? filter(file => file !== `/src/app/${options.fileName}.spec.tsx`)
        : noop(),
      move(options.appProjectRoot)
    ])
  );
}

function updateNxJson(options: NormalizedSchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', json => {
    json.projects[options.projectName] = { tags: options.parsedTags };
    return json;
  });
}

function addProject(options: NormalizedSchema): Rule {
  return updateJsonInTree('angular.json', json => {
    const architect: { [key: string]: any } = {};

    architect.build = {
      builder: '@nrwl/web:build',
      options: {
        outputPath: join(normalize('dist'), options.appProjectRoot),
        index: join(options.appProjectRoot, 'src/index.html'),
        main: join(options.appProjectRoot, `src/main.tsx`),
        polyfills: join(options.appProjectRoot, 'src/polyfills.ts'),
        tsConfig: join(options.appProjectRoot, 'tsconfig.app.json'),
        assets: [
          join(options.appProjectRoot, 'src/favicon.ico'),
          join(options.appProjectRoot, 'src/assets')
        ],
        styles: options.styledModule
          ? []
          : [join(options.appProjectRoot, `src/styles.${options.style}`)],
        scripts: []
      },
      configurations: {
        production: {
          fileReplacements: [
            {
              replace: join(
                options.appProjectRoot,
                `src/environments/environment.ts`
              ),
              with: join(
                options.appProjectRoot,
                `src/environments/environment.prod.ts`
              )
            }
          ],
          optimization: true,
          outputHashing: 'all',
          sourceMap: false,
          extractCss: true,
          namedChunks: false,
          extractLicenses: true,
          vendorChunk: false,
          budgets: [
            {
              type: 'initial',
              maximumWarning: '2mb',
              maximumError: '5mb'
            }
          ]
        }
      }
    };

    architect.serve = {
      builder: '@nrwl/web:dev-server',
      options: {
        buildTarget: `${options.projectName}:build`
      },
      configurations: {
        production: {
          buildTarget: `${options.projectName}:build:production`
        }
      }
    };

    architect.lint = {
      builder: '@angular-devkit/build-angular:tslint',
      options: {
        tsConfig: [join(options.appProjectRoot, 'tsconfig.app.json')],
        exclude: ['**/node_modules/**']
      }
    };

    json.projects[options.projectName] = {
      root: options.appProjectRoot,
      sourceRoot: join(options.appProjectRoot, 'src'),
      projectType: 'application',
      schematics: {},
      architect
    };
    return json;
  });
}

function addStyledModuleDependencies(options: NormalizedSchema): Rule {
  const extraDependencies = CSS_IN_JS_DEPENDENCIES[options.styledModule];

  return extraDependencies
    ? addDepsToPackageJson(
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : noop();
}

function addRouting(options: NormalizedSchema): Rule {
  return options.routing
    ? chain([
        function addRouterToComponent(host: Tree) {
          const appPath = join(
            options.appProjectRoot,
            `src/app/${options.fileName}.tsx`
          );
          const appFileContent = host.read(appPath).toString('utf-8');
          const appSource = ts.createSourceFile(
            appPath,
            appFileContent,
            ts.ScriptTarget.Latest,
            true
          );

          insert(host, appPath, addRouter(appPath, appSource));
        },
        addDepsToPackageJson({ 'react-router-dom': reactRouterVersion }, {})
      ])
    : noop();
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
  const e2eProjectName = `${appProjectName}-e2e`;

  const appProjectRoot = normalize(`apps/${appDirectory}`);
  const e2eProjectRoot = normalize(`apps/${appDirectory}-e2e`);

  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];

  const fileName = options.pascalCaseFiles ? 'App' : 'app';

  const styledModule = /^(css|scss|less|styl)$/.test(options.style)
    ? null
    : options.style;

  return {
    ...options,
    name: toFileName(options.name),
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags,
    fileName,
    styledModule
  };
}
