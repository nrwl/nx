import {
  apply,
  chain,
  externalSchematic,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { join, normalize, Path } from '@angular-devkit/core';
import { Schema } from './schema';
import { updateJsonInTree } from '@nrwl/workspace';
import { toFileName } from '@nrwl/workspace';
import { getProjectConfig } from '@nrwl/workspace';
import { offsetFromRoot } from '@nrwl/workspace';
import ngAdd from '../ng-add/ng-add';

interface NormalizedSchema extends Schema {
  appProjectRoot: Path;
  parsedTags: string[];
}

function updateNxJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(`/nx.json`, json => {
    return {
      ...json,
      projects: {
        ...json.projects,
        [options.name]: { tags: options.parsedTags }
      }
    };
  });
}

function getBuildConfig(project: any, options: NormalizedSchema) {
  return {
    builder: '@nrwl/node:build',
    options: {
      outputPath: join(normalize('dist'), options.appProjectRoot),
      main: join(project.sourceRoot, 'main.ts'),
      tsConfig: join(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [join(project.sourceRoot, 'assets')]
    },
    configurations: {
      production: {
        optimization: true,
        extractLicenses: true,
        inspect: false,
        fileReplacements: [
          {
            replace: join(project.sourceRoot, 'environments/environment.ts'),
            with: join(project.sourceRoot, 'environments/environment.prod.ts')
          }
        ]
      }
    }
  };
}

function getLintConfig(project: any) {
  return {
    builder: '@angular-devkit/build-angular:tslint',
    options: {
      tsConfig: [join(project.root, 'tsconfig.app.json')],
      exclude: ['**/node_modules/**']
    }
  };
}

function getServeConfig(options: NormalizedSchema) {
  return {
    builder: '@nrwl/node:execute',
    options: {
      buildTarget: `${options.name}:build`
    }
  };
}

function updateAngularJson(options: NormalizedSchema): Rule {
  return updateJsonInTree('angular.json', angularJson => {
    const project = {
      root: options.appProjectRoot,
      sourceRoot: join(options.appProjectRoot, 'src'),
      projectType: 'application',
      prefix: options.name,
      schematics: {},
      architect: <any>{}
    };

    project.architect.build = getBuildConfig(project, options);
    project.architect.serve = getServeConfig(options);
    project.architect.lint = getLintConfig(project);
    angularJson.projects[options.name] = project;

    return angularJson;
  });
}

function addAppFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/app`), [
      template({
        tmpl: '',
        name: options.name,
        root: options.appProjectRoot,
        offset: offsetFromRoot(options.appProjectRoot)
      }),
      move(options.appProjectRoot)
    ])
  );
}

function addProxy(options: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.frontendProject);
    if (projectConfig.architect && projectConfig.architect.serve) {
      const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;
      host.create(
        pathToProxyFile,
        JSON.stringify(
          {
            '/api': {
              target: 'http://localhost:3333',
              secure: false
            }
          },
          null,
          2
        )
      );

      updateJsonInTree('angular.json', json => {
        projectConfig.architect.serve.options.proxyConfig = pathToProxyFile;
        json.projects[options.frontendProject] = projectConfig;
        return json;
      })(host, context);
    }
  };
}

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(schema);
    return chain([
      ngAdd({
        skipFormat: true
      }),
      addAppFiles(options),
      updateAngularJson(options),
      updateNxJson(options),
      options.unitTestRunner === 'jest'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.name,
            setupFile: 'none',
            skipSerializers: true
          })
        : noop(),
      options.frontendProject ? addProxy(options) : noop()
    ])(host, context);
  };
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');

  const appProjectRoot = join(normalize('apps'), appDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];

  return {
    ...options,
    name: toFileName(appProjectName),
    frontendProject: options.frontendProject
      ? toFileName(options.frontendProject)
      : undefined,
    appProjectRoot,
    parsedTags
  };
}
