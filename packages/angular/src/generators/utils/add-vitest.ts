import {
  addDependenciesToPackageJson,
  ensurePackage,
  joinPathFragments,
  readJson,
  type Tree,
  updateJson,
} from '@nx/devkit';
import { analogVitestAngular, nxVersion } from '../../utils/versions';

export type AddVitestOptions = {
  name: string;
  projectRoot: string;
  skipPackageJson: boolean;
  strict: boolean;
};

export async function addVitest(
  tree: Tree,
  options: AddVitestOptions
): Promise<void> {
  if (!options.skipPackageJson) {
    process.env.npm_config_legacy_peer_deps ??= 'true';

    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@analogjs/vitest-angular': analogVitestAngular,
        '@analogjs/vite-plugin-angular': analogVitestAngular,
      },
      undefined,
      true
    );
  }

  const { createOrEditViteConfig, viteConfigurationGenerator } = ensurePackage<
    typeof import('@nx/vite')
  >('@nx/vite', nxVersion);

  const relativeTestSetupPath = joinPathFragments('src', 'test-setup.ts');
  const isEsmImplicit = readJson(tree, 'package.json').type === 'module';

  createOrEditViteConfig(
    tree,
    {
      project: options.name,
      includeLib: false,
      includeVitest: true,
      inSourceTests: false,
      imports: [`import angular from '@analogjs/vite-plugin-angular'`],
      plugins: ['angular()'],
      setupFile: relativeTestSetupPath,
      useEsmExtension: !isEsmImplicit,
    },
    true
  );

  const setupFile = joinPathFragments(
    options.projectRoot,
    relativeTestSetupPath
  );
  if (!tree.exists(setupFile)) {
    tree.write(
      setupFile,
      `import '@analogjs/vitest-angular/setup-zone';

import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
`
    );
  }

  await viteConfigurationGenerator(tree, {
    project: options.name,
    newProject: true,
    uiFramework: 'angular',
    includeVitest: true,
    testEnvironment: 'jsdom',
  });

  updateJson(
    tree,
    joinPathFragments(options.projectRoot, 'tsconfig.spec.json'),
    (tsConfig) => {
      tsConfig.files = [...(tsConfig.files ?? []), relativeTestSetupPath];
      return tsConfig;
    }
  );

  updateJson(
    tree,
    joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
    (tsConfig) => {
      tsConfig.exclude = [...(tsConfig.exclude ?? []), relativeTestSetupPath];
      return tsConfig;
    }
  );
}
