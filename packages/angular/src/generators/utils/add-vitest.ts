import {
  addDependenciesToPackageJson,
  ensurePackage,
  joinPathFragments,
  type Tree,
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

  createOrEditViteConfig(
    tree,
    {
      project: options.name,
      includeLib: false,
      includeVitest: true,
      inSourceTests: false,
      imports: [`import angular from '@analogjs/vite-plugin-angular';`],
      plugins: ['angular()'],
    },
    true
  );

  const setupFile = joinPathFragments(
    options.projectRoot,
    'src',
    'test-setup.ts'
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
    testEnvironment: 'jsdom',
  });
}
