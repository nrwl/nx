const { FileLock } = require('../../native-bindings.js');
const tmp = require('os').tmpdir();

(async () => {
  const lock = new FileLock(
    require('path').join(tmp, 'nx-unit-tests', 'file-lock-fixture')
  );
  if (lock.locked) {
    await lock.wait();
    console.log('waited for lock');
  } else {
    await lock.lock();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('ran with lock');
    await lock.unlock();
  }
})();
