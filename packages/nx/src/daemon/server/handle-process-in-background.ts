import { HandlerResult } from './server';
import { workspaceRoot } from '../../utils/workspace-root';
import { serverLogger } from './logger';

export async function handleProcessInBackground(payload: {
  type: string;
  requirePath: string;
  data: any;
}): Promise<HandlerResult> {
  let fn;
  try {
    fn = require(require.resolve(payload.requirePath, {
      paths: [workspaceRoot],
    })).default;
  } catch (e) {
    return {
      description: `Unable to require ${payload.requirePath}`,
      error: new Error(`Unable to require ${payload.requirePath}`),
    };
  }

  try {
    const response = await fn(payload.data, serverLogger);
    return {
      response,
      description: payload.type,
    };
  } catch (e) {
    return {
      description: `Error when processing ${payload.type}.`,
      error: e,
    };
  }
}
