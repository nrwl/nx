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
import { join as pathJoin } from 'path';

export const DEFAULT_NRWL_PRETTIER_CONFIG = {
  singleQuote: true,
};

const decorateAngularClI = (host: Tree) => {
  const decorateCli = readFileSync(
    pathJoin(__dirname as any, '..', 'utils', 'decorate-angular-cli.js__tmpl__')
  ).toString();
  host.write('decorate-angular-cli.js', decorateCli);
};

function setWorkspaceLayoutProperties(tree: Tree, options: Schema) {
  updateJson(tree, 'nx.json', (json) => {
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
    host.write('packages/.gitkeep', '');
  } else {
    host.write('apps/.gitkeep', '');
    host.write('libs/.gitkeep', '');
  }
}

function createFiles(host: Tree, options: Schema) {
  const npmScope = options.npmScope ? options.npmScope : options.name;
  const formattedNames = names(options.name);
  generateFiles(host, pathJoin(__dirname, './files'), '', {
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

function createPrettierrc(host: Tree) {
  writeJson(host, '.prettierrc', DEFAULT_NRWL_PRETTIER_CONFIG);
}

export async function workspaceGenerator(host: Tree, options: Schema) {
  if (!options.name) {
    throw new Error(`Invalid options, "name" is required.`);
  }
  createFiles(host, options);
  createPrettierrc(host);
  if (options.cli === 'angular') {
    decorateAngularClI(host);
  }
  setWorkspaceLayoutProperties(host, options);
  createAppsAndLibsFolders(host, options);

  await formatFiles(host);
}

export const workspaceSchematic = convertNxGenerator(workspaceGenerator);
