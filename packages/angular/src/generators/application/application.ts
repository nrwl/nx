import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  installPackagesTask,
  joinPathFragments,
  offsetFromRoot,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { convertToRspack } from '../convert-to-rspack/convert-to-rspack';
import { angularInitGenerator } from '../init/init';
import { setupSsr } from '../setup-ssr/setup-ssr';
import { setupTailwindGenerator } from '../setup-tailwind/setup-tailwind';
import { ensureAngularDependencies } from '../utils/ensure-angular-dependencies';
import {
  getInstalledAngularDevkitVersion,
  getInstalledAngularVersionInfo,
  versions,
} from '../utils/version-utils';
import {
  addE2e,
  addLinting,
  addProxyConfig,
  addServeStaticTarget,
  addUnitTestRunner,
  createFiles,
  createProject,
  enableStrictTypeChecking,
  normalizeOptions,
  setApplicationStrictDefault,
  setGeneratorDefaults,
  updateEditorTsConfig,
} from './lib';
import type { Schema } from './schema';

export async function applicationGenerator(
  tree: Tree,
  schema: Partial<Schema>
): Promise<GeneratorCallback> {
  assertNotUsingTsSolutionSetup(tree, 'angular', 'application');
  const isRspack = schema.bundler === 'rspack';
  if (isRspack) {
    schema.bundler = 'webpack';
  }

  const options = await normalizeOptions(tree, schema, isRspack);
  const rootOffset = offsetFromRoot(options.appProjectRoot);

  await jsInitGenerator(tree, {
    ...options,
    tsConfigName: options.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    js: false,
    skipFormat: true,
  });
  await angularInitGenerator(tree, {
    ...options,
    skipFormat: true,
    addPlugin: options.addPlugin,
  });

  if (!options.skipPackageJson) {
    ensureAngularDependencies(tree);
  }

  createProject(tree, options);

  await createFiles(tree, options, rootOffset);

  if (options.addTailwind) {
    await setupTailwindGenerator(tree, {
      project: options.name,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
    });
  }

  await addLinting(tree, options);
  await addUnitTestRunner(tree, options);
  const e2ePort = await addE2e(tree, options);
  addServeStaticTarget(
    tree,
    options,
    options.e2eTestRunner !== 'none' ? e2ePort : options.port
  );
  updateEditorTsConfig(tree, options);
  setGeneratorDefaults(tree, options);

  if (options.rootProject) {
    const nxJson = readNxJson(tree);
    nxJson.defaultProject = options.name;
    updateNxJson(tree, nxJson);
  }

  if (options.backendProject) {
    addProxyConfig(tree, options);
  }

  if (options.strict) {
    enableStrictTypeChecking(tree, options);
  } else {
    setApplicationStrictDefault(tree, false);
  }

  if (options.ssr) {
    await setupSsr(tree, {
      project: options.name,
      standalone: options.standalone,
      skipPackageJson: options.skipPackageJson,
      serverRouting: options.serverRouting,
    });
  }

  if (isRspack) {
    await convertToRspack(tree, {
      project: options.name,
      skipInstall: options.skipPackageJson,
      skipFormat: true,
    });

    if (options.ssr) {
      generateFiles(
        tree,
        joinPathFragments(__dirname, './files/rspack-ssr'),
        options.appProjectSourceRoot,
        {
          pathToDistFolder: joinPathFragments(
            offsetFromRoot(options.appProjectRoot),
            options.outputPath,
            'browser'
          ),
          tmpl: '',
        }
      );
    }
  }

  if (!options.skipPackageJson) {
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
    if (angularMajorVersion >= 20) {
      const angularDevkitVersion =
        getInstalledAngularDevkitVersion(tree) ??
        versions(tree).angularDevkitVersion;

      const devDependencies: Record<string, string> = {};
      if (options.bundler === 'esbuild') {
        devDependencies['@angular/build'] = angularDevkitVersion;
      } else if (isRspack) {
        devDependencies['@angular/build'] = angularDevkitVersion;
        devDependencies['@angular-devkit/build-angular'] = angularDevkitVersion;
      } else {
        devDependencies['@angular-devkit/build-angular'] = angularDevkitVersion;
      }

      addDependenciesToPackageJson(tree, {}, devDependencies, undefined, true);
    }
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
    logShowProjectCommand(options.name);
  };
}

export default applicationGenerator;
