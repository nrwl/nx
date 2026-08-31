import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { createGunzip } from 'zlib';
import { join } from 'path';
import { tmpdir } from 'os';
import { createApiAxiosInstance } from './utilities/axios';
import { debugLog } from './debug-logger';
import type { CloudTaskRunnerOptions } from './nx-cloud-tasks-runner-shell';
import * as tar from 'tar-stream';
import { cacheDir } from '../utils/cache-directory';
import { createHash } from 'crypto';
import { FileLock, IS_WASM } from '../native';
import { TasksRunner } from '../tasks-runner/tasks-runner';
import { RemoteCacheV2 } from '../tasks-runner/default-tasks-runner';
import { workspaceRoot } from '../utils/workspace-root';

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
export async function verifyOrUpdateNxCloudClient(options?: {
  url?: string;
  customProxyConfigPath?: string;
}): Promise<{ nxCloudClient: NxCloudClient; version: string } | null> {
  debugLog('Verifying current cloud bundle');
  const currentBundle = getLatestInstalledRunnerBundle();
  const apiUrl =
    process.env.NX_CLOUD_API || options?.url || 'https://cloud.nx.app';

  if (shouldVerifyInstalledRunnerBundle(currentBundle)) {
    const axios = createApiAxiosInstance(options);

    let verifyBundleResponse: AxiosResponse<VerifyClientBundleResponse>;
    try {
      verifyBundleResponse = await verifyCurrentBundle(axios, currentBundle);
    } catch (e: any) {
      // Enterprise image compatibility, to be removed
      if (e.message === 'Request failed with status code 404' && apiUrl) {
        throw new NxCloudEnterpriseOutdatedError(apiUrl);
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
        throw new NxCloudEnterpriseOutdatedError(apiUrl);
      }

      markBundleInUse(currentBundle.version);
      const nxCloudClient = require(currentBundle.fullPath);
      if (nxCloudClient.commands === undefined) {
        throw new NxCloudEnterpriseOutdatedError(apiUrl);
      }

      return {
        version: currentBundle.version,
        nxCloudClient,
      };
    }

    if (verifyBundleResponse.data.valid) {
      debugLog('Currently installed bundle is valid');
      writeBundleVerificationLock();
      markBundleInUse(currentBundle.version);
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
      throw new NxCloudEnterpriseOutdatedError(apiUrl);
    }

    const fullPath = await downloadAndExtractClientBundle(
      axios,
      runnerBundleInstallDirectory,
      version,
      url
    );

    debugLog('Done: ', fullPath);

    markBundleInUse(version);
    const nxCloudClient = require(fullPath);

    if (nxCloudClient.commands === undefined) {
      throw new NxCloudEnterpriseOutdatedError(apiUrl);
    }
    return { version, nxCloudClient };
  }

  if (currentBundle === null) {
    throw new NxCloudClientUnavailableError();
  }

  debugLog('Done: ', currentBundle.fullPath);

  markBundleInUse(currentBundle.version);
  return {
    version: currentBundle.version,
    nxCloudClient: require(currentBundle.fullPath),
  };
}

export function getBundleInstallDefaultLocation() {
  // When not in an Nx workspace (no nx.json), avoid creating a .nx folder
  // in the current directory. Instead, use a temp directory unique to the
  // NX_CLOUD_API URL so different cloud instances don't conflict.
  if (!existsSync(join(workspaceRoot, 'nx.json'))) {
    const apiUrl = process.env.NX_CLOUD_API || 'https://cloud.nx.app';
    const apiHash = createHash('sha256')
      .update(apiUrl)
      .digest('hex')
      .slice(0, 16);
    return join(tmpdir(), 'nx-cloud-client', apiHash);
  }

  const legacyPath = join(
    workspaceRoot,
    'node_modules',
    '.cache',
    'nx',
    'cloud'
  );

  // this legacy path is used when the nx-cloud package is installed.
  // make sure to reuse it so that we don't `require` different the client bundles
  if (existsSync(legacyPath)) {
    return legacyPath;
  } else {
    return join(cacheDir, 'cloud');
  }
}

const runnerBundleInstallDirectory = getBundleInstallDefaultLocation();

// Held (never unlocked) for the lifetime of the process so that cleanup in
// other processes can tell the bundle is still in use — the light client keeps
// requiring files from its directory long after this module returns. The
// kernel releases the locks when the process exits. Module-level so the
// FileLock objects are never garbage collected, which would drop the flock.
const inUseMarkers = new Map<string, InstanceType<typeof FileLock>>();

function markBundleInUse(version: string): void {
  if (IS_WASM || inUseMarkers.has(version)) {
    return;
  }
  const markerPath = join(
    runnerBundleInstallDirectory,
    `.in-use-${version}-${process.pid}.lock`
  );
  // Cleanup in another process can unlink an unlocked marker between the
  // FileLock constructor and lock(), leaving this lock on a deleted inode
  // that no other process can see; retry until the locked file is on disk.
  while (true) {
    const marker = new FileLock(markerPath);
    marker.lock();
    if (existsSync(markerPath)) {
      inUseMarkers.set(version, marker);
      return;
    }
    marker.unlock();
  }
}

