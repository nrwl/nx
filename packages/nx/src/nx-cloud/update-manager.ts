import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { createGunzip } from 'zlib';
import { join } from 'path';
import { createApiAxiosInstance } from './utilities/axios';
import { debugLog } from './debug-logger';
import type { CloudTaskRunnerOptions } from './nx-cloud-tasks-runner-shell';
import * as tar from 'tar-stream';
import { cacheDir } from '../utils/cache-directory';
import { createHash } from 'crypto';
import { TasksRunner } from '../tasks-runner/tasks-runner';
import { RemoteCacheV2 } from '../tasks-runner/default-tasks-runner';

interface CloudBundleInstall {
  version: string;
  fullPath: string;
}

type ValidVerifyClientBundleResponse = {
  valid: true;
  url: null;
  version: null;
};

type InvalidVerifyClientBundleResponse = {
  valid: false;
  url: string;
  version: string;
};

type VerifyClientBundleResponse =
  | ValidVerifyClientBundleResponse
  | InvalidVerifyClientBundleResponse;

export class NxCloudEnterpriseOutdatedError extends Error {
  constructor(url: string) {
    super(`Nx Cloud instance hosted at ${url} is outdated`);
  }
}
export class NxCloudClientUnavailableError extends Error {
  constructor() {
    super('No existing Nx Cloud client and failed to download new version');
  }
}

export interface NxCloudClient {
  configureLightClientRequire: () => (paths: string[]) => void;
  commands: Record<string, () => Promise<void>>;
  nxCloudTasksRunner: TasksRunner<CloudTaskRunnerOptions>;
  getRemoteCache: () => RemoteCacheV2;
}
export async function verifyOrUpdateNxCloudClient(
  options: CloudTaskRunnerOptions
): Promise<{ nxCloudClient: NxCloudClient; version: string } | null> {
  debugLog('Verifying current cloud bundle');
  const currentBundle = getLatestInstalledRunnerBundle();

  if (shouldVerifyInstalledRunnerBundle(currentBundle)) {
    const axios = createApiAxiosInstance(options);

    let verifyBundleResponse: AxiosResponse<VerifyClientBundleResponse>;
    try {
      verifyBundleResponse = await verifyCurrentBundle(axios, currentBundle);
    } catch (e: any) {
      // Enterprise image compatibility, to be removed
      if (e.message === 'Request failed with status code 404' && options.url) {
        throw new NxCloudEnterpriseOutdatedError(options.url);
      }

      debugLog(
        'Could not verify bundle. Resetting validation timer and using previously installed or default runner. Error: ',
        e
      );
      writeBundleVerificationLock();

      if (currentBundle === null) {
        throw new NxCloudClientUnavailableError();
      }

      if (currentBundle.version === 'NX_ENTERPRISE_OUTDATED_IMAGE') {
        throw new NxCloudEnterpriseOutdatedError(options.url);
      }

      const nxCloudClient = require(currentBundle.fullPath);
      if (nxCloudClient.commands === undefined) {
        throw new NxCloudEnterpriseOutdatedError(options.url);
      }

      return {
        version: currentBundle.version,
        nxCloudClient,
      };
    }

    if (verifyBundleResponse.data.valid) {
      debugLog('Currently installed bundle is valid');
      writeBundleVerificationLock();
      return {
        version: currentBundle.version,
        nxCloudClient: require(currentBundle.fullPath),
      };
    }

    const { version, url } = verifyBundleResponse.data;
    debugLog(
      'Currently installed bundle is invalid, downloading version',
      version,
      ' from ',
      url
    );

    if (version === 'NX_ENTERPRISE_OUTDATED_IMAGE') {
      throw new NxCloudEnterpriseOutdatedError(options.url);
    }

    const fullPath = await downloadAndExtractClientBundle(
      axios,
      runnerBundleInstallDirectory,
      version,
      url
    );

    debugLog('Done: ', fullPath);

    const nxCloudClient = require(fullPath);

    if (nxCloudClient.commands === undefined) {
      throw new NxCloudEnterpriseOutdatedError(options.url);
    }
    return { version, nxCloudClient };
  }

  if (currentBundle === null) {
    throw new NxCloudClientUnavailableError();
  }

  debugLog('Done: ', currentBundle.fullPath);

  return {
    version: currentBundle.version,
    nxCloudClient: require(currentBundle.fullPath),
  };
}
const runnerBundleInstallDirectory = join(cacheDir, 'cloud');

function getLatestInstalledRunnerBundle(): CloudBundleInstall | null {
  if (!existsSync(runnerBundleInstallDirectory)) {
    mkdirSync(runnerBundleInstallDirectory, { recursive: true });
  }

  try {
    const installedBundles: CloudBundleInstall[] = readdirSync(
      runnerBundleInstallDirectory
    )
      .filter((potentialDirectory) => {
        return statSync(
          join(runnerBundleInstallDirectory, potentialDirectory)
        ).isDirectory();
      })
      .map((fileOrDirectory) => ({
        version: fileOrDirectory,
        fullPath: join(runnerBundleInstallDirectory, fileOrDirectory),
      }));

    if (installedBundles.length === 0) {
      // No installed bundles
      return null;
    }

    return installedBundles[0];
  } catch (e: any) {
    console.log('Could not read runner bundle path:', e.message);
    return null;
  }
}

