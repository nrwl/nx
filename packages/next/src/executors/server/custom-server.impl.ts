import { ExecutorContext, parseTargetString, runExecutor } from '@nx/devkit';
import { join } from 'path';

import { NextServeBuilderOptions } from '../../utils/types';

export default async function* serveExecutor(
  options: NextServeBuilderOptions,
  context: ExecutorContext
) {
  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV = process.env.NODE_ENV
    ? process.env.NODE_ENV
    : options.dev
    ? 'development'
    : 'production';

  let { port } = options;
  if(!port && process.env.PORT) {
    port = parseInt(process.env.PORT, 10);
  }

  // Setting port that the custom server should use.
  if(port) {
    (process.env as any).PORT = `${options.port}`;
  }

  const projectRoot = context.projectGraph.nodes[context.projectName].data.root;

  yield* runCustomServer(projectRoot, options, context);
}

async function* runCustomServer(
  root: string,
  options: NextServeBuilderOptions,
  context: ExecutorContext
) {
  process.env.NX_NEXT_DIR = root;
  process.env.NX_NEXT_PUBLIC_DIR = join(root, 'public');

  let { port } = options;
  if(!port && process.env.PORT) {
    port = parseInt(process.env.PORT, 10);
  }

  const baseUrl = `http://${options.hostname || 'localhost'}:${port}`;

  const customServerBuild = await runExecutor(
    parseTargetString(options.customServerTarget, context),
    {
      watch: options.dev ? true : false,
    },
    context
  );

  for await (const result of customServerBuild) {
    if (!result.success) {
      return result;
    }
    yield {
      success: true,
      baseUrl,
    };
  }

  return { success: true };
}
