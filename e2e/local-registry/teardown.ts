module.exports = async function teardown() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const asyncExec = promisify(exec);

  // @ts-ignore
  global.localRegistryProcess.kill();
  // get rid of the local-registry storage
  await asyncExec(`rm -rf build/e2e/local-registry/storage`);
};
