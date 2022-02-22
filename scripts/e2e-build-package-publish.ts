import { execSync } from 'child_process';
import { readFileSync, writeFileSync, remove } from 'fs-extra';
import { existsSync, readdirSync } from 'fs';
import {
  prettierVersion,
  typescriptVersion,
} from '../packages/workspace/src/utils/versions';

process.env.PUBLISHED_VERSION = `9999.0.2`;
process.env.npm_config_registry = `http://localhost:4872`;
process.env.YARN_REGISTRY = process.env.npm_config_registry;

async function buildPackagePublishAndCleanPorts() {
  if (!process.env.NX_E2E_SKIP_BUILD_CLEANUP) {
    if (!process.env.CI) {
      console.log(`
  Did you know that you can run the command with:
    > NX_E2E_SKIP_BUILD_CLEANUP - saves time by reusing the previously built local packages
    > CI - simulate the CI environment settings\n`);
    }
    await Promise.all([
      remove('./build'),
      remove('./tmp/nx/proj-backup'),
      remove('./tmp/angular/proj-backup'),
      remove('./tmp/local-registry'),
    ]);
  }
  if (!process.env.NX_E2E_SKIP_BUILD_CLEANUP || !existsSync('./build')) {
    build(process.env.PUBLISHED_VERSION);
    try {
      await updateVersionsAndPublishPackages();
    } catch (e) {
      console.log(e);
      process.exit(1);
    }
  } else {
    console.log(`\n⏩ Project building skipped. Reusing the existing packages`);
  }
}

const getDirectories = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

async function updateVersionsAndPublishPackages() {
  const npmMajorVersion = execSync(`npm --version`)
    .toString('utf-8')
    .trim()
    .split('.')[0];

  const directories = getDirectories('./build/packages');

  await Promise.all(
    directories.map(async (pkg) => {
      updateVersion(`./build/packages/${pkg}`);
      publishPackage(`./build/packages/${pkg}`, +npmMajorVersion);
    })
  );
}

function updateVersion(packagePath: string) {
  return execSync(`npm version ${process.env.PUBLISHED_VERSION}`, {
    cwd: packagePath,
  });
}

async function publishPackage(packagePath: string, npmMajorVersion: number) {
  if (process.env.npm_config_registry.indexOf('http://localhost') === -1) {
    throw Error(`
      ------------------
      💣 ERROR 💣 => $NPM_REGISTRY does not look like a local registry'
      ------------------
    `);
  }
  try {
    console.log(` 📦 ${packagePath}`);

    // NPM@7 requires a token to publish, thus, is just a matter of fake a token to bypass npm.
    // See: https://twitter.com/verdaccio_npm/status/1357798427283910660
    if (npmMajorVersion >= 7) {
      writeFileSync(
        `${packagePath}/.npmrc`,
        `registry=${
          process.env.npm_config_registry
        }\n${process.env.npm_config_registry.replace(
          'http:',
          ''
        )}/:_authToken=fake`
      );
    }

    execSync(`npm publish`, {
      cwd: packagePath,
      env: process.env,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
}

function build(nxVersion: string) {
  try {
    const b = new Date();
    const projectsToExclude = [
      'docs',
      'nx-dev-data-access-documents',
      'nx-dev-e2e',
      'nx-dev',
      'nx-dev-feature-analytics',
      'nx-dev-feature-conf',
      'nx-dev-feature-doc-viewer',
      'nx-dev-feature-search',
      'nx-dev-feature-storage',
      'nx-dev-feature-versions-and-flavors',
      'nx-dev-ui-commands',
      'nx-dev-ui-common',
      'nx-dev-ui-home',
      'nx-dev-ui-member-card',
      'nx-dev-ui-sponsor-card',
      'typedoc-theme',
    ].join(',');
    execSync(
      `npx nx run-many --target=build --all --parallel=8 --exclude=${projectsToExclude}`,
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NX_INVOKED_BY_RUNNER: 'false' },
      }
    );
    const a = new Date();
    console.log(
      `\n> Packages built successfully in ${
        (a.getTime() - b.getTime()) / 1000
      }s\n`
    );
  } catch (e) {
    console.log(e.output.toString());
    console.log('Build failed. See error above.');
    process.exit(1);
  }

  const BUILD_DIR = 'build/packages';

  const files = [
    ...[
      'react',
      'next',
      'web',
      'jest',
      'node',
      'express',
      'nest',
      'cypress',
      'storybook',
      'angular',
      'workspace',
      'react-native',
      'detox',
      'js',
    ].map((f) => `${f}/src/utils/versions.js`),
    ...[
      'react',
      'next',
      'web',
      'jest',
      'node',
      'express',
      'nest',
      'cypress',
      'storybook',
      'angular',
      'workspace',
      'cli',
      'linter',
      'tao',
      'devkit',
      'eslint-plugin-nx',
      'create-nx-workspace',
      'create-nx-plugin',
      'nx-plugin',
      'react-native',
      'detox',
      'js',
    ].map((f) => `${f}/package.json`),
    'create-nx-workspace/bin/create-nx-workspace.js',
    'create-nx-plugin/bin/create-nx-plugin.js',
  ].map((f) => `${BUILD_DIR}/${f}`);

  files.forEach((f) => {
    const content = readFileSync(f, 'utf-8')
      .replace(
        /exports.nxVersion = '\*'/g,
        `exports.nxVersion = '${nxVersion}'`
      )
      .replace(/NX_VERSION/g, nxVersion)
      .replace(/TYPESCRIPT_VERSION/g, typescriptVersion)
      .replace(/PRETTIER_VERSION/g, prettierVersion);

    writeFileSync(f, content);
  });
}

(async () => {
  await buildPackagePublishAndCleanPorts();
})();
