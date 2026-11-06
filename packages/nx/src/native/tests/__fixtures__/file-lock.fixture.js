const { FileLock } = require('../../native-bindings.js');
const ora = require('ora');
const tmp = require('os').tmpdir();

(async () => {
  const lock = new FileLock(
    require('path').join(tmp, 'nx-unit-tests', 'file-lock-fixture')
  );
  console.log(lock.locked ? 'found lock held' : 'found lock free');
  if (lock.locked) {
    const s = ora('Waiting for lock').start();
    await lock.wait();
    s.stop();
    console.log('waited for lock');
  } else {
    await lock.lock();
    console.log('holding lock');
    if (process.env.HOLD_UNTIL_RELEASED === 'true') {
      await new Promise((resolve) => process.once('message', resolve));
    }
    console.log('ran with lock');
    await lock.unlock();
  }
})();
