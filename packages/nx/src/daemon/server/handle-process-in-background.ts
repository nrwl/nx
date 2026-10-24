import { HandlerResult } from './server';
import { serverLogger } from '../logger';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { serializeResult } from '../socket-utils';
import { requireWithNativeJsLoader } from './native-js-loader';

export async function handleProcessInBackground(payload: {
  type: string;
  requirePath: string;
  data: any;
}): Promise<HandlerResult> {
  let fn;
  try {
    fn = requireWithNativeJsLoader(
      require.resolve(payload.requirePath, {
        paths: getNxRequirePaths(),
      })
    ).default;
  } catch (e) {
    const description = `Unable to require ${payload.requirePath}`;
    return { description, error: toTransportableError(e, description) };
  }

  try {
    const response = await fn(payload.data, serverLogger);
    return {
      response,
      description: payload.type,
    };
  } catch (e) {
    const description = `Error when processing ${payload.type}.`;
    return { description, error: toTransportableError(e, description) };
  }
}

function toTransportableError(e: unknown, fallbackMessage: string): Error {
  if (!(e instanceof Error)) {
    return new Error(fallbackMessage);
  }
  try {
    serializeResult(e, null, null);
    return e;
  } catch {
    const copy = new Error(e.message);
    copy.stack = e.stack;
    return copy;
  }
}
