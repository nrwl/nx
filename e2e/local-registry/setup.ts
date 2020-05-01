import { promisify } from 'util';
import { spawn, exec } from 'child_process';
import { getDirectories } from '../utils';

const asyncExec = promisify(exec);

process.env.PUBLISHED_VERSION = `9999.0.0`;

async function spawnLocalRegistry() {
  const localRegistryProcess = spawn('npx', [
    'verdaccio',
    '--config',
    './e2e/local-registry/config.yml',
    '--listen',
    '4872'
  ]);
  try {
    await new Promise((res, rej) => {
      localRegistryProcess.stdout.on('data', data => {
        // wait for local-registry to come online
        if (data.includes('http address')) {
          res();
        }
      });
      localRegistryProcess.on('error', err => {
        rej(err);
      });
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
  return localRegistryProcess;
}

async function updateVersion(packagePath) {
  return exec(`npm version ${process.env.PUBLISHED_VERSION}`, {
    cwd: packagePath
  });
}

async function publishPackage(packagePath) {
  await asyncExec(`npm publish`, {
    cwd: packagePath,
    env: process.env
  });
}

module.exports = async function setup() {
  // @ts-ignore
  global.localRegistryProcess = await spawnLocalRegistry();
  await Promise.all(
    getDirectories('./build/packages').map(async pkg => {
      await updateVersion(`./build/packages/${pkg}`);
      return await publishPackage(`./build/packages/${pkg}`);
    })
  );
};