function isBundleInUse(version: string): boolean {
  if (IS_WASM) {
    return false;
  }
  const markerPrefix = `.in-use-${version}-`;
  for (const fileName of readdirSync(runnerBundleInstallDirectory)) {
    if (!fileName.startsWith(markerPrefix)) {
      continue;
    }
    const markerPath = join(runnerBundleInstallDirectory, fileName);
    if (new FileLock(markerPath).locked) {
      return true;
    }
    // Unlocked marker means its process died; remove it so it doesn't
    // accumulate.
    rmSync(markerPath, { force: true });
  }
  return false;
}

function getLatestInstalledRunnerBundle(): CloudBundleInstall | null {
  if (!existsSync(runnerBundleInstallDirectory)) {
    mkdirSync(runnerBundleInstallDirectory, { recursive: true });
  }

  try {
    const installedBundles: CloudBundleInstall[] = readdirSync(
      runnerBundleInstallDirectory
    )
      .filter((potentialDirectory) => {
        // '.tmp-*' directories are in-progress or crashed downloads
        return (
          !potentialDirectory.startsWith('.') &&
          statSync(
            join(runnerBundleInstallDirectory, potentialDirectory)
          ).isDirectory()
        );
      })
      .map((fileOrDirectory) => ({
        version: fileOrDirectory,
        fullPath: join(runnerBundleInstallDirectory, fileOrDirectory),
      }));

    if (installedBundles.length === 0) {
      // No installed bundles
      return null;
    }

    // Multiple bundles can coexist while an older one is still in use by a
    // running process; the most recently installed one is the one to run.
    installedBundles.sort(
      (a, b) => statSync(b.fullPath).mtimeMs - statSync(a.fullPath).mtimeMs
    );
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
  const bundleExtractLocation = join(runnerBundleInstallDirectory, version);

  // Parallel nx processes race to install bundles: the first process to take
  // the lock downloads, the rest wait for the bundle to appear. The flock is
  // released by the kernel if the holder dies, so no stale-lock cleanup is
  // needed. Under WASM the lock is unavailable and downloads run unserialized.
  const lock = !IS_WASM
    ? new FileLock(join(runnerBundleInstallDirectory, 'download.lock'))
    : null;
  let locked = lock?.locked;
  while (locked) {
    debugLog(
      'Another process is downloading the client bundle, waiting for it to complete'
    );
    await lock.wait();
    if (existsSync(bundleExtractLocation)) {
      debugLog('Using client bundle downloaded by another process');
      return bundleExtractLocation;
    }
    // The other process installed a different version or failed, so this
    // process still needs to download.
    locked = lock.check();
  }
  lock?.lock();
  try {
    return await downloadAndExtractBundle(
      axios,
      runnerBundleInstallDirectory,
      version,
      url,
      bundleExtractLocation
    );
  } finally {
    lock?.unlock();
  }
}

async function downloadAndExtractBundle(
  axios: AxiosInstance,
  runnerBundleInstallDirectory: string,
  version: string,
  url: string,
  bundleExtractLocation: string
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

  // Extract into a temp directory and rename into place afterwards, so a
  // failed or interrupted download never leaves a partial bundle at the
  // path other processes require it from.
  const tempExtractLocation = join(
    runnerBundleInstallDirectory,
    `.tmp-${version}-${process.pid}`
  );
  mkdirSync(tempExtractLocation, { recursive: true });

  try {
    await new Promise<void>((res, rej) => {
      const extract = tar.extract();
      extract.on('entry', function (headers, stream, next) {
        if (headers.type === 'directory') {
          const directoryPath = join(tempExtractLocation, headers.name);
          if (!existsSync(directoryPath)) {
            mkdirSync(directoryPath, { recursive: true });
          }
          next();

          stream.resume();
        } else if (headers.type === 'file') {
          const outputFilePath = join(tempExtractLocation, headers.name);
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
        res();
      });

      resp.data.pipe(createGunzip()).pipe(extract);
    });

    rmSync(bundleExtractLocation, { recursive: true, force: true });
    renameSync(tempExtractLocation, bundleExtractLocation);
  } catch (e) {
    rmSync(tempExtractLocation, { recursive: true, force: true });
    throw e;
  }

  removeOldClientBundles(version);
  writeBundleVerificationLock();
  return bundleExtractLocation;
}

function removeOldClientBundles(currentInstallVersion: string) {
  const filesAndFolders = readdirSync(runnerBundleInstallDirectory);

  for (let fileOrFolder of filesAndFolders) {
    const fileOrFolderPath = join(runnerBundleInstallDirectory, fileOrFolder);

    // Only directories are bundles. The lock files must survive: a lock on a
    // deleted file no longer excludes processes that reopen the path. A
    // bundle another live process is running from must survive too — deleting
    // it breaks that process's lazy requires.
    if (
      fileOrFolder !== currentInstallVersion &&
      statSync(fileOrFolderPath).isDirectory() &&
      !isBundleInUse(fileOrFolder)
    ) {
      rmSync(fileOrFolderPath, { recursive: true });
    }
  }
}
