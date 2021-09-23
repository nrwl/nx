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
import {SubProcessEvent, SubProcessRunner} from '@nrwl/node/src/utils/subProcessRunner';

export const enum InspectType {
  Inspect = 'inspect',
  InspectBrk = 'inspect-brk',
}

export {NodeExecuteBuilderOptions} from '../../utils/types';

type ScheduledEvent = {
  type: "build",
  value: NodeBuildEvent
} | {
  type: "process",
  value: SubProcessEvent
}

type TypedIterator = {
  type: "build",
  iterator: AsyncIterator<NodeBuildEvent, undefined>
} | {
  type: "process",
  iterator: AsyncIterator<SubProcessEvent, undefined>
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

  for await (const event of scheduleBuildAndProcessEvents(startBuild(options, context), processRunner)){
    if(event.type === 'build'){
      if(!event.value.success){
        logger.error('There was an error with the build. See above.');
        logger.info(`${event.value.outfile} was not restarted.`);
      }
    }

    if(event.type === "build" || options.emitSubprocessEvents){
      yield event.value;
    }
  }
}

const nextIterValue = (typedIter: TypedIterator) => typedIter.type === "build"
    ? typedIter.iterator.next().then(result => ({iterator: typedIter.iterator, type: typedIter.type, ...result}))
    : typedIter.iterator.next().then(result => ({iterator: typedIter.iterator, type: typedIter.type, ...result}))

async function* scheduleBuildAndProcessEvents(buildIterator: AsyncIterator<NodeBuildEvent>, subProcessRunner: SubProcessRunner): AsyncGenerator<ScheduledEvent> {
  const iteratorMap = new Map<AsyncIterator<SubProcessEvent|NodeBuildEvent>, ReturnType<typeof nextIterValue>>([
      [buildIterator, nextIterValue({type: "build", iterator: buildIterator})],
  ])

  while(iteratorMap.size > 0){
    const result = await Promise.race(iteratorMap.values());

    if(result.done){
      iteratorMap.delete(result.iterator);
      continue;
    }

    if(result.type === "build" && result.value.success){
      await subProcessRunner.handleBuildEvent(result.value);
      iteratorMap.set(subProcessRunner, nextIterValue({type: "process", iterator: subProcessRunner}));
    }

    iteratorMap.set(result.iterator, nextIterValue(result))

    yield result
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
