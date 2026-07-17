import { HandlerResult } from './server';
import {
  outputsHashesMatchBatch,
  recordOutputsHashBatch,
} from './outputs-tracking';

export async function handleRecordOutputsHashBatch(payload: {
  type: string;
  data: { outputs: string[]; hash: string }[];
}): Promise<HandlerResult> {
  try {
    recordOutputsHashBatch(payload.data);
    return {
      description: 'recordOutputsHashBatch',
      response: '{}',
    };
  } catch (e) {
    return {
      description: 'recordOutputsHashBatch failed',
      error: new Error(
        `Critical error when recording metadata about outputs: '${e.message}'.`
      ),
    };
  }
}

export async function handleOutputsHashesMatchBatch(payload: {
  type: string;
  data: { outputs: string[]; hash: string }[];
}): Promise<HandlerResult> {
  try {
    const results = outputsHashesMatchBatch(payload.data);
    return {
      response: results,
      description: 'outputsHashesMatchBatch',
    };
  } catch (e) {
    return {
      description: 'outputsHashesMatchBatch failed',
      error: new Error(
        `Critical error when verifying the contents of the outputs haven't changed: '${e.message}'.`
      ),
    };
  }
}
