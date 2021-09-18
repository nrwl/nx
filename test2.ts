// @ts-nocheck

import { promisify } from 'util';
const treeKill = require('tree-kill');
import { fork } from 'child_process';
import {PromiseQueue} from './packages/node/src/utils/promise-queue';

const sleep = (time = 1000) =>
  new Promise((resolve) => setTimeout(resolve, time));

async function killProcess(proc) {

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

const createProcessRunner = () => {
  let subProcess = null;
  const queue = new PromiseQueue();
  const isComplete = () =>  Boolean(subProcess) && subProcess.exitCode != null;

  return {
    handleBuildEvent: async (event) => {
      if (subProcess) {
        await killProcess(subProcess);
      }

      subProcess = fork('./test.child.js');

      subProcess.on('message', (message) => {
        queue.enqueue({ message });
      });

      subProcess.on('exit', (exitCode) => {
        queue.enqueue({ exit: exitCode });
      });
    },

    async next(){
      if(isComplete()) return {done: true};

      const value = await queue.dequeue();

      return {
        done: false,
        value
      }
    },
  }
};


async function* delegate(...delegates){
  const getDelegateValue = (iterator, type) => iterator.next().then(result => ({iterator, type, result}));
  const intoDelegateEntry = ({type, iterator}) => [
    iterator,
    getDelegateValue(iterator, type)
  ];

  const delegateMap = new Map(delegates.map(intoDelegateEntry));

  while(delegateMap.size > 0){
    const {iterator, result, type} = await Promise.race(delegateMap.values());

    if(result.done){
      delegateMap.delete(iterator);
      continue;
    }

    delegateMap.set(iterator, getDelegateValue(iterator, type));
    yield {
      type,
      value: result.value
    }
  }
}

const isBuildEvent = ({type}) => type === "build";

async function* executor() {
  const processRunner = createProcessRunner();

  for await (const event of delegate({type: 'build', iterator: startBuild()}, {type: 'process', iterator: processRunner})) {
    if (isBuildEvent(event)) {
      await processRunner.handleBuildEvent(event)
    }

    yield event.value;
  }
}

async function run() {

  for await (const executorEvent of executor()) {
    console.log(JSON.stringify({ executorEvent }, null, 1));
  }
}

run()
  .then(() => console.log('done'))
  .catch((e) => {
    console.error({ e });
  });
