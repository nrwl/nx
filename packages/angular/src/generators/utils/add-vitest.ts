import {
  addDependenciesToPackageJson,
  ensurePackage,
  getDependencyVersionFromPackageJson,
  joinPathFragments,
  logger,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { readModulePackageJson } from 'nx/src/devkit-internals';
import { intersects, satisfies, valid, validRange } from 'semver';
import { nxVersion } from '../../utils/versions';
import {
  getInstalledAngularDevkitVersion,
  getInstalledAngularVersionInfo,
  versions,
} from './version-utils';

export type AddVitestAngularOptions = {
  name: string;
  projectRoot: string;
  skipPackageJson: boolean;
  useNxUnitTestRunnerExecutor?: boolean;
};

export type AddVitestAnalogOptions = {
  name: string;
  projectRoot: string;
  skipFormat: boolean;
  skipPackageJson: boolean;
  strict: boolean;
  zoneless: boolean;
  addPlugin?: boolean;
};

export async function addVitestAngular(
  tree: Tree,
  options: AddVitestAngularOptions
): Promise<void> {
  validateVitestVersion(tree);

  const executor = options.useNxUnitTestRunnerExecutor
    ? '@nx/angular:unit-test'
    : '@angular/build:unit-test';
  const project = readProjectConfiguration(tree, options.name);
  project.targets ??= {};
  project.targets.test = { executor, options: {} };
  updateProjectConfiguration(tree, options.name, project);

  const nxJson = readNxJson(tree);
  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults[executor] ??= {
    cache: true,
    inputs:
      nxJson.namedInputs && 'production' in nxJson.namedInputs
        ? ['default', '^production']
        : ['default', '^default'],
  };
  updateNxJson(tree, nxJson);

  configureTypeScriptForVitest(tree, options.projectRoot);
  addVitestScreenshotsToGitIgnore(tree);

  if (!options.skipPackageJson) {
    const pkgVersions = versions(tree, { minAngularMajorVersion: 21 });
    const angularDevkitVersion =
      getInstalledAngularDevkitVersion(tree) ??
      pkgVersions.angularDevkitVersion;

    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@angular/build': angularDevkitVersion,
        jsdom: pkgVersions.jsdomVersion,
        vitest: pkgVersions.vitestVersion,
      },
      undefined,
      true
    );
  }
}

export async function addVitestAnalog(
  tree: Tree,
  options: AddVitestAnalogOptions
): Promise<void> {
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

  if (!options.skipPackageJson) {
    const angularDevkitVersion =
      getInstalledAngularDevkitVersion(tree) ??
      versions(tree).angularDevkitVersion;
    const devDependencies: Record<string, string> = {
      '@angular/build': angularDevkitVersion,
    };

    // Add compatible vitest/jsdom versions BEFORE calling configurationGenerator
    // so that @nx/vitest respects existing versions
    if (angularMajorVersion < 21) {
      const pkgVersions = versions(tree);
      devDependencies['vitest'] = pkgVersions.vitestVersion;
      devDependencies['jsdom'] = pkgVersions.jsdomVersion;
    }

    addDependenciesToPackageJson(tree, {}, devDependencies, undefined, true);
  }

  ensurePackage('@nx/vitest', nxVersion);
  const { configurationGenerator } = await import('@nx/vitest/generators');

  await configurationGenerator(tree, {
    project: options.name,
    uiFramework: 'angular',
    testEnvironment: 'jsdom',
    coverageProvider: 'v8',
    addPlugin: options.addPlugin ?? false,
    skipFormat: options.skipFormat,
    skipPackageJson: options.skipPackageJson,
  });

  createAnalogSetupFile(tree, options, angularMajorVersion);
}

function validateVitestVersion(tree: Tree): void {
  let installedVitestVersion: string | null = null;

  // Try to get the actual installed version from node_modules
  try {
    const { packageJson } = readModulePackageJson('vitest');
    installedVitestVersion = packageJson.version;
  } catch {}

  const pkgVersions = versions(tree, { minAngularMajorVersion: 21 });
  const requiredRange = pkgVersions.vitestVersion;

  if (installedVitestVersion) {
    if (
      !satisfies(installedVitestVersion, requiredRange, {
        includePrerelease: true,
      })
    ) {
      throw new Error(
        `The installed vitest version "${installedVitestVersion}" is not compatible with the version range Angular requires: "${requiredRange}".`
      );
    }

    return;
  }

  // not installed, get it from package.json
  installedVitestVersion = getDependencyVersionFromPackageJson(tree, 'vitest');
  if (!installedVitestVersion) {
    // not declared anywhere, it'll be installed with the correct version
    return;
  }

  if (valid(installedVitestVersion)) {
    if (
      !satisfies(installedVitestVersion, requiredRange, {
        includePrerelease: true,
      })
    ) {
      throw new Error(
        `The installed vitest version "${installedVitestVersion}" is not compatible with the version range Angular requires: "${requiredRange}".`
      );
    }
  } else if (validRange(installedVitestVersion)) {
    // it's a range from package.json, check if it intersects with the required range
    if (
      !intersects(installedVitestVersion, requiredRange, {
        includePrerelease: true,
      })
    ) {
      throw new Error(
        `The declared vitest version range "${installedVitestVersion}" does not overlap with the version range Angular requires: "${requiredRange}". When installed, this may cause compatibility issues.`
      );
    }
  } else {
    // it can be anything, we don't have a way to validate it
    // log a warning and continue
    logger.warn(
      `The declared vitest version "${installedVitestVersion}" is not a valid semver range, ` +
        `so we can't validate if it's compatible with the version range Angular requires: "${requiredRange}". ` +
        `The generation will continue, but you may encounter issues if the version is not compatible.`
    );
  }
}

function configureTypeScriptForVitest(tree: Tree, projectRoot: string): void {
  writeJson(tree, joinPathFragments(projectRoot, 'tsconfig.spec.json'), {
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: `${offsetFromRoot(projectRoot)}dist/out-tsc`,
      types: ['vitest/globals'],
    },
    include: ['src/**/*.ts', 'src/**/*.d.ts'],
  });

  const projectTsconfigPath = joinPathFragments(projectRoot, 'tsconfig.json');
  updateJson(tree, projectTsconfigPath, (json) => {
    json.references ??= [];
    if (!json.references.some((ref) => ref.path === './tsconfig.spec.json')) {
      json.references.push({ path: './tsconfig.spec.json' });
    }
    return json;
  });
}

function addVitestScreenshotsToGitIgnore(tree: Tree): void {
  if (tree.exists('.gitignore')) {
    let content = tree.read('.gitignore', 'utf-8');
    if (/^__screenshots__\/$/gm.test(content)) {
      return;
    }

    content = `${content}\n__screenshots__/\n`;
    tree.write('.gitignore', content);
  } else {
    logger.warn(`Couldn't find .gitignore file to update`);
  }
}

function createAnalogSetupFile(
  tree: Tree,
  options: AddVitestAnalogOptions,
  angularMajorVersion: number
): void {
  let setupFile: string;

  if (angularMajorVersion >= 21) {
    setupFile = `import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed(${options.zoneless ? '' : '{ zoneless: false }'});
`;
  } else if (angularMajorVersion === 20) {
    setupFile = `import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);
`;
  } else {
    setupFile = `import '@analogjs/vitest-angular/setup-zone';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);
`;
  }

  tree.write(
    joinPathFragments(options.projectRoot, 'src/test-setup.ts'),
    setupFile
  );
}
