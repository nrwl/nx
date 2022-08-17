import { respondWithErrorAndExit } from './shutdown-utils';

export async function handleProcessInBackground(
  socket,
  payload: { type: string; requirePath: string; data: any }
) {
  let fn;
  try {
    fn = require(payload.requirePath);
  } catch (e) {
    await respondWithErrorAndExit(
      socket,
      `Unable to require ${payload.requirePath}`,
      new Error(`Unable to require ${payload.requirePath}`)
    );
  }

  try {
    await fn(socket, payload.data);
  } catch (e) {
    await respondWithErrorAndExit(
      socket,
      `Error when processing ${payload.type}.`,
      new Error(`Error when processing ${payload.type}. Message: ${e.message}`)
    );
  }
}
