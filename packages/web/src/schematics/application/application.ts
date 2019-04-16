import { join, normalize } from '@angular-devkit/core';
import {
  chain,
  Rule,
  Tree,
  SchematicContext,
  mergeWith,
  apply,
  template,
  move,
  url,
  externalSchematic,
  noop,
  filter
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { updateJsonInTree, NxJson } from '@nrwl/schematics';
import { toFileName, names } from '@nrwl/schematics/src/utils/name-utils';
import { offsetFromRoot } from '@nrwl/schematics/src/utils/common';
import { getNpmScope } from '@nrwl/schematics/src/utils/cli-config-utils';
import { formatFiles } from '@nrwl/schematics/src/utils/rules/format-files';

interface NormalizedSchema extends Schema {
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
}

function createApplicationFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/app`), [
      template({
        ...options,
        ...names(options.name),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.appProjectRoot)
      }),
      options.unitTestRunner === 'none'
        ? filter(file => file !== '/src/app/app.spec.ts')
        : noop(),
      move(options.appProjectRoot)
    ])
  );
}

function createE2EFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/e2e`), [
      template({
        ...options,
        ...names(options.name),
        offsetFromRoot: offsetFromRoot(options.appProjectRoot)
      }),
      move(options.e2eProjectRoot)
    ])
  );
}

function updateNxJson(options: NormalizedSchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', json => {
    json.projects[options.name] = { tags: options.parsedTags };
    json.projects[options.e2eProjectName] = { tags: [] };
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
        index: join(normalize(options.appProjectRoot), 'src/index.html'),
        main: join(normalize(options.appProjectRoot), 'src/main.ts'),
        polyfills: join(normalize(options.appProjectRoot), 'src/polyfills.ts'),
        tsConfig: join(normalize(options.appProjectRoot), 'tsconfig.app.json'),
        assets: [
          join(normalize(options.appProjectRoot), 'src/favicon.ico'),
          join(normalize(options.appProjectRoot), 'src/assets')
        ],
        styles: [
          join(normalize(options.appProjectRoot), `src/styles.${options.style}`)
        ],
        scripts: []
      },
      configurations: {
        production: {
          fileReplacements: [
            {
              replace: join(
                normalize(options.appProjectRoot),
                `src/environments/environment.ts`
              ),
              with: join(
                normalize(options.appProjectRoot),
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
        buildTarget: `${options.name}:build`
      },
      configurations: {
        production: {
          buildTarget: `${options.name}:build:production`
        }
      }
    };

    architect.lint = {
      builder: '@angular-devkit/build-angular:tslint',
      options: {
        tsConfig: [
          join(normalize(options.appProjectRoot), 'tsconfig.app.json')
        ],
        exclude: ['**/node_modules/**']
      }
    };

    json.projects[options.name] = {
      root: options.appProjectRoot,
      sourceRoot: join(normalize(options.appProjectRoot), 'src'),
      projectType: 'application',
      schematics: {},
      architect
    };
    return json;
  });
}

function addE2EProject(options: NormalizedSchema) {
  return updateJsonInTree('angular.json', json => {
    json.projects[options.e2eProjectName] = {
      root: options.e2eProjectRoot,
      sourceRoot: join(normalize(options.e2eProjectRoot), 'src'),
      projectType: 'application',
      architect: {
        e2e: {},
        lint: {
          builder: '@angular-devkit/build-angular:tslint',
          options: {
            exclude: ['**/node_modules/**']
          }
        }
      }
    };
    return json;
  });
}

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([
      createApplicationFiles(options),
      updateNxJson(options),
      addProject(options),
      options.e2eTestRunner !== 'none'
        ? chain([createE2EFiles(options), addE2EProject(options)])
        : noop(),
      options.e2eTestRunner === 'cypress'
        ? externalSchematic('@nrwl/schematics', 'cypress-project', {
            ...options,
            project: options.name
          })
        : noop(),
      options.unitTestRunner === 'jest'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.name,
            skipSerializers: true,
            setupFile: 'web-components'
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
