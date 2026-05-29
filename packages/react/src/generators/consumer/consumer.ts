import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  names,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { typescriptVersion } from '@nx/js/src/utils/versions';
import {
  reactVersion,
  reactDomVersion,
  typesReactVersion,
  typesReactDomVersion,
} from '../../utils/versions';
import * as mfVersions from '../_utils/mf-versions';
import { getConsumerDeps } from '../_utils/mf-dependencies';
import {
  getDefaultPort,
  normalizeScaffoldOptions,
  toFederationName,
} from '../_utils/normalize';
import providerGenerator from '../provider/provider';
import type { ConsumerGeneratorSchema } from './schema';

// `--mode=...` is rspack's portable equivalent of `NODE_ENV=...` and works on
// Windows without a shell prefix.
const BUNDLER_DEV_COMMAND = {
  vite: 'vite',
  rsbuild: 'rsbuild dev',
  rspack: 'rspack serve --mode=development',
} as const;

const BUNDLER_BUILD_COMMAND = {
  vite: 'vite build',
  rsbuild: 'rsbuild build',
  rspack: 'rspack build --mode=production',
} as const;

export async function consumerGenerator(
  tree: Tree,
  schema: ConsumerGeneratorSchema
): Promise<GeneratorCallback> {
  const opts = await normalizeScaffoldOptions(tree, {
    directory: schema.directory,
    surface: 'consumer',
    bundler: schema.bundler,
    port: schema.port,
  });

  // When the user explicitly passes `--providerNames=p1,p2`, generate a
  // sibling provider app per entry and wire them into the consumer's
  // PROVIDERS list + App.tsx. When the flag is omitted, ship a placeholder
  // `my-provider` entry pointing at the per-bundler provider-default port
  // without generating an actual provider project.
  const providerNames = schema.providerNames?.length
    ? schema.providerNames
    : ['my-provider'];
  const shouldGenerateProviders = !!schema.providerNames?.length;
  const providerDefaultPort = getDefaultPort(opts.bundler, 'provider');
  const providers = providerNames.map((name, i) => ({
    name,
    // The federation container name the provider build emits. Must match the
    // provider's federation `name`, which is derived the same way (see
    // provider.ts / normalize.ts) - it strips chars that aren't valid in a JS
    // identifier, so a naive `alias.replace(/-/g, '_')` in the consumer would
    // diverge for names with dots/slashes/@ and loadRemote() would resolve the
    // URL but look up the wrong container.
    federationName: toFederationName(names(name).fileName),
    componentName: `Provider${names(name).className}`,
    directory: joinPathFragments(opts.projectRoot, '..', name),
    port: providerDefaultPort + i,
  }));

  addProjectConfiguration(tree, opts.projectName, {
    root: opts.projectRoot,
    sourceRoot: joinPathFragments(opts.projectRoot, 'src'),
    projectType: 'application',
    targets: {
      serve: {
        executor: 'nx:run-commands',
        continuous: true,
        options: {
          command: BUNDLER_DEV_COMMAND[opts.bundler],
          cwd: opts.projectRoot,
        },
      },
      build: {
        executor: 'nx:run-commands',
        options: {
          command: BUNDLER_BUILD_COMMAND[opts.bundler],
          cwd: opts.projectRoot,
        },
      },
    },
  });

  const tasks: GeneratorCallback[] = [];
  if (shouldGenerateProviders) {
    for (const p of providers) {
      tasks.push(
        await providerGenerator(tree, {
          directory: p.directory,
          bundler: opts.bundler,
          port: p.port,
          // Wire `nx serve <provider>` to also spin up this consumer.
          consumer: opts.projectName,
        })
      );
    }
  }

  // Point at `remoteEntry.js`, which every supported bundler emits at dev
  // time. `mf-manifest.json` is richer (https://module-federation.io/configure/manifest-fields)
  // but `@module-federation/vite` only emits it at build time, so a consumer
  // serving against a dev-mode vite provider would get the SPA-fallback HTML
  // and crash on JSON.parse. Swap to mf-manifest.json manually for prod if
  // you want the extra metadata.
  const remotes = providers.map((p) => ({
    // `alias` is the key the consumer references (loadRemote/lazyProvider);
    // `name` is the provider's federation container name; `entry` is its
    // remoteEntry.js URL.
    alias: p.name,
    name: p.federationName,
    entry: `http://localhost:${p.port}/remoteEntry.js`,
  }));

  // Vite emits ESM `remoteEntry.js`; rspack/rsbuild emit UMD. The federation
  // runtime needs `type: 'module'` for ESM (else loads as a classic <script>
  // and the browser throws #RUNTIME-001) and NO type for UMD (else
  // #RUNTIME-002). We only generate same-bundler providers via --providerNames,
  // so a single per-consumer setting is correct.
  const remoteType: 'module' | null = opts.bundler === 'vite' ? 'module' : null;

  const templateSubstitutions = {
    projectName: opts.projectName,
    federationName: opts.federationName,
    port: opts.port,
    bundler: opts.bundler,
    providers,
    remotes,
    remoteType,
    versions: {
      ...mfVersions,
      reactVersion,
      reactDomVersion,
      typesReactVersion,
      typesReactDomVersion,
      typescriptVersion,
    },
    tmpl: '',
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files', '_common'),
    opts.projectRoot,
    templateSubstitutions
  );
  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files', opts.bundler),
    opts.projectRoot,
    templateSubstitutions
  );

  // Write deps into the workspace root package.json so bare bundler bins
  // resolve when nx invokes the generated run-commands serve target.
  const deps = getConsumerDeps(opts.bundler);
  tasks.push(
    addDependenciesToPackageJson(tree, deps.dependencies, deps.devDependencies)
  );

  await formatFiles(tree);
  return runTasksInSerial(...tasks);
}

export default consumerGenerator;