function shouldVerifyInstalledRunnerBundle(
  currentBundle: CloudBundleInstall | null
): boolean {
  if (process.env.NX_CLOUD_FORCE_REVALIDATE === 'true') {
    return true;
  }

  // No bundle, need to download anyway
  if (currentBundle != null) {
    debugLog('A local bundle currently exists: ', currentBundle);
    const lastVerification = getLatestBundleVerificationTimestamp();
    // Never been verified, need to verify
    if (lastVerification != null) {
      // If last verification was less than 30 minutes ago, return the current installed bundle
      const THIRTY_MINUTES = 30 * 60 * 1000;
      if (Date.now() - lastVerification < THIRTY_MINUTES) {
        debugLog(
          'Last verification was within the past 30 minutes, will not verify this time'
        );
        return false;
      }
      debugLog(
        'Last verification was more than 30 minutes ago, verifying bundle is still valid'
      );
    }
  }
  return true;
}

async function verifyCurrentBundle(
  axios: AxiosInstance,
  currentBundle: CloudBundleInstall | null
): Promise<AxiosResponse<VerifyClientBundleResponse>> {
  return axios.get('/nx-cloud/client/verify', {
    params: currentBundle
      ? {
          version: currentBundle.version,
          contentHash: getBundleContentHash(currentBundle),
        }
      : {},
  });
}

function getLatestBundleVerificationTimestamp(): number | null {
  const lockfilePath = join(runnerBundleInstallDirectory, 'verify.lock');

  if (existsSync(lockfilePath)) {
    const timestampAsString = readFileSync(lockfilePath, 'utf-8');

    let timestampAsNumber: number;
    try {
      timestampAsNumber = Number(timestampAsString);
      return timestampAsNumber;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function writeBundleVerificationLock() {
  const lockfilePath = join(runnerBundleInstallDirectory, 'verify.lock');

  writeFileSync(lockfilePath, new Date().getTime().toString(), 'utf-8');
}

function getBundleContentHash(
  bundle: CloudBundleInstall | null
): string | null {
  if (bundle == null) {
    return null;
  }

  return hashDirectory(bundle.fullPath);
}

function hashDirectory(dir: string): string {
  const files = readdirSync(dir).sort();
  const hashes = files.map((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    // If the current path is a directory, recursively hash the contents
    if (stat.isDirectory()) {
      return hashDirectory(filePath);
    }

    // If it's a file, hash the file contents
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  });

  // Hash the combined hashes of the directory's contents
  const combinedHashes = hashes.sort().join('');
  return createHash('sha256').update(combinedHashes).digest('hex');
}

async function downloadAndExtractClientBundle(
  axios: AxiosInstance,
  runnerBundleInstallDirectory: string,
  version: string,
  url: string
): Promise<string> {
  let resp;
  try {
    resp = await axios.get(url, {
      responseType: 'stream',
    } as AxiosRequestConfig);
  } catch (e: any) {
    console.error('Error while updating Nx Cloud client bundle');
    throw e;
  }

  const bundleExtractLocation = join(runnerBundleInstallDirectory, version);

  if (!existsSync(bundleExtractLocation)) {
    mkdirSync(bundleExtractLocation);
  }
  return new Promise((res, rej) => {
    const extract = tar.extract();
    extract.on('entry', function (headers, stream, next) {
      if (headers.type === 'directory') {
        const directoryPath = join(bundleExtractLocation, headers.name);
        if (!existsSync(directoryPath)) {
          mkdirSync(directoryPath, { recursive: true });
        }
        next();

        stream.resume();
      } else if (headers.type === 'file') {
        const outputFilePath = join(bundleExtractLocation, headers.name);
        const writeStream = createWriteStream(outputFilePath);
        stream.pipe(writeStream);

        // Continue the tar stream after the write stream closes
        writeStream.on('close', () => {
          next();
        });

        stream.resume();
      }
    });

    extract.on('error', (e) => {
      rej(e);
    });

    extract.on('finish', function () {
      removeOldClientBundles(version);
      writeBundleVerificationLock();
      res(bundleExtractLocation);
    });

    resp.data.pipe(createGunzip()).pipe(extract);
  });
}

function removeOldClientBundles(currentInstallVersion: string) {
  const filesAndFolders = readdirSync(runnerBundleInstallDirectory);

  for (let fileOrFolder of filesAndFolders) {
    const fileOrFolderPath = join(runnerBundleInstallDirectory, fileOrFolder);

    if (fileOrFolder !== currentInstallVersion) {
      rmSync(fileOrFolderPath, { recursive: true });
    }
  }
}
