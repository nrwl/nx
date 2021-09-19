import 'dotenv/config';
import {
  runExecutor,
  stripIndents,
  parseTargetString,
  ExecutorContext,
  logger,
  readTargetOptions,
} from '@nrwl/devkit';


import { NodeBuildEvent } from '../build/build.impl';
import { BuildNodeBuilderOptions, NodeExecuteBuilderOptions } from '../../utils/types';
import { SubProcessRunner } from '@nrwl/node/src/utils/subProcessRunner';

export const enum InspectType {
  Inspect = 'inspect',
  InspectBrk = 'inspect-brk',
}

export {NodeExecuteBuilderOptions} from '../../utils/types';

type EventType = "build" | "process";

interface AsyncIteratorDelegator<T> {
  type: EventType;
  iterator: AsyncIterator<T>;
}

export async function* executeExecutor(
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
) {
  const processRunner = new SubProcessRunner(options);

  process.on('SIGTERM', () => {
    processRunner.kill();
    process.exit(128 + 15);
  });
  process.on('exit', (code) => {
    process.exit(code);
  });

  if (options.waitUntilTargets && options.waitUntilTargets.length > 0) {
    const results = await runWaitUntilTargets(options, context);
    for (const [i, result] of results.entries()) {
      if (!result.success) {
        console.log('throw');
        throw new Error(
          `Wait until target failed: ${options.waitUntilTargets[i]}.`
        );
      }
    }
  }

  const delegateIterator = delegateAsyncIteratorEvents(
    {type: 'build', iterator: startBuild(options, context)},
    {type: 'process', iterator: processRunner}
  );

  for await (const event of delegateIterator){
    if(event.type === 'build'){
      if(!event.value.success){
        logger.error('There was an error with the build. See above.');
        logger.info(`${event.value.outfile} was not restarted.`);
      }

      await processRunner.handleBuildEvent(event.value);

      yield event.value;
    }
  }
}

async function* delegateAsyncIteratorEvents<T>(...delegates: AsyncIteratorDelegator<T>[]){
  const getDelegateValue = (iterator: AsyncIterator<T>, type: EventType) =>
    iterator.next().then(result => ({
      iterator,
      type,
      result
    }));

  const delegateMap = new Map(delegates.map(({type, iterator}) => [
    iterator,
    getDelegateValue(iterator, type)
  ]));

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

async function* startBuild(
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
) {
  const buildTarget = parseTargetString(options.buildTarget);
  const buildOptions = readTargetOptions<BuildNodeBuilderOptions>(
    buildTarget,
    context
  );
  if (buildOptions.optimization) {
    logger.warn(stripIndents`
            ************************************************
            This is a simple process manager for use in
            testing or debugging Node applications locally.
            DO NOT USE IT FOR PRODUCTION!
            You should look into proper means of deploying
            your node application to production.
            ************************************************`);
  }

  yield* await runExecutor<NodeBuildEvent>(
    buildTarget,
    {
      watch: options.watch,
    },
    context
  );
}

function runWaitUntilTargets(
  options: NodeExecuteBuilderOptions,
  context: ExecutorContext
): Promise<{ success: boolean }[]> {
  return Promise.all(
    options.waitUntilTargets.map(async (waitUntilTarget) => {
      const target = parseTargetString(waitUntilTarget);
      const output = await runExecutor(target, {}, context);
      return new Promise<{ success: boolean }>(async (resolve) => {
        let event = await output.next();
        // Resolve after first event
        resolve(event.value as { success: boolean });

        // Continue iterating
        while (!event.done) {
          event = await output.next();
        }
      });
    })
  );
}

export default executeExecutor;
