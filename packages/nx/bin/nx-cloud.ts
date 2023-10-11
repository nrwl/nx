#!/usr/bin/env node

import { findAncestorNodeModules } from '../lib/light-client/resolution-helpers';
import { getCloudOptions } from '../lib/utilities/get-cloud-options';

const command = process.argv[2];

const { nxCloudOptions: options } = getCloudOptions();

Promise.resolve().then(async () => invokeCommandWithLightRunner(options));

async function invokeCommandWithLightRunner(options) {
  const { debugLog } = require('../lib/light-client/debug-logger');
  debugLog('Verifying current cloud bundle');
  const {
    verifyOrUpdateCloudBundle,
  } = require('../lib/light-client/update-manager');
  const cloudBundleInstall = await verifyOrUpdateCloudBundle(options);

  if (cloudBundleInstall === null) {
    console.log(
      '[Nx Cloud] Error: Unable to retrieve Nx Cloud bundle. Cannot run commands from the `nx-cloud` package.'
    );
    process.exit(1);
  }

  if (cloudBundleInstall.version === 'NX_ENTERPRISE_OUTDATED_IMAGE') {
    throw new Error('Update Enterprise');
  }

  debugLog('Done: ', cloudBundleInstall.fullPath);

  const lightClient = require(cloudBundleInstall.fullPath);

  const paths = findAncestorNodeModules(__dirname, []);
  lightClient.configureLightClientRequire()(paths);

  // Detect partial installs from early release enterprise images
  if (lightClient.commands === undefined) {
    throw new Error('Update Enterprise');
  }

  if (command in lightClient.commands) {
    lightClient.commands[command]()
      .then(() => process.exit(0))
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
  } else {
    console.log(`[Nx Cloud] Error: Unknown Command "${command}"`);
    console.log('----------------------------------------------');
    console.log(
      `Available Commands:\n> ${Object.keys(lightClient.commands).join('\n> ')}`
    );
    console.log('----------------------------------------------');
    process.exit(1);
  }
}
