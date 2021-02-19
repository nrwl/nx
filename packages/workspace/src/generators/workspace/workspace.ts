import {
  generateFiles,
  Tree,
  updateJson,
  convertNxGenerator,
  names,
  writeJson,
  formatFiles,
} from '@nrwl/devkit';
import { Schema } from './schema';
import {
  angularCliVersion,
  nxVersion,
  prettierVersion,
  typescriptVersion,
} from '../../utils/versions';
import { readFileSync } from 'fs';
import { join, join as pathJoin } from 'path';
import { reformattedWorkspaceJsonOrNull } from '@nrwl/tao/src/shared/workspace';

export const DEFAULT_NRWL_PRETTIER_CONFIG = {
  singleQuote: true,
};

function decorateAngularClI(host: Tree, options: Schema) {
  const decorateCli = readFileSync(
    pathJoin(__dirname as any, '..', 'utils', 'decorate-angular-cli.js__tmpl__')
  ).toString();
  host.write(join(options.directory, 'decorate-angular-cli.js'), decorateCli);
}

function setWorkspaceLayoutProperties(tree: Tree, options: Schema) {
  updateJson(tree, join(options.directory, 'nx.json'), (json) => {
    if (options.layout === 'packages') {
      json.workspaceLayout = {
        appsDir: 'packages',
        libsDir: 'packages',
      };
    }
    return json;
  });
}

function createAppsAndLibsFolders(host: Tree, options: Schema) {
  if (options.layout === 'packages') {
    host.write(join(options.directory, 'packages/.gitkeep'), '');
  } else {
    host.write(join(options.directory, 'apps/.gitkeep'), '');
    host.write(join(options.directory, 'libs/.gitkeep'), '');
  }
}

function createFiles(host: Tree, options: Schema) {
  const npmScope = options.npmScope ? options.npmScope : options.name;
  const formattedNames = names(options.name);
  generateFiles(host, pathJoin(__dirname, './files'), options.directory, {
    formattedNames,
    dot: '.',
    tmpl: '',
    workspaceFile: options.cli === 'angular' ? 'angular' : 'workspace',
    cliCommand: options.cli === 'angular' ? 'ng' : 'nx',
    nxCli: false,
    typescriptVersion,
    prettierVersion,
    // angular cli is used only when workspace schematics is added to angular cli
    angularCliVersion,
    ...(options as object),
    nxVersion,
    npmScope,
  });
}

function createPrettierrc(host: Tree, options: Schema) {
  writeJson(
    host,
    join(options.directory, '.prettierrc'),
    DEFAULT_NRWL_PRETTIER_CONFIG
  );
}

function formatWorkspaceJson(host: Tree, options: Schema) {
  const path = join(
    options.directory,
    options.cli === 'angular' ? 'angular.json' : 'workspace.json'
  );

  try {
    updateJson(host, path, (workspaceJson) => {
      const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
      if (reformatted) {
        host.write(path, JSON.stringify(reformatted, null, 2));
      }
    });
  } catch (e) {
    console.error(`Failed to format: ${path}`);
    console.error(e);
  }
}

export async function workspaceGenerator(host: Tree, options: Schema) {
  if (!options.name) {
    throw new Error(`Invalid options, "name" is required.`);
  }
  createFiles(host, options);
  createPrettierrc(host, options);
  if (options.cli === 'angular') {
    decorateAngularClI(host, options);
  }
  setWorkspaceLayoutProperties(host, options);
  createAppsAndLibsFolders(host, options);

  await formatFiles(host);
  formatWorkspaceJson(host, options);
}

export const workspaceSchematic = convertNxGenerator(workspaceGenerator);
