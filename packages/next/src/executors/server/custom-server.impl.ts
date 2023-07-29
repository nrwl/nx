import 'dotenv/config';
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

  // Setting port that the custom server should use.
  (process.env as any).PORT = options.port;

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

  const baseUrl = `http://${options.hostname || 'localhost'}:${options.port}`;

  const customServerBuild = await runExecutor(
    parseTargetString(options.customServerTarget, context.projectGraph),
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
