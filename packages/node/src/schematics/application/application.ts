import { join, normalize, Path } from '@angular-devkit/core';
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
import { names, offsetFromRoot } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import {
  formatFiles,
  getProjectConfig,
  updateJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import { appsDir } from '@nrwl/workspace/src/utils/ast-utils';
import {
  maybeJs,
  toJS,
  updateTsConfigsToJs,
} from '@nrwl/workspace/src/utils/rules/to-js';
import init from '../init/init';
import { Schema } from './schema';

interface NormalizedSchema extends Schema {
  appProjectRoot: Path;
  parsedTags: string[];
}

function updateNxJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(`/nx.json`, (json) => {
    return {
      ...json,
      projects: {
        ...json.projects,
        [options.name]: { tags: options.parsedTags },
      },
    };
  });
}

function getBuildConfig(project: any, options: NormalizedSchema) {
  return {
    builder: '@nrwl/node:build',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: join(normalize('dist'), options.appProjectRoot),
      main: maybeJs(options, join(project.sourceRoot, 'main.ts')),
      tsConfig: join(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [join(project.sourceRoot, 'assets')],
    },
    configurations: {
      production: {
        optimization: true,
        extractLicenses: true,
        inspect: false,
        fileReplacements: [
          {
            replace: maybeJs(
              options,
              join(project.sourceRoot, 'environments/environment.ts')
            ),
            with: maybeJs(
              options,
              join(project.sourceRoot, 'environments/environment.prod.ts')
            ),
          },
        ],
      },
    },
  };
}

function getServeConfig(options: NormalizedSchema) {
  return {
    builder: '@nrwl/node:execute',
    options: {
      buildTarget: `${options.name}:build`,
    },
  };
}

function updateWorkspaceJson(options: NormalizedSchema): Rule {
  return updateWorkspaceInTree((workspaceJson) => {
    const project = {
      root: options.appProjectRoot,
      sourceRoot: join(options.appProjectRoot, 'src'),
      projectType: 'application',
      prefix: options.name,
      architect: <any>{},
    };

    project.architect.build = getBuildConfig(project, options);
    project.architect.serve = getServeConfig(options);

    workspaceJson.projects[options.name] = project;

    workspaceJson.defaultProject = workspaceJson.defaultProject || options.name;

    return workspaceJson;
  });
}

function addAppFiles(options: NormalizedSchema): Rule {
  return chain([
    mergeWith(
      apply(url(`./files/app`), [
        template({
          tmpl: '',
          name: options.name,
          root: options.appProjectRoot,
          offset: offsetFromRoot(options.appProjectRoot),
        }),
        move(options.appProjectRoot),
        options.js ? toJS() : noop(),
      ])
    ),
    options.pascalCaseFiles
      ? (tree, context) => {
          context.logger.warn('NOTE: --pascalCaseFiles is a noop');
          return tree;
        }
      : noop(),
  ]);
}

function addProxy(options: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.frontendProject);
    if (projectConfig.architect && projectConfig.architect.serve) {
      const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;

      if (!host.exists(pathToProxyFile)) {
        host.create(
          pathToProxyFile,
          JSON.stringify(
            {
              '/api': {
                target: 'http://localhost:3333',
                secure: false,
              },
            },
            null,
            2
          )
        );
      } else {
        //add new entry to existing config
        const proxyFileContent = host.get(pathToProxyFile).content.toString();

        const proxyModified = {
          ...JSON.parse(proxyFileContent),
          [`/${options.name}-api`]: {
            target: 'http://localhost:3333',
            secure: false,
          },
        };

        host.overwrite(pathToProxyFile, JSON.stringify(proxyModified, null, 2));
      }

      updateWorkspaceInTree((json) => {
        projectConfig.architect.serve.options.proxyConfig = pathToProxyFile;
        json.projects[options.frontendProject] = projectConfig;
        return json;
      })(host, context);
    }
  };
}

function addJest(options: NormalizedSchema) {
  return options.unitTestRunner === 'jest'
    ? externalSchematic('@nrwl/jest', 'jest-project', {
        project: options.name,
        setupFile: 'none',
        skipSerializers: true,
        supportTsx: options.js,
        babelJest: options.babelJest,
      })
    : noop();
}

export default function (schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);
    return chain([
      init({
        ...options,
        skipFormat: true,
      }),
      addAppFiles(options),
      options.js
        ? updateTsConfigsToJs({ projectRoot: options.appProjectRoot })
        : noop,
      updateWorkspaceJson(options),
      updateNxJson(options),
      addJest(options),
      options.frontendProject ? addProxy(options) : noop(),

      schematic('add-linting-to-application', {
        linter: options.linter,
        projectName: options.name,
        projectRoot: options.appProjectRoot,
        js: options.js,
      }),

      formatFiles(options),
    ])(host, context);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${names(options.directory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');

  const appProjectRoot = join(normalize(appsDir(host)), appDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    name: names(appProjectName).fileName,
    frontendProject: options.frontendProject
      ? names(options.frontendProject).fileName
      : undefined,
    appProjectRoot,
    parsedTags,
  };
}

export const applicationGenerator = wrapAngularDevkitSchematic(
  '@nrwl/node',
  'application'
);
