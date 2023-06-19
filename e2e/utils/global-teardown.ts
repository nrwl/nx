export default function () {
  if (global.e2eTeardown) {
    global.e2eTeardown();
    console.log('Killed local registry process');
  }
}
