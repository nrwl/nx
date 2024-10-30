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

  const { createOrEditViteConfig, vitestGenerator } = ensurePackage<
    typeof import('@nx/vite')
  >('@nx/vite', nxVersion);

  const relativeTestSetupPath = joinPathFragments('src', 'test-setup.ts');

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

    await vitestGenerator(tree, {
      project: options.name,
      uiFramework: 'none',
      skipViteConfig: true,
      testEnvironment: 'jsdom',
      coverageProvider: 'v8',
      addPlugin: false,
    });

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
        useEsmExtension: true,
      },
      true
    );
  }
}
