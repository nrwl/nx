const { execSync } = require('child_process');
import { readdirSync } from 'fs';
const { promisify } = require('util');
const { spawn, exec } = require('child_process');
const kill = require('tree-kill');

const asyncExec = promisify(exec);
let localRegistryProcess;

process.env.PUBLISHED_VERSION = `9999.0.1`;
process.env.npm_config_registry = `http://localhost:4872/`;

export const getDirectories = (source) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

async function spawnLocalRegistry() {
  localRegistryProcess = spawn('npx', [
    'verdaccio',
    '--config',
    './scripts/local-registry/config.yml',
    '--listen',
    '4872',
  ]);

  let collectedOutput = [];
  let resolvedOrRejected = false;

  setTimeout(() => {
    if (!resolvedOrRejected) {
      console.error(collectedOutput.join(''));
      cleanUp(1);
    }
  }, 10000);

  await new Promise((res, rej) => {
    localRegistryProcess.stdout.on('data', (data) => {
      collectedOutput.push(data.toString());
      // wait for local-registry to come online
      if (data.includes('http address')) {
        resolvedOrRejected = true;
        res();
      }
    });
    localRegistryProcess.on('error', (err) => {
      console.error(collectedOutput.join(''));
      resolvedOrRejected = true;
      rej(err);
    });
  });
}

async function updateVersion(packagePath) {
  return exec(`npm version ${process.env.PUBLISHED_VERSION}`, {
    cwd: packagePath,
  });
}

async function publishPackage(packagePath) {
  if (process.env.npm_config_registry.indexOf('http://localhost') === -1) {
    throw Error(`
      ------------------
      💣 ERROR 💣 => $NPM_REGISTRY does not look like a local registry'
      ------------------
    `);
  }
  await asyncExec(`npm publish`, {
    cwd: packagePath,
    env: process.env,
  });
}

export async function setup() {
  // @ts-ignore
  await spawnLocalRegistry();
  await Promise.all(
    getDirectories('./build/packages').map(async (pkg) => {
      await updateVersion(`./build/packages/${pkg}`);
      return await publishPackage(`./build/packages/${pkg}`);
    })
  );
}

async function runTest() {
  let selectedProjects = process.argv[2];

  if (process.argv[3] === 'affected') {
    const affected = execSync(
      `nx print-affected --base=origin/master --select=projects`
    )
      .toString()
      .split(',')
      .map((s) => s.trim());
    selectedProjects = selectedProjects
      .split(',')
      .filter((s) => affected.indexOf(s) > -1)
      .join(',');
  }

  execSync(`./scripts/package.sh 9999.0.1 "~9.1.0" "3.8.3" "2.0.4"`, {
    stdio: [0, 1, 2],
  });
  execSync(`rm -rf tmp`);
  execSync(`mkdir -p tmp/angular`);
  execSync(`mkdir -p tmp/nx`);

  try {
    await setup();
    if (selectedProjects) {
      execSync(`nx run-many --target=e2e --projects=${selectedProjects}`, {
        stdio: [0, 1, 2],
      });
    } else {
      execSync(`nx run-many --target=e2e --all`, { stdio: [0, 1, 2] });
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
  try {
    if (localRegistryProcess) localRegistryProcess.kill(0);
  } catch (e) {}
  // try killing everything after in case something hasn't terminated
  try {
    if (!process.env.CI) {
      kill(0, 'SIGKILL');
    }
  } catch (e) {}
  try {
    if (localRegistryProcess) localRegistryProcess.kill(0, 'SIGKILL');
  } catch (e) {}

  process.exit(code);
}

runTest()
  .then(() => {
    process.exit(0);
    console.log('done');
  })
  .catch((e) => {
    console.error('error', e);
    process.exit(1);
  });
