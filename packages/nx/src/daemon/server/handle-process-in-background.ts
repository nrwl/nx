import { HandlerResult } from './server.js';
import { serverLogger } from './logger.js';
import { getNxRequirePaths } from '../../utils/installation-directory.js';

export async function handleProcessInBackground(payload: {
  type: string;
  requirePath: string;
  data: any;
}): Promise<HandlerResult> {
  let fn;
  try {
    fn = require(require.resolve(payload.requirePath, {
      paths: getNxRequirePaths(),
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
