export default function () {
  if (global.nxLocalRegistryProcess) {
    global.nxLocalRegistryProcess.kill();
    console.log('Killed local registry process');
  }
}
