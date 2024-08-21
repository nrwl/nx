import {
  addDependenciesToPackageJson,
  ensurePackage,
  joinPathFragments,
  readJson,
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

  const { createOrEditViteConfig, viteConfigurationGenerator } = ensurePackage<
    typeof import('@nx/vite')
  >('@nx/vite', nxVersion);

  const relativeTestSetupPath = joinPathFragments('src', 'test-setup.ts');
  const isEsmImplicit = readJson(tree, 'package.json').type === 'module';

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

    await viteConfigurationGenerator(tree, {
      project: options.name,
      newProject: true,
      uiFramework: 'angular',
      includeVitest: true,
      testEnvironment: 'jsdom',
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
        useEsmExtension: !isEsmImplicit,
      },
      true
    );
  }
}
