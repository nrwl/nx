import {
  chain,
  Rule,
  Tree,
  SchematicContext,
  schematic,
  noop,
  move,
  mergeWith,
  apply,
  url,
  template
} from '@angular-devkit/schematics';
import { join, normalize, Path } from '@angular-devkit/core';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { Schema } from './schema';
import { offsetFromRoot } from '../../utils/common';
import { updateJsonInTree } from '../../utils/ast-utils';
import { toFileName } from '../../utils/name-utils';
import {
  expressVersion,
  expressTypingsVersion,
  nestjsVersion
} from '../../lib-versions';

interface NormalizedSchema extends Schema {
  appProjectRoot: Path;
  e2eProjectName: string;
  e2eProjectRoot: Path;
  parsedTags: string[];
}

function addDependencies(options: NormalizedSchema): Rule {
  return chain([
    updateJsonInTree('package.json', json => {
      json.dependencies = json.dependencies || {};
      json.devDependencies = json.devDependencies || {};

      if (options.framework === 'express') {
        json.dependencies = {
          ...json.dependencies,
          express: expressVersion
        };

        json.devDependencies = {
          ...json.devDependencies,
          '@types/express': expressTypingsVersion
        };
      } else if (options.framework === 'nestjs') {
        json.dependencies = {
          ...json.dependencies,
          '@nestjs/common': nestjsVersion,
          '@nestjs/core': nestjsVersion
        };

        json.devDependencies = {
          ...json.devDependencies,
          '@nestjs/testing': nestjsVersion
        };
      }
      return json;
    }),
    addInstall
  ]);
}

function createSourceCode(options: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    return chain([
      mergeWith(
        apply(url(`./files/${options.framework}`), [
          template({
            tmpl: '',
            name: options.name
          }),
          move(join(options.appProjectRoot, 'src'))
        ])
      ),
      options.framework !== 'none' ? addDependencies(options) : noop()
    ])(host, context);
  };
}

function addInstall(host: Tree, context: SchematicContext) {
  context.addTask(new NodePackageInstallTask());
  return host;
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
    builder: '@nrwl/builders:node-build',
    options: {
      outputPath: join(normalize('dist'), options.appProjectRoot),
      main: join(project.sourceRoot, 'main.ts'),
      tsConfig: join(options.appProjectRoot, 'tsconfig.app.json')
    },
    configurations: {
      production: {
        optimization: true,
        extractLicenses: true,
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
    builder: '@nrwl/builders:node-execute',
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

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(schema);
    return chain([
      addAppFiles(options),
      updateAngularJson(options),
      updateNxJson(options),
      options.framework !== 'none' ? createSourceCode(options) : noop(),
      options.unitTestRunner === 'jest'
        ? schematic('jest-project', {
            project: options.name,
            skipSetupFile: true
          })
        : noop()
    ])(host, context);
  };
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');
  const e2eProjectName = `${appProjectName}-e2e`;

  const appProjectRoot = join(normalize('apps'), appDirectory);
  const e2eProjectRoot = join(normalize('apps'), appDirectory + '-e2e');

  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];

  return {
    ...options,
    name: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    parsedTags
  };
}
