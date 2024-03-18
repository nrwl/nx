import { updateJson } from '../../generators/utils/json';
import { Tree } from '../../generators/tree';
import { NxJsonConfiguration } from '../../config/nx-json';
import { PackageJson } from '../../utils/package-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readNxJson } from '../../generators/utils/nx-json';
import {
  NxCloudEnterpriseOutdatedError,
  verifyOrUpdateNxCloudClient,
} from '../../nx-cloud/update-manager';
import { getRunnerOptions } from '../../tasks-runner/run-command';
import { output } from '../../utils/output';

export default async function migrate(tree: Tree) {
  if (!tree.exists('nx.json')) {
    return;
  }

  const nxJson = readNxJson(tree);

  // Already migrated
  if (!nxJson.tasksRunnerOptions?.default) {
    return;
  }

  const nxCloudClientSupported = await isNxCloudClientSupported(nxJson);
  updateJson<NxJsonConfiguration>(tree, 'nx.json', (nxJson) => {
    const { runner, options } = nxJson.tasksRunnerOptions.default;

    // This property shouldn't ever be part of tasks runner options.
    if (options.useDaemonProcess !== undefined) {
      nxJson.useDaemonProcess = options.useDaemonProcess;
      delete options.useDaemonProcess;
    }

    // Remaining keys may be specific to a given runner, so leave them alone if there are multiple runners.
    if (Object.keys(nxJson.tasksRunnerOptions ?? {}).length > 1) {
      return nxJson;
    }

    // These options can only be moved for nx-cloud.
    if (runner === 'nx-cloud' || runner === '@nrwl/nx-cloud') {
      nxJson.nxCloudAccessToken = options.accessToken;
      delete options.accessToken;

      if (options.url) {
        nxJson.nxCloudUrl = options.url;
        delete options.url;
      }

      if (nxCloudClientSupported) {
        removeNxCloudDependency(tree);
      } else {
        options.useLightClient = false;
      }
      if (options.encryptionKey) {
        nxJson.nxCloudEncryptionKey = options.encryptionKey;
        delete options.encryptionKey;
      }
    }

    // These options should be safe to move for all tasks runners:
    if (options.parallel !== undefined) {
      nxJson.parallel = options.parallel;
      delete options.parallel;
    }
    if (options.cacheDirectory !== undefined) {
      nxJson.cacheDirectory = options.cacheDirectory;
      delete options.cacheDirectory;
    }
    if (Array.isArray(options.cacheableOperations)) {
      nxJson.targetDefaults ??= {};
      for (const target of options.cacheableOperations) {
        nxJson.targetDefaults[target] ??= {};
        nxJson.targetDefaults[target].cache ??= true;
      }
      delete options.cacheableOperations;
    }
    if (
      ['nx-cloud', '@nrwl/nx-cloud', 'nx/tasks-runners/default'].includes(
        runner
      )
    ) {
      delete nxJson.tasksRunnerOptions.default.runner;
      if (Object.values(options).length === 0) {
        delete nxJson.tasksRunnerOptions;
      }
    }
    return nxJson;
  });

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

async function isNxCloudClientSupported(nxJson: NxJsonConfiguration) {
  const nxCloudOptions = getRunnerOptions('default', nxJson, {}, true);

  // Non enterprise workspaces support the Nx Cloud Client
  if (!isNxCloudEnterpriseWorkspace(nxJson)) {
    return true;
  }

  // If we can get the nx cloud client, it's supported
  try {
    await verifyOrUpdateNxCloudClient(nxCloudOptions);
    return true;
  } catch (e) {
    if (e instanceof NxCloudEnterpriseOutdatedError) {
      output.warn({
        title: 'Nx Cloud Instance is outdated.',
        bodyLines: [
          'If you are an Nx Enterprise customer, please reach out to your assigned Developer Productivity Engineer.',
          'If you are NOT an Nx Enterprise customer but are seeing this message, please reach out to cloud-support@nrwl.io.',
        ],
      });
    }
    return false;
  }
}

function isNxCloudEnterpriseWorkspace(nxJson: NxJsonConfiguration) {
  const { runner, options } = nxJson.tasksRunnerOptions.default;
  return (
    (runner === 'nx-cloud' || runner === '@nrwl/nx-cloud') &&
    options.url &&
    ![
      'https://nx.app',
      'https://cloud.nx.app',
      'https://staging.nx.app',
      'https://snapshot.nx.app',
    ].includes(options.url)
  );
}

function removeNxCloudDependency(tree: Tree) {
  if (tree.exists('package.json')) {
    updateJson<PackageJson>(tree, 'package.json', (packageJson) => {
      delete packageJson.dependencies?.['nx-cloud'];
      delete packageJson.devDependencies?.['nx-cloud'];
      delete packageJson.dependencies?.['@nrwl/nx-cloud'];
      delete packageJson.devDependencies?.['@nrwl/nx-cloud'];
      return packageJson;
    });
  }
}
