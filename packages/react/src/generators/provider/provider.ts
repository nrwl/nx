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
import { getProviderDeps } from '../_utils/mf-dependencies';
import { normalizeScaffoldOptions } from '../_utils/normalize';
import type { ProviderGeneratorSchema } from './schema';

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

export async function providerGenerator(
  tree: Tree,
  schema: ProviderGeneratorSchema
): Promise<GeneratorCallback> {
  const opts = await normalizeScaffoldOptions(tree, {
    directory: schema.directory,
    surface: 'provider',
    bundler: schema.bundler,
    port: schema.port,
  });
  // `exposeName` is the public MF expose key (consumers reference
  // `<provider>/<exposeName>`) and may be kebab-case, e.g. `cart-widget`.
  // `componentName` is the PascalCase identifier used for the React function
  // and its filename, since `export function cart-widget()` would be invalid.
  const exposeName = schema.exposeName?.trim() || 'App';
  const componentName = names(exposeName).className;

  // `dependsOn` on a `continuous: true` target lets nx spin up the consumer
  // alongside the provider - matches the deprecated host/remote 'serve a
  // remote, host comes along' UX. Only wired when --consumer is set (e.g.
  // when the consumer generator scaffolds this provider).
  const serveTarget: Record<string, unknown> = {
    executor: 'nx:run-commands',
    continuous: true,
    options: {
      command: BUNDLER_DEV_COMMAND[opts.bundler],
      cwd: opts.projectRoot,
    },
  };
  if (schema.consumer) {
    serveTarget.dependsOn = [`${schema.consumer}:serve`];
  }

  addProjectConfiguration(tree, opts.projectName, {
    root: opts.projectRoot,
    sourceRoot: joinPathFragments(opts.projectRoot, 'src'),
    projectType: 'application',
    targets: {
      serve: serveTarget,
      build: {
        executor: 'nx:run-commands',
        options: {
          command: BUNDLER_BUILD_COMMAND[opts.bundler],
          cwd: opts.projectRoot,
        },
      },
    },
  });

  const templateSubstitutions = {
    projectName: opts.projectName,
    federationName: opts.federationName,
    port: opts.port,
    exposeName,
    componentName,
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
  // resolve when nx invokes the generated run-commands serve target. The
  // per-project package.json template still ships for pnpm-workspace setups.
  const deps = getProviderDeps(opts.bundler);
  const installTask = addDependenciesToPackageJson(
    tree,
    deps.dependencies,
    deps.devDependencies
  );

  await formatFiles(tree);
  return runTasksInSerial(installTask);
}

export default providerGenerator;
