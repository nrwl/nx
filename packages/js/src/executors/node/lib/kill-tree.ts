// Adapted from https://raw.githubusercontent.com/pkrumins/node-tree-kill/deee138/index.js
import { spawn, exec, ExecException } from 'child_process';

export async function killTree(pid: number, signal: NodeJS.Signals) {
  const tree = {};
  const pidsToProcess = {};
  tree[pid] = [];
  pidsToProcess[pid] = 1;

  return new Promise<void>((resolve, reject) => {
    const callback = (error: ExecException | null) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    switch (process.platform) {
      case 'win32':
        exec('taskkill /pid ' + pid + ' /T /F', (error) => {
          // Ignore Fatal errors (128) because it might be due to the process already being killed.
          // On Linux/Mac we can check ESRCH (no such process), but on Windows we can't.
          callback(error?.code !== 128 ? error : null);
        });
        break;
      case 'darwin':
        buildProcessTree(
          pid,
          tree,
          pidsToProcess,
          function (parentPid) {
            return spawn('pgrep', ['-P', parentPid]);
          },
          function () {
            killAll(tree, signal, callback);
          }
        );
        break;
      default: // Linux
        buildProcessTree(
          pid,
          tree,
          pidsToProcess,
          function (parentPid) {
            return spawn('ps', [
              '-o',
              'pid',
              '--no-headers',
              '--ppid',
              parentPid,
            ]);
          },
          function () {
            killAll(tree, signal, callback);
          }
        );
        break;
    }
  });
}

function killAll(tree, signal, callback) {
  const killed = {};
  try {
    Object.keys(tree).forEach(function (pid) {
      tree[pid].forEach(function (pidpid) {
        if (!killed[pidpid]) {
          killPid(pidpid, signal);
          killed[pidpid] = 1;
        }
      });
      if (!killed[pid]) {
        killPid(pid, signal);
        killed[pid] = 1;
      }
    });
  } catch (err) {
    if (callback) {
      return callback(err);
    } else {
      throw err;
    }
  }
  if (callback) {
    return callback();
  }
}

function killPid(pid, signal) {
  try {
    process.kill(parseInt(pid, 10), signal);
  } catch (err) {
    if (err.code !== 'ESRCH') throw err;
  }
}

function buildProcessTree(
  parentPid,
  tree,
  pidsToProcess,
  spawnChildProcessesList,
  cb
) {
  const ps = spawnChildProcessesList(parentPid);
  let allData = '';
  ps.stdout.on('data', (data) => {
    data = data.toString('ascii');
    allData += data;
  });

  const onClose = function (code) {
    delete pidsToProcess[parentPid];

    if (code != 0) {
      // no more parent processes
      if (Object.keys(pidsToProcess).length == 0) {
        cb();
      }
      return;
    }

    allData.match(/\d+/g).forEach((_pid) => {
      const pid = parseInt(_pid, 10);
      tree[parentPid].push(pid);
      tree[pid] = [];
      pidsToProcess[pid] = 1;
      buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesList, cb);
    });
  };

  ps.on('close', onClose);
}
