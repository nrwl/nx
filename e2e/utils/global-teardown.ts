import * as detectPort from 'detect-port';

export default async function () {
  if (global.e2eTeardown && typeof global.e2eTeardown === 'function') {
    console.log('detectPort', await detectPort(4873));
    global.e2eTeardown();
    console.log('Killed local registry process');
    console.log('detectPort', await detectPort(4873));
  }
}
