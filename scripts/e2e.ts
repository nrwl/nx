import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { ensureDirSync, removeSync } from 'fs-extra';
const kill = require('tree-kill');
import { build } from './package';

process.env.PUBLISHED_VERSION = `9999.0.2`;
process.env.npm_config_registry = `http://localhost:4872/`;
process.env.YARN_REGISTRY = process.env.npm_config_registry;

export const getDirectories = (source) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

function updateVersion(packagePath) {
  return execSync(`npm version ${process.env.PUBLISHED_VERSION}`, {
    cwd: packagePath,
  });
}

function publishPackage(packagePath) {
  if (process.env.npm_config_registry.indexOf('http://localhost') === -1) {
    throw Error(`
      ------------------
      💣 ERROR 💣 => $NPM_REGISTRY does not look like a local registry'
      ------------------
    `);
  }
  try {
    execSync(`npm publish`, {
      cwd: packagePath,
      env: process.env,
    });
  } catch (e) {}
}

export function setup() {
  getDirectories('./build/packages').map((pkg) => {
    updateVersion(`./build/packages/${pkg}`);
    publishPackage(`./build/packages/${pkg}`);
  });
}

async function runTest() {
  let selectedProjects = process.argv[2];

  let testNamePattern = '';
  if (process.argv[3] === '-t' || process.argv[3] == '--testNamePattern') {
    testNamePattern = `--testNamePattern "${process.argv[4]}"`;
  }

  if (process.argv[3] === 'affected') {
    const affected = execSync(
      `npx nx print-affected --base=origin/master --select=projects`
    )
      .toString()
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    selectedProjects =
      affected.length === 0
        ? selectedProjects
        : selectedProjects
            .split(',')
            .filter((s) => affected.indexOf(s) > -1)
            .join(',');
  }

  build(process.env.PUBLISHED_VERSION, '~10.0.0', '3.9.3', '2.1.2');

  if (process.argv[5] != '--rerun') {
    removeSync(`tmp`);
    ensureDirSync(`tmp/angular`);
    ensureDirSync(`tmp/nx`);
  }

  try {
    setup();
    if (selectedProjects === '') {
      console.log('No tests to run');
    } else if (selectedProjects) {
      execSync(
        `yarn nx run-many --target=e2e --projects=${selectedProjects} ${testNamePattern}`,
        {
          stdio: [0, 1, 2],
          env: { ...process.env, NX_TERMINAL_CAPTURE_STDERR: 'true' },
        }
      );
    } else {
      execSync(`yarn nx run-many --target=e2e --all`, {
        stdio: [0, 1, 2],
        env: { ...process.env, NX_TERMINAL_CAPTURE_STDERR: 'true' },
      });
    }
    cleanUp(0);
  } catch (e) {
    console.log(e);
    cleanUp(1);
  }
}

function cleanUp(code) {
  // try terminate everything first
  try {
    if (!process.env.CI) {
      kill(0);
    }
  } catch (e) {}
  // try killing everything after in case something hasn't terminated
  try {
    if (!process.env.CI) {
      kill(0, 'SIGKILL');
    }
  } catch (e) {}

  process.exit(code);
}

process.on('SIGINT', () => cleanUp(1));

runTest()
  .then(() => {
    console.log('done');
    process.exit(0);
  })
  .catch((e) => {
    console.error('error', e);
    process.exit(1);
  });
