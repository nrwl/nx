import { HandlerResult } from './server';
import { outputsHashesMatch, recordOutputsHash } from './outputs-tracking';
import { HandleRecordOutputsHashMessage } from '../message-types/record-outputs-hash';
import { HandleOutputHashesMatchMessage } from '../message-types/output-hashes-match';

export async function handleRecordOutputsHash(
  payload: HandleRecordOutputsHashMessage
): Promise<HandlerResult> {
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

export async function handleOutputsHashesMatch(
  payload: HandleOutputHashesMatchMessage
): Promise<HandlerResult> {
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
