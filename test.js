const { promisify } = require('util');
const treeKill = require('tree-kill');
const { fork } = require('child_process');

const sleep = (time = 1000) =>
  new Promise((resolve) => setTimeout(resolve, time));

async function killProcess(proc) {
  // console.log('killing subprocess');

  const promisifiedTreeKill = promisify(treeKill);

  try {
    await promisifiedTreeKill(proc.pid, 'SIGTERM');
  } catch (err) {
    if (Array.isArray(err) && err[0] && err[2]) {
      const errorMessage = err[2];
      logger.error(errorMessage);
    } else if (err.message) {
      logger.error(err.message);
    }
  } finally {
    // console.log('subprocess killed');
    proc = null;
  }
}

function createProcessRunner() {
  const events = [];

  let subProcess;

  return {
    get processExited() {
      return Boolean(subProcess) && subProcess.exitCode != null;
    },
    async handleBuildEvent() {
      if (subProcess) {
        await killProcess(subProcess);
      }

      subProcess = fork('./test.child.js');

      subProcess.on('message', (message) => {
        // console.log('received', { message });
        events.push({ message });
      });

      subProcess.on('exit', (exitCode) => {
        events.push({ exit: exitCode });
      });
    },

    *nextEvents() {
      while (events.length) {
        yield events.shift();
      }
    },
  };
}

async function* startBuild() {
  // yield Promise.resolve('first build');
  await sleep(1000);
  yield Promise.resolve('first build');
  // dev makes changes
  await sleep(1000);
  yield Promise.resolve('second build');
  // dev makes more changes
  await sleep(150);
  yield Promise.resolve('third build');
}

const createBuildRunner = () => {
  const buildEventIterator = startBuild();
  const events = [];

  const runner = {
    complete: false,
    async nextEvent() {
      await sleep(1);
      return events.shift();
    },
  };

  const readNextBuildEvent = () => {
    buildEventIterator.next().then((event) => {
      // console.log('got build event', { event });
      events.push(event);

      if (event.done) {
        runner.complete = true;
      } else {
        readNextBuildEvent();
      }
    });
  };

  readNextBuildEvent();

  return runner;
};

// setInterval(() => {
//   console.log("el tick")
// }, 50)

async function* executor() {
  const buildRunner = createBuildRunner();
  const processRunner = createProcessRunner();

  // for await (const event of merge(buildRunner.events, processRunner.events)) {
  //   if (isBuildEvent(event)) {
  //     await processRunner.handleBuildEvent(event)
  //   }

  //   yield event;
  // }

  while (!buildRunner.complete || !processRunner.processExited) {
    const buildEvent = await buildRunner.nextEvent();

    if (buildEvent) {
      await processRunner.handleBuildEvent(buildEvent);
      yield buildEvent;
    }

    yield* processRunner.nextEvents();
  }
}

async function run() {
  for await (const executorEvent of executor()) {
    console.log({ executorEvent });
  }
}

run()
  .then(() => console.log('done'))
  .catch((e) => {
    console.error({ e });
  });

// async function * runProcess() {

//   subProcess = fork(event.outfile, options.args, {
//     execArgv: getExecArgv(options),
//   });
//   childProcess = fork('foo')
//   yield 'started'

//   while (true) {
//     const res = await new Promise((resolve, reject) => {
//       childProcess.once('exit', () => {
//         resolve()
//       })
//       childProcess.once('message', (message) => {
//         resolve(message)
//       })
//     })

//     yield res;

//     if (res === 'exit') {
//       break;
//     }
//   }
// }

// const asyncIterable = (childProcess) => ({
//   [Symbol.asyncIterator]: () => ({
//     next() {
//       return new Promise((resolve, reject) => {
//         childProcess.once('error', (e) => {
//           reject({error: true, message: e.message})
//         })
//         childProcess.once('exit', () => {
//           resolve({error: false, })
//         })
//         childProcess.once('message', (message) => {
//           resolve(message)
//         })
//       })
//     }
//   })
// })

// for await (const buildEvent of startBuild) {
//   yield buildEvent;
//   yield * runProcess(buildEvent);

//   // for await (const processEvent of runProcess(buildEvent)){
//   //     yield processEvent;
//   //     if(someStateOccured){
//   //         break;
//   //     }
//   // }
// }
