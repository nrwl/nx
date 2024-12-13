export default async function () {
  if (global.e2eTeardown) {
    await global.e2eTeardown();
    console.log('Killed local registry process');
  }
}
