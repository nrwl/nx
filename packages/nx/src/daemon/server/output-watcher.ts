import { lstat } from 'fs-extra';
import { dirname, join } from 'path';
import * as fastGlob from 'fast-glob';
import { workspaceRoot } from '../../utils/workspace-root';
import { serverLogger } from './logger';
import { collapseExpandedOutputs } from '../../utils/collapse-expanded-outputs';

const watcher = require('@parcel/watcher');

/**
 * We cannot start a file watcher right away because the IO write that has just
 * completed hasn't triggered the event yet.
 *
 * If we start the file watcher without the delay, we will see an invalidation
 * of the write that is the write itself.
 */
const FILE_WATCHING_DELAY = 1000;

const errors = {} as { [output: string]: Error };
const subscriptions = {} as { [output: string]: { unsubscribe: Function } };
const recordedHashes = {} as { [output: string]: string };
const numberOfExpandedOutputs = {} as { [hash: string]: number };

export async function recordOutputsHash(_outputs: string[], hash: string) {
  const outputs = await normalizeOutputs(_outputs);
  numberOfExpandedOutputs[hash] = outputs.length;

  await removeSubscriptionsForOutputs(outputs);

  // skip any recording. errors disable the optimization with the file restoration.
  if (anyErrorsAssociatedWithOutputs(outputs)) {
    return;
  }

  for (const output of outputs) {
    recordedHashes[output] = hash;
  }
  await createSubscriptionsForOutputs(outputs);
}

export async function outputsHashesMatch(_outputs: string[], hash: string) {
  const outputs = await normalizeOutputs(_outputs);
  if (outputs.length !== numberOfExpandedOutputs[hash]) return false;
  for (const output of outputs) {
    if (recordedHashes[output] !== hash) return false;
  }
  return true;
}

function anyErrorsAssociatedWithOutputs(outputs: string[]) {
  for (const output of outputs) {
    if (errors[output]) return true;
  }
  return false;
}

/**
 * A subscription that starts in FILE_WATCHING_DELAY but is
 * cancelable before that as well.
 */
function delayedSubscription(output: string) {
  let subscription;
  const handle = setTimeout(async () => {
    subscription = watcher.subscribe(output, (err) => {
      if (err) {
        serverLogger.watcherLog(`File watcher '${output}' threw an error.`);
        console.error(err);
        errors[output] = err;
        if (subscriptions[output]) {
          subscriptions[output].unsubscribe();
        }
      }
      recordedHashes[output] = undefined;
    });
  }, FILE_WATCHING_DELAY);

  return {
    unsubscribe: async () => {
      if (subscription) {
        await (await subscription).unsubscribe();
      } else {
        clearTimeout(handle);
      }
    },
  };
}

// reduce files to folders and expand globs
async function normalizeOutputs(outputs: string[]) {
  return (
    await Promise.all(outputs.map((o) => normalizeOutput(o, true)))
  ).flat();
}

async function normalizeOutput(
  output: string,
  expand: boolean
): Promise<string[]> {
  try {
    const res = await lstat(join(workspaceRoot, output));
    if (res.isFile()) {
      return [dirname(output)];
    } else if (res.isDirectory()) {
      return [output];
    } else {
      return [];
    }
  } catch (e) {
    if (expand) {
      const expanded = collapseExpandedOutputs(
        await fastGlob(output, { cwd: workspaceRoot, dot: true })
      );
      return (
        await Promise.all(expanded.map((e) => normalizeOutput(e, false)))
      ).flat();
    } else {
      return [];
    }
  }
}

async function createSubscriptionsForOutputs(normalizedOutputs: string[]) {
  for (const output of normalizedOutputs) {
    subscriptions[output] = delayedSubscription(output);
  }
}

async function removeSubscriptionsForOutputs(outputs: string[]) {
  const unsubscribes = [];
  for (const output of outputs) {
    if (subscriptions[output]) {
      unsubscribes.push(subscriptions[output].unsubscribe());
    }
    delete subscriptions[output];
  }
  await Promise.all(unsubscribes);
}
