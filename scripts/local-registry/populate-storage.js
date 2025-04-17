// @ts-check
const { exec } = require('node:child_process');
const {
  LARGE_BUFFER,
} = require('nx/src/executors/run-commands/run-commands.impl');

async function populateLocalRegistryStorage() {
  await new Promise((res) => {
    setTimeout(() => {
      res(undefined);
    }, 5000);
  });

  try {
    const publishVersion = process.env.PUBLISHED_VERSION ?? 'major';
    const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';

    console.log('Publishing packages to local registry to populate storage');
    await runLocalRelease(publishVersion, isVerbose);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
exports.populateLocalRegistryStorage = populateLocalRegistryStorage;

function runLocalRelease(publishVersion, isVerbose) {
  return new Promise((res, rej) => {
    const publishProcess = exec(`pnpm nx-release --local ${publishVersion}`, {
      env: process.env,
      maxBuffer: LARGE_BUFFER,
    });
    let logs = Buffer.from('');
    if (isVerbose) {
      publishProcess?.stdout?.pipe(process.stdout);
      publishProcess?.stderr?.pipe(process.stderr);
    } else {
      publishProcess?.stdout?.on('data', (data) => (logs += data));
      publishProcess?.stderr?.on('data', (data) => (logs += data));
    }
    publishProcess.on('exit', (code) => {
      if (code && code > 0) {
        if (!isVerbose) {
          console.log(logs.toString());
        }
        rej(code);
      }
      res(undefined);
    });
  });
}
exports.runLocalRelease = runLocalRelease;
