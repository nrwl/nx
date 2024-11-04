import {
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
import { connectToNxCloud } from 'nx/src/nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud';
import { createNxCloudOnboardingURL } from 'nx/src/nx-cloud/utilities/url-shorten';

type PresetInfo = {
  generateAppCmd?: string;
  generateLibCmd?: string;
  generateNxReleaseInfo?: boolean;
  learnMoreLink?: string;
};

// map from the preset to the name of the plugin s.t. the README can have a more
// meaningful generator command.
const presetToPluginMap: { [key in Preset]: PresetInfo } = {
  [Preset.Apps]: {
    learnMoreLink:
      'https://nx.dev/getting-started/intro#learn-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.NPM]: {
    generateNxReleaseInfo: true,
    learnMoreLink:
      'https://nx.dev/getting-started/tutorials/npm-workspaces-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.TS]: {
    generateLibCmd: '@nx/js',
    generateNxReleaseInfo: true,
    learnMoreLink:
      'https://nx.dev/nx-api/js?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.WebComponents]: {
    generateAppCmd: null,
    learnMoreLink:
      'https://nx.dev/getting-started/intro#learn-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.AngularMonorepo]: {
    generateAppCmd: '@nx/angular',
    generateLibCmd: '@nx/angular',
    learnMoreLink:
      'https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.AngularStandalone]: {
    generateAppCmd: '@nx/angular',
    generateLibCmd: '@nx/angular',
    learnMoreLink:
      'https://nx.dev/getting-started/tutorials/angular-standalone-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.ReactMonorepo]: {
    generateAppCmd: '@nx/react',
    generateLibCmd: '@nx/react',
    learnMoreLink:
      'https://nx.dev/getting-started/tutorials/react-monorepo-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.ReactStandalone]: {
    generateAppCmd: '@nx/react',
    generateLibCmd: '@nx/react',
    learnMoreLink:
      'https://nx.dev/getting-started/tutorials/react-standalone-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.NextJsStandalone]: {
    generateAppCmd: '@nx/next',
    generateLibCmd: '@nx/react',
    learnMoreLink:
      'https://nx.dev/nx-api/next?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.RemixMonorepo]: {
    generateAppCmd: '@nx/remix',
    generateLibCmd: '@nx/react',
    learnMoreLink:
      'https://nx.dev/nx-api/remix?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.RemixStandalone]: {
    generateAppCmd: '@nx/remix',
    generateLibCmd: '@nx/react',
    learnMoreLink:
      'https://nx.dev/nx-api/remix?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.ReactNative]: {
    generateAppCmd: '@nx/react-native',
    generateLibCmd: '@nx/react',
    learnMoreLink:
      'https://nx.dev/nx-api/react-native?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.VueMonorepo]: {
    generateAppCmd: '@nx/vue',
    generateLibCmd: '@nx/vue',
    learnMoreLink:
      'https://nx.dev/getting-started/tutorials/vue-standalone-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.VueStandalone]: {
    generateAppCmd: '@nx/vue',
    generateLibCmd: '@nx/vue',
    learnMoreLink:
      'https://nx.dev/getting-started/tutorials/vue-standalone-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.Nuxt]: {
    generateAppCmd: '@nx/nuxt',
    generateLibCmd: '@nx/vue',
    learnMoreLink:
      'https://nx.dev/nx-api/nuxt?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.NuxtStandalone]: {
    generateAppCmd: '@nx/nuxt',
    generateLibCmd: '@nx/vue',
    learnMoreLink:
      'https://nx.dev/nx-api/nuxt?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.Expo]: {
    generateAppCmd: '@nx/expo',
    generateLibCmd: '@nx/react',
    learnMoreLink:
      'https://nx.dev/nx-api/expo?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.NextJs]: {
    generateAppCmd: '@nx/next',
    generateLibCmd: '@nx/react',
    learnMoreLink:
      'https://nx.dev/nx-api/next?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.Nest]: {
    generateAppCmd: '@nx/nest',
    generateLibCmd: '@nx/node',
    learnMoreLink:
      'https://nx.dev/nx-api/nest?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.Express]: {
    generateAppCmd: '@nx/express',
    generateLibCmd: '@nx/node',
    learnMoreLink:
      'https://nx.dev/nx-api/express?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.NodeStandalone]: {
    generateAppCmd: '@nx/node',
    generateLibCmd: '@nx/node',
    learnMoreLink:
      'https://nx.dev/nx-api/node?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.NodeMonorepo]: {
    generateAppCmd: '@nx/node',
    generateLibCmd: '@nx/node',
    learnMoreLink:
      'https://nx.dev/nx-api/node?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
  [Preset.TsStandalone]: {
    generateAppCmd: null,
    generateLibCmd: null,
    generateNxReleaseInfo: true,
    learnMoreLink:
      'https://nx.dev/nx-api/js?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects',
  },
};

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
  createFiles(tree, options);
  const nxJson = createNxJson(tree, options);

  const token =
    options.nxCloud !== 'skip'
      ? await connectToNxCloud(
          tree,
          {
            installationSource: 'create-nx-workspace',
            directory: options.directory,
            github: options.useGitHub,
          },
          nxJson
        )
      : null;

  await createReadme(tree, options, token);

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

  return token;
}

function setPresetProperty(tree: Tree, options: NormalizedSchema) {
  if (options.preset === Preset.NPM) {
    updateJson(tree, join(options.directory, 'nx.json'), (json) => {
      addPropertyWithStableKeys(json, 'extends', 'nx/presets/npm.json');
      return json;
    });
  }
}

function createNxJson(
  tree: Tree,
  { directory, defaultBase, preset }: NormalizedSchema
) {
  const nxJson: NxJsonConfiguration & { $schema: string } = {
    $schema: './node_modules/nx/schemas/nx-schema.json',
    defaultBase,
    targetDefaults:
      process.env.NX_ADD_PLUGINS === 'false'
        ? {
            build: {
              cache: true,
              dependsOn: ['^build'],
            },
            lint: {
              cache: true,
            },
          }
        : undefined,
  };

  if (defaultBase === 'main') {
    delete nxJson.defaultBase;
  }
  if (preset !== Preset.NPM) {
    nxJson.namedInputs = {
      default: ['{projectRoot}/**/*', 'sharedGlobals'],
      production: ['default'],
      sharedGlobals: [],
    };
    if (process.env.NX_ADD_PLUGINS === 'false') {
      nxJson.targetDefaults.build.inputs = ['production', '^production'];
      nxJson.useInferencePlugins = false;
    }
  }

  writeJson<NxJsonConfiguration>(tree, join(directory, 'nx.json'), nxJson);

  return nxJson;
}

function createFiles(tree: Tree, options: NormalizedSchema) {
  const formattedNames = names(options.name);
  const filesDirName =
    options.preset === Preset.AngularStandalone ||
    options.preset === Preset.ReactStandalone ||
    options.preset === Preset.VueStandalone ||
    options.preset === Preset.NuxtStandalone ||
    options.preset === Preset.NodeStandalone ||
    options.preset === Preset.NextJsStandalone ||
    options.preset === Preset.RemixStandalone ||
    options.preset === Preset.TsStandalone
      ? './files-root-app'
      : (options.preset === Preset.TS &&
          process.env.NX_ADD_PLUGINS !== 'false' &&
          process.env.NX_ADD_TS_PLUGIN !== 'false') ||
        options.preset === Preset.NPM
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

async function createReadme(
  tree: Tree,
  { name, appName, directory, preset, nxCloud }: NormalizedSchema,
  nxCloudToken?: string
) {
  const formattedNames = names(name);

  // default to an empty one for custom presets
  const presetInfo: PresetInfo = presetToPluginMap[preset] ?? {
    package: '',
    generateLibCmd: null,
  };

  const nxCloudOnboardingUrl = nxCloudToken
    ? await createNxCloudOnboardingURL('readme', nxCloudToken)
    : null;

  generateFiles(tree, join(__dirname, './files-readme'), directory, {
    formattedNames,
    isJsStandalone: preset === Preset.TsStandalone,
    isTsPreset: preset === Preset.TS,
    isUsingNewTsSolutionSetup:
      process.env.NX_ADD_PLUGINS !== 'false' &&
      process.env.NX_ADD_TS_PLUGIN !== 'false',
    isEmptyRepo: !appName,
    appName,
    generateAppCmd: presetInfo.generateAppCmd,
    generateLibCmd: presetInfo.generateLibCmd,
    generateNxReleaseInfo: presetInfo.generateNxReleaseInfo,
    learnMoreLink: presetInfo.learnMoreLink,
    serveCommand:
      preset === Preset.NextJs || preset === Preset.NextJsStandalone
        ? 'dev'
        : 'serve',
    name,
    nxCloud,
    nxCloudOnboardingUrl,
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
    options.preset === Preset.NuxtStandalone ||
    options.preset === Preset.NodeStandalone
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
  if (options.preset === Preset.NextJsStandalone) {
    updateJson(tree, join(options.directory, 'package.json'), (json) => {
      Object.assign(json.scripts, {
        dev: 'nx dev',
        build: 'nx build',
        start: 'nx start',
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
    nxCloud: options.nxCloud ?? 'skip',
  };
}

function setUpWorkspacesInPackageJson(tree: Tree, options: NormalizedSchema) {
  if (
    options.preset === Preset.NPM ||
    (options.preset === Preset.TS &&
      process.env.NX_ADD_PLUGINS !== 'false' &&
      process.env.NX_ADD_TS_PLUGIN !== 'false')
  ) {
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
