import { readFileSync } from 'fs';

import * as stripJsonComments from 'strip-json-comments';
import { CloudTaskRunnerOptions } from '../core/models/cloud-task-runner-options';

const { workspaceRoot } = require('./nx-imports-light');

export function getCloudOptions(): {
  nxJson: any;
  nxCloudOptions: CloudTaskRunnerOptions;
} {
  const nxJson = JSON.parse(
    stripJsonComments(readFileSync(`${workspaceRoot}/nx.json`).toString())
  );
  const result: Partial<CloudTaskRunnerOptions> = {};

  const defaultCacheableOperations: string[] = [];
  for (const key in nxJson.targetDefaults) {
    if (nxJson.targetDefaults[key].cache) {
      defaultCacheableOperations.push(key);
    }
  }

  if (nxJson.nxCloudAccessToken) {
    result.accessToken ??= nxJson.nxCloudAccessToken;
  }
  if (nxJson.nxCloudUrl) {
    result.url ??= nxJson.nxCloudUrl;
  }
  if (nxJson.nxCloudEncryptionKey) {
    result.encryptionKey = nxJson.nxCloudEncryptionKey;
  }
  if (nxJson.parallel) {
    result.parallel ??= nxJson.parallel;
  }

  if (nxJson.cacheDirectory) {
    result.cacheDirectory ??= nxJson.cacheDirectory;
  }

  if (defaultCacheableOperations.length) {
    result.cacheableOperations ??= defaultCacheableOperations;
  }

  return {
    nxJson,
    nxCloudOptions: {
      ...result,
      // TODO: The default is not always cloud? But it's not handled at the moment
      ...(nxJson.tasksRunnerOptions?.default
        ?.options as CloudTaskRunnerOptions),
    },
  };
}
