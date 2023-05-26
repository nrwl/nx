import {
  formatFiles,
  generateFiles,
  getPackageManagerVersion,
  names,
  NxJsonConfiguration,
  PackageManager,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { join, join as pathJoin } from 'path';
import { Preset } from '../utils/presets';
import { deduceDefaultBase } from '../../utilities/default-base';
import { NormalizedSchema } from './new';

export async function generateWorkspaceFiles(
  tree: Tree,
  options: NormalizedSchema
) {
  if (!options.name) {
    throw new Error(`Invalid options, "name" is required.`);
  }
  options = normalizeOptions(options);
  createReadme(tree, options);
  createFiles(tree, options);
  createNxJson(tree, options);

  const [packageMajor] = getPackageManagerVersion(
    options.packageManager as PackageManager
  ).split('.');
  if (options.packageManager === 'pnpm' && +packageMajor >= 7) {
    createNpmrc(tree, options);
  } else if (options.packageManager === 'yarn' && +packageMajor >= 2) {
    createYarnrcYml(tree, options);
  }
  setPresetProperty(tree, options);
  addNpmScripts(tree, options);
  createAppsAndLibsFolders(tree, options);
  setUpWorkspacesInPackageJson(tree, options);

  await formatFiles(tree);
}

function setPresetProperty(tree: Tree, options: NormalizedSchema) {
  updateJson(tree, join(options.directory, 'nx.json'), (json) => {
    if (options.preset === Preset.Core || options.preset === Preset.NPM) {
      addPropertyWithStableKeys(json, 'extends', 'nx/presets/npm.json');
      delete json.implicitDependencies;
      delete json.targetDefaults;
      delete json.workspaceLayout;
    }
    return json;
  });
}

function createAppsAndLibsFolders(tree: Tree, options: NormalizedSchema) {
  if (
    options.preset === Preset.Core ||
    options.preset === Preset.TS ||
    options.preset === Preset.NPM
  ) {
    tree.write(join(options.directory, 'packages/.gitkeep'), '');
  } else if (
    options.preset === Preset.AngularStandalone ||
    options.preset === Preset.ReactStandalone ||
    options.preset === Preset.NodeStandalone ||
    options.preset === Preset.NextJsStandalone ||
    options.preset === Preset.TsStandalone ||
    options.isCustomPreset
  ) {
    // don't generate any folders
  } else {
    tree.write(join(options.directory, 'apps/.gitkeep'), '');
    tree.write(join(options.directory, 'libs/.gitkeep'), '');
  }
}

function createNxJson(
  tree: Tree,
  { directory, defaultBase, preset }: NormalizedSchema
) {
  const nxJson: NxJsonConfiguration & { $schema: string } = {
    $schema: './node_modules/nx/schemas/nx-schema.json',
    affected: {
      defaultBase,
    },
    tasksRunnerOptions: {
      default: {
        runner: 'nx/tasks-runners/default',
        options: {
          cacheableOperations: ['build', 'lint', 'test', 'e2e'],
        },
      },
    },
  };

  nxJson.targetDefaults = {
    build: {
      dependsOn: ['^build'],
    },
  };

  if (defaultBase === 'main') {
    delete nxJson.affected;
  }
  if (
    preset !== Preset.Core &&
    preset !== Preset.NPM &&
    preset !== Preset.Empty
  ) {
    nxJson.namedInputs = {
      default: ['{projectRoot}/**/*', 'sharedGlobals'],
      production: ['default'],
      sharedGlobals: [],
    };
    nxJson.targetDefaults.build.inputs = ['production', '^production'];
  }

  writeJson<NxJsonConfiguration>(tree, join(directory, 'nx.json'), nxJson);
}

function createFiles(tree: Tree, options: NormalizedSchema) {
  const formattedNames = names(options.name);
  const filesDirName =
    options.preset === Preset.AngularStandalone ||
    options.preset === Preset.ReactStandalone ||
    options.preset === Preset.NodeStandalone ||
    options.preset === Preset.NextJsStandalone ||
    options.preset === Preset.TsStandalone
      ? './files-root-app'
      : options.preset === Preset.NPM || options.preset === Preset.Core
      ? './files-package-based-repo'
      : './files-integrated-repo';
  generateFiles(tree, pathJoin(__dirname, filesDirName), options.directory, {
    formattedNames,
    dot: '.',
    tmpl: '',
    cliCommand: 'nx',
    nxCli: false,
    ...(options as object),
    nxVersion,
    packageManager: options.packageManager,
  });
}

function createReadme(
  tree: Tree,
  { name, appName, directory, preset }: NormalizedSchema
) {
  const formattedNames = names(name);
  generateFiles(tree, join(__dirname, './files-readme'), directory, {
    formattedNames,
    includeServe: preset !== Preset.TsStandalone,
    appName,
    name,
  });
}

// ensure that pnpm install add all the missing peer deps

function createNpmrc(tree: Tree, options: NormalizedSchema) {
  tree.write(
    join(options.directory, '.npmrc'),
    'strict-peer-dependencies=false\nauto-install-peers=true\n'
  );
}

// ensure that yarn (berry) install uses classic node linker

function createYarnrcYml(tree: Tree, options: NormalizedSchema) {
  tree.write(
    join(options.directory, '.yarnrc.yml'),
    'nodeLinker: node-modules\n'
  );
}

function addNpmScripts(tree: Tree, options: NormalizedSchema) {
  if (
    options.preset === Preset.AngularStandalone ||
    options.preset === Preset.ReactStandalone ||
    options.preset === Preset.NodeStandalone ||
    options.preset === Preset.NextJsStandalone
  ) {
    updateJson(tree, join(options.directory, 'package.json'), (json) => {
      Object.assign(json.scripts, {
        start: 'nx serve',
        build: 'nx build',
        test: 'nx test',
      });
      return json;
    });
  }
  if (options.preset === Preset.TsStandalone) {
    updateJson(tree, join(options.directory, 'package.json'), (json) => {
      Object.assign(json.scripts, {
        build: 'nx build',
        test: 'nx test',
      });
      return json;
    });
  }
}

function addPropertyWithStableKeys(obj: any, key: string, value: string) {
  const copy = { ...obj };
  Object.keys(obj).forEach((k) => {
    delete obj[k];
  });
  obj[key] = value;
  Object.keys(copy).forEach((k) => {
    obj[k] = copy[k];
  });
}

function normalizeOptions(options: NormalizedSchema) {
  let defaultBase = options.defaultBase || deduceDefaultBase();
  const name = names(options.name).fileName;
  return {
    name,
    ...options,
    defaultBase,
  };
}

function setUpWorkspacesInPackageJson(tree: Tree, options: NormalizedSchema) {
  if (options.preset === Preset.NPM || options.preset === Preset.Core) {
    if (options.packageManager === 'pnpm') {
      tree.write(
        join(options.directory, 'pnpm-workspace.yaml'),
        `packages:
  - 'packages/*'
`
      );
    } else {
      updateJson(tree, join(options.directory, 'package.json'), (json) => {
        json.workspaces = ['packages/*'];
        return json;
      });
    }
  }
}
