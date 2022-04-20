import { ExecutorContext, runExecutor } from '@nrwl/devkit';
import devServerExecutor, {
  WebDevServerOptions,
} from '@nrwl/web/src/executors/dev-server/dev-server.impl';
import { join } from 'path';

type ModuleFederationDevServerOptions = WebDevServerOptions & {
  devRemotes?: string | string[];
};

export default async function* moduleFederationDevServer(
  options: ModuleFederationDevServerOptions,
  context: ExecutorContext
) {
  let iter = devServerExecutor(options, context);
  const p = context.workspace.projects[context.projectName];

  const moduleFederationConfigPath = join(
    context.root,
    p.root,
    'module-federation.config.js'
  );

  let moduleFederationConfig: any;
  try {
    moduleFederationConfig = require(moduleFederationConfigPath);
  } catch {
    // TODO(jack): Add a link to guide
    throw new Error(
      `Could not load ${moduleFederationConfigPath}. Was this project generated with "@nrwl/react:host"?`
    );
  }

  const knownRemotes = moduleFederationConfig.remotes ?? [];

  const devServeApps = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  for (const app of knownRemotes) {
    const isDev = devServeApps.includes(app);
    iter = combineAsyncIterators(
      iter,
      await runExecutor(
        {
          project: app,
          target: isDev ? 'serve' : 'serve-static',
          configuration: context.configurationName,
        },
        {
          watch: isDev,
        },
        context
      )
    );
  }

  return yield* iter;
}

// TODO(jack): Extract this helper
function getNextAsyncIteratorFactory(options) {
  return async (asyncIterator, index) => {
    try {
      const iterator = await asyncIterator.next();

      return { index, iterator };
    } catch (err) {
      if (options.errorCallback) {
        options.errorCallback(err, index);
      }
      if (options.throwError !== false) {
        return Promise.reject(err);
      }

      return { index, iterator: { done: true } };
    }
  };
}

async function* combineAsyncIterators(
  ...iterators: { 0: AsyncIterator<any> } & AsyncIterator<any>[]
) {
  let [options] = iterators;
  if (typeof options.next === 'function') {
    options = Object.create(null);
  } else {
    iterators.shift();
  }

  const getNextAsyncIteratorValue = getNextAsyncIteratorFactory(options);

  try {
    const asyncIteratorsValues = new Map(
      iterators.map((it, idx) => [idx, getNextAsyncIteratorValue(it, idx)])
    );

    do {
      const { iterator, index } = await Promise.race(
        asyncIteratorsValues.values()
      );
      if (iterator.done) {
        asyncIteratorsValues.delete(index);
      } else {
        yield iterator.value;
        asyncIteratorsValues.set(
          index,
          getNextAsyncIteratorValue(iterators[index], index)
        );
      }
    } while (asyncIteratorsValues.size > 0);
  } finally {
    await Promise.allSettled(iterators.map((it) => it.return()));
  }
}
