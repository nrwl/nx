import { join, normalize } from '@angular-devkit/core';
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
  url,
} from '@angular-devkit/schematics';
import {
  addLintFiles,
  addProjectToNxJsonInTree,
  formatFiles,
  generateProjectLint,
  Linter,
  names,
  offsetFromRoot,
  projectRootDir,
  ProjectType,
  toFileName,
  updateJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';

import init from '../init/init';
import { GatsbyPluginSchematicSchema } from './schema';
import { appsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { updateJestConfigContent } from '@nrwl/react/src/utils/jest-utils';
import {
  toJS,
  updateTsConfigsToJs,
} from '@nrwl/workspace/src/utils/rules/to-js';
import {
  assertValidStyle,
  extraEslintDependencies,
  createReactEslintJson,
} from '@nrwl/react';
import { addStyleDependencies } from '../../utils/styles';
import { wrapAngularDevkitSchematic } from '@nrwl/tao/src/commands/ngcli-adapter';
import type { Linter as ESLintLinter } from 'eslint';

const projectType = ProjectType.Application;

interface NormalizedSchema extends GatsbyPluginSchematicSchema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  styledModule: null | string;
}

export default function (options: GatsbyPluginSchematicSchema): Rule {
  const normalizedOptions = normalizeOptions(options);
  return chain([
    init({
      ...options,
      skipFormat: true,
    }),
    addLintFiles(normalizedOptions.projectRoot, Linter.EsLint, {
      localConfig: createReactEslintJson(normalizedOptions.projectRoot),
      extraPackageDeps: extraEslintDependencies,
    }),
    addProject(normalizedOptions),
    addProjectToNxJsonInTree(normalizedOptions.projectName, {
      tags: normalizedOptions.parsedTags,
    }),
    createApplicationFiles(normalizedOptions),
    addStyleDependencies(options.style),
    addJest(normalizedOptions),
    updateJestConfig(normalizedOptions),
    updateEslintConfig(normalizedOptions),
    addCypress(normalizedOptions),
    addPrettierIgnoreEntry(normalizedOptions),
    addGitIgnoreEntry(normalizedOptions),
    formatFiles(),
  ]);
}

function normalizeOptions(
  options: GatsbyPluginSchematicSchema
): NormalizedSchema {
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const projectRoot = `${projectRootDir(projectType)}/${projectDirectory}`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const styledModule = /^(css|scss|less|styl)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

  return {
    ...options,
    name,
    styledModule,
    projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
  };
}

function createApplicationFiles(options: NormalizedSchema): Rule {
  return (tree) => {
    const isPnpm = tree.exists('pnpm-lock.yaml');
    return mergeWith(
      apply(url(`./files`), [
        template({
          ...options,
          isPnpm,
          ...names(options.name),
          offsetFromRoot: offsetFromRoot(options.projectRoot),
          tmpl: '',
        }),
        options.styledModule
          ? filter((file) => !file.endsWith(`.${options.style}`))
          : noop(),
        move(options.projectRoot),
        options.js ? toJS() : noop(),
        options.js
          ? updateTsConfigsToJs({ projectRoot: options.projectRoot })
          : noop(),
      ])
    );
  };
}

function addProject(options: NormalizedSchema): Rule {
  return updateWorkspaceInTree((json) => {
    const architect: { [key: string]: any } = {};

    architect.build = {
      builder: '@nrwl/gatsby:build',
      options: {
        outputPath: `${options.projectRoot}/public`,
        uglify: true,
        color: true,
        profile: false,
      },
      configurations: {
        production: {},
      },
    };

    architect.serve = {
      builder: '@nrwl/gatsby:server',
      options: {
        buildTarget: `${options.projectName}:build`,
      },
      configurations: {
        production: {
          buildTarget: `${options.projectName}:build:production`,
        },
      },
    };

    architect.lint = generateProjectLint(
      normalize(options.projectRoot),
      join(normalize(options.projectRoot), 'tsconfig.json'),
      Linter.EsLint,
      [`${options.projectRoot}/**/*.{ts,tsx,js,jsx}`]
    );

    json.projects[options.projectName] = {
      root: options.projectRoot,
      sourceRoot: `${options.projectRoot}/src`,
      projectType,
      schematics: {},
      architect,
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
        project: options.projectName,
      })
    : noop();
}

function addJest(options: NormalizedSchema): Rule {
  return options.unitTestRunner === 'jest'
    ? externalSchematic('@nrwl/jest', 'jest-project', {
        project: options.projectName,
        supportTsx: true,
        skipSerializers: true,
        setupFile: 'none',
        babelJest: true,
      })
    : noop();
}

function addPrettierIgnoreEntry(options: NormalizedSchema) {
  return (tree: Tree, context: SchematicContext) => {
    let prettierIgnoreFile = tree.read('.prettierignore')?.toString('utf-8');
    if (prettierIgnoreFile) {
      prettierIgnoreFile =
        prettierIgnoreFile +
        `\n/apps/${options.projectName}/node_modules\n/apps/${options.projectName}/public\n/apps/${options.projectName}/.cache\n`;
      tree.overwrite('.prettierignore', prettierIgnoreFile);
    } else {
      context.logger.warn(`Couldn't find .prettierignore file to update`);
    }
  };
}

function addGitIgnoreEntry(options: NormalizedSchema) {
  return (tree: Tree, context: SchematicContext) => {
    let gitIgnoreFile = tree.read('.gitignore')?.toString('utf-8');
    if (gitIgnoreFile) {
      gitIgnoreFile =
        gitIgnoreFile +
        `\n/apps/${options.projectName}/node_modules\n/apps/${options.projectName}/public\n/apps/${options.projectName}/.cache\n`;
      tree.overwrite('.gitignore', gitIgnoreFile);
    } else {
      context.logger.warn(`Couldn't find .gitignore file to update`);
    }
  };
}

function updateJestConfig(options: NormalizedSchema) {
  return options.unitTestRunner === 'none'
    ? noop()
    : (host) => {
        const appDirectory = options.directory
          ? `${toFileName(options.directory)}/${toFileName(options.name)}`
          : toFileName(options.name);
        const appProjectRoot = `${appsDir(host)}/${appDirectory}`;
        const configPath = `${appProjectRoot}/jest.config.js`;
        const originalContent = host.read(configPath).toString();
        const content = updateJestConfigContent(originalContent);
        host.overwrite(configPath, content);
      };
}

function updateEslintConfig(options: NormalizedSchema) {
  const appDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);
  return (host) => {
    const appProjectRoot = `${appsDir(host)}/${appDirectory}`;
    const configPath = `${appProjectRoot}/.eslintrc.json`;
    return updateJsonInTree(configPath, (json: ESLintLinter.Config) => {
      json.ignorePatterns = ['!**/*', 'public', '.cache'];

      // Should be impossible at runtime based on our generators
      if (!json.overrides) {
        return json;
      }

      for (const override of json.overrides) {
        if (!override.files || override.files.length !== 2) {
          continue;
        }
        if (
          !(override.files.includes('*.ts') && override.files.includes('*.tsx'))
        ) {
          continue;
        }
        override.rules = override.rules || {};
        override.rules['@typescript-eslint/camelcase'] = 'off';
      }

      return json;
    });
  };
}

export const applicationGenerator = wrapAngularDevkitSchematic(
  '@nrwl/gatsby',
  'application'
);
