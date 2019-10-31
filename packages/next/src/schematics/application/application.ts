import {
  join,
  JsonObject,
  normalize,
  Path,
  dirname
} from '@angular-devkit/core';
import {
  apply,
  chain,
  externalSchematic,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import {
  assertValidStyle,
  extraEslintDependencies,
  reactEslintJson,
  CSS_IN_JS_DEPENDENCIES
} from '@nrwl/react';
import {
  addLintFiles,
  formatFiles,
  generateProjectLint,
  names,
  NxJson,
  offsetFromRoot,
  toFileName,
  updateJsonInTree,
  updateWorkspace
} from '@nrwl/workspace';
import {
  updateWorkspaceInTree,
  addDepsToPackageJson
} from '@nrwl/workspace/src/utils/ast-utils';
import init from '../init/init';
import { Schema } from './schema';

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
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([
      init({
        skipFormat: true
      }),
      addLintFiles(options.appProjectRoot, options.linter, {
        localConfig: reactEslintJson,
        extraPackageDeps: extraEslintDependencies
      }),
      createApplicationFiles(options),
      createNextServerFiles(options),
      updateNxJson(options),
      addProject(options),
      addCypress(options),
      addJest(options),
      addStyledModuleDependencies(options),
      setDefaults(options),
      formatFiles(options)
    ]);
  };
}

function createNextServerFiles(options: NormalizedSchema) {
  return (host: Tree) => {
    if (options.server) {
      const directory = dirname(join(options.appProjectRoot, options.server));

      host.create(
        join(options.appProjectRoot, options.server),
        `
      // @ts-check
      'use strict';

      /**
       * @typedef {import('http').Server} Server
       * @typedef {import('next/dist/server/next-dev-server').default} DevServer
       */

      const express = require('express');

      /**
       * @param {DevServer} app
       * @param {{dev: string; dir: string; staticMarkup: boolean; quiet: boolean; conf: any; port: number;}} options
       * @returns {Promise<Server>}
       */
      module.exports = async function nextServer(app, options) {
        const handle = app.getRequestHandler();
        const expressApp = express();

        await app.prepare();

        /**
         * @returns {Promise<Server>}
         */
        return new Promise((resolve, reject) => {

          expressApp.all('*', (req, res) => {
            return handle(req, res);
          });

          const server = expressApp.listen(options.port, (err) => {
            err ? reject(err) : resolve(server);
          });
        });
      }
      `
      );

      host.create(
        join(directory, 'server.js'),
        `
      // @ts-check
      'use strict';

      /**
       * Production Nextjs custom server
       * 
       * Usage: run this script with node
       * Adjust dir option for your serve/deploy config
       * 
       * node server.js
       */

      /**
       * @typedef {import('next-server/dist/server/next-server').default} Server
       */

      const NextServer = require('next-server/dist/server/next-server').default;
      const express = require('express');

      const nextApp = new NextServer({
        dir: './dist/apps/<%= name %>',
        staticMarkup: false,
        quiet: false,
        conf: {
          distDir: '.'
        }
      });

      const serve = async () => {
        const handle = nextApp.getRequestHandler();
        const expressApp = express();

        await nextApp.prepare();

        return new Promise((resolve, reject) => {
          expressApp.all('*', (req, res) => {
            return handle(req, res);
          });

          const server = expressApp.listen(4200, err => {
            err ? reject(err) : resolve(server);
          });
        });
      }

      serve().then(server => console.log('Server is running on port 4200'));
      `
      );
    }
  };
}

function createApplicationFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files`), [
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
        ? filter(file => file !== `/specs/index.spec.tsx`)
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
  return updateWorkspaceInTree(json => {
    const architect: { [key: string]: any } = {};
    const { server } = options;

    architect.build = {
      builder: '@nrwl/next:build',
      options: {
        root: options.appProjectRoot,
        outputPath: join(normalize('dist'), options.appProjectRoot)
      }
    };

    architect.serve = {
      builder: '@nrwl/next:dev-server',
      options: {
        buildTarget: `${options.projectName}:build`,
        dev: true
      },
      configurations: {
        production: {
          dev: false
        }
      }
    };

    if (server) {
      architect.serve.options = {
        ...architect.serve.options,
        customServerPath: options.server
      };
    }

    architect.export = {
      builder: '@nrwl/next:export',
      options: {
        buildTarget: `${options.projectName}:build`
      }
    };

    architect.lint = generateProjectLint(
      normalize(options.appProjectRoot),
      join(normalize(options.appProjectRoot), 'tsconfig.json'),
      options.linter
    );

    json.projects[options.projectName] = {
      root: options.appProjectRoot,
      sourceRoot: options.appProjectRoot,
      projectType: 'application',
      schematics: {},
      architect
    };

    json.defaultProject = json.defaultProject || options.projectName;

    return json;
  });
}

function addCypress(options: NormalizedSchema): Rule {
  return options.e2eTestRunner === 'cypress'
    ? externalSchematic('@nrwl/cypress', 'cypress-project', {
        ...options,
        name: options.name + '-e2e',
        directory: options.directory,
        project: options.projectName
      })
    : noop();
}

function addJest(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'jest'
    ? chain([
        externalSchematic('@nrwl/jest', 'jest-project', {
          project: options.projectName,
          supportTsx: true,
          skipSerializers: true,
          setupFile: 'none'
        }),
        updateJsonInTree(
          `${options.appProjectRoot}/tsconfig.spec.json`,
          json => {
            json.compilerOptions.jsx = 'react';
            return json;
          }
        )
      ])
    : noop();
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

function setDefaults(options: NormalizedSchema): Rule {
  return options.skipWorkspaceJson
    ? noop()
    : updateWorkspace(workspace => {
        workspace.extensions.schematics = jsonIdentity(
          workspace.extensions.schematics || {}
        );
        workspace.extensions.schematics['@nrwl/next'] =
          workspace.extensions.schematics['@nrwl/next'] || {};
        const prev = jsonIdentity(
          workspace.extensions.schematics['@nrwl/next']
        );

        workspace.extensions.schematics = {
          ...workspace.extensions.schematics,
          '@nrwl/next': {
            ...prev,
            application: {
              style: options.style,
              linter: options.linter,
              ...jsonIdentity(prev.application)
            }
          }
        };
      });
}

function jsonIdentity(x: any): JsonObject {
  return x as JsonObject;
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

  const fileName = options.pascalCaseFiles ? 'Index' : 'index';

  const styledModule = /^(css|scss|less|styl)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

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
