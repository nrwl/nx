import { HandlerResult } from './server';
import { outputsHashesMatch, recordOutputsHash } from './outputs-tracking';

export async function handleRecordOutputsHash(payload: {
  type: string;
  data: { outputs: string[]; hash: string };
}): Promise<HandlerResult> {
  try {
    await recordOutputsHash(payload.data.outputs, payload.data.hash);
    return {
      description: 'recordOutputsHash',
      response: '{}',
    };
  } catch (e) {
    return {
      description: 'recordOutputsHash failed',
      error: new Error(
        `Critical error when recording metadata about outputs: '${e.message}'.`
      ),
    };
  }
}

export async function handleOutputsHashesMatch(payload: {
  type: string;
  data: { outputs: string[]; hash: string };
}): Promise<HandlerResult> {
  try {
    const res = await outputsHashesMatch(
      payload.data.outputs,
      payload.data.hash
    );
    return {
      response: JSON.stringify(res),
      description: 'outputsHashesMatch',
    };
  } catch (e) {
    return {
      description: 'outputsHashesMatch failed',
      error: new Error(
        `Critical error when verifying the contents of the outputs haven't changed: '${e.message}'.`
      ),
    };
  }
}
