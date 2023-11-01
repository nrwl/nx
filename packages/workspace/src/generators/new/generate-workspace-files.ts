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
import { join } from 'path';
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
  // we need to check package manager version before the package.json is generated
  // since it might influence the version report
  const packageManagerVersion = getPackageManagerVersion(
    options.packageManager as PackageManager,
    tree.root
  );
  options = normalizeOptions(options);
  createReadme(tree, options);
  createFiles(tree, options);
  createNxJson(tree, options);

  const [packageMajor] = packageManagerVersion.split('.');
  if (options.packageManager === 'pnpm' && +packageMajor >= 7) {
    createNpmrc(tree, options);
  } else if (options.packageManager === 'yarn') {
    if (+packageMajor >= 2) {
      createYarnrcYml(tree, options);
      // avoids errors when using nested yarn projects
      tree.write(join(options.directory, 'yarn.lock'), '');
    }
  }
  setPresetProperty(tree, options);
  addNpmScripts(tree, options);
  setUpWorkspacesInPackageJson(tree, options);

  await formatFiles(tree);
}

function setPresetProperty(tree: Tree, options: NormalizedSchema) {
  updateJson(tree, join(options.directory, 'nx.json'), (json) => {
    if (options.preset === Preset.NPM) {
      addPropertyWithStableKeys(json, 'extends', 'nx/presets/npm.json');
    }
    return json;
  });
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
    targetDefaults: {
      build: {
        cache: true,
        dependsOn: ['^build'],
      },
      lint: {
        cache: true,
      },
      e2e: {
        cache: true,
      },
    },
  };

  if (defaultBase === 'main') {
    delete nxJson.affected;
  }
  if (preset !== Preset.NPM) {
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
    options.preset === Preset.VueStandalone ||
    options.preset === Preset.NodeStandalone ||
    options.preset === Preset.NextJsStandalone ||
    options.preset === Preset.TsStandalone
      ? './files-root-app'
      : options.preset === Preset.NPM
      ? './files-package-based-repo'
      : './files-integrated-repo';
  generateFiles(tree, join(__dirname, filesDirName), options.directory, {
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
    options.preset === Preset.VueStandalone ||
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
  if (options.preset === Preset.NPM) {
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
