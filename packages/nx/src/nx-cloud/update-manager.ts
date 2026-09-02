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
import { createHash, randomUUID } from 'crypto';
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

    const installedBundle = await downloadAndExtractClientBundle(
      axios,
      version,
      url
    );

    debugLog('Done: ', installedBundle.fullPath);

    const nxCloudClient = require(installedBundle.fullPath);

    if (nxCloudClient.commands === undefined) {
      throw new NxCloudEnterpriseOutdatedError(apiUrl);
    }
    return { version: installedBundle.version, nxCloudClient };
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

// Control files live in their own subdirectory so that no bundle can ever
// collide with one. A version has to start alphanumeric (see
// VALID_BUNDLE_VERSION), so it can never name '.state', and installing a
// bundle rewrites <installDir>/<version> with rmSync + renameSync - which,
// with the control files alongside it, would replace one with a directory and
// brick the workspace with no in-band recovery.
const stateDirectory = join(runnerBundleInstallDirectory, '.state');

function ensureStateDirectory(): void {
  mkdirSync(stateDirectory, { recursive: true });
}

const downloadLockFilePath = join(stateDirectory, 'download.lock');

// The record lives beside the lockfile rather than inside it. Windows
// byte-range locks are mandatory and handle-scoped, so writing to a file this
// process holds an exclusive lock on fails with ERROR_LOCK_VIOLATION. It also
// matches the convention elsewhere in nx: project-graph.lock and run.json.lock
// are never written to.
const downloadRecordFilePath = join(stateDirectory, 'download.record');

// A version names a directory that is created and later deleted, so a value
// from the server must not be able to escape the install directory.
const VALID_BUNDLE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

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

    // A contended install can leave several bundles on disk. The record names
    // the one an install last completed, which is the one to run; fall back to
    // directory order for a bundle installed before records existed.
    return recordedBundle() ?? installedBundles[0];
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
  const lockfilePath = join(stateDirectory, 'verify.lock');

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
  const lockfilePath = join(stateDirectory, 'verify.lock');

  ensureStateDirectory();
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

export async function downloadAndExtractClientBundle(
  axios: AxiosInstance,
  version: string,
  url: string
): Promise<CloudBundleInstall> {
  // Parallel nx processes race to install bundles, possibly at different
  // versions. The first to take the lock downloads; the rest wait and adopt
  // its bundle when the server asked them for that same version. Otherwise
  // they download their own as a contended install, which leaves the holder's
  // bundle on disk for the process running from it. The flock is released by
  // the kernel if the holder dies, so no stale-lock cleanup is needed. Under
  // WASM the lock is unavailable and downloads run unserialized.
  if (!VALID_BUNDLE_VERSION.test(version)) {
    throw new Error(`Invalid Nx Cloud client bundle version: ${version}`);
  }

  const recordBeforeContending = readDownloadRecord();
  const lock = !IS_WASM ? new FileLock(downloadLockFilePath) : null;
  let locked = lock?.locked;
  let contended = false;
  while (locked) {
    debugLog(
      'Another process is downloading the client bundle, waiting for it to complete'
    );
    await lock.wait();
    const installedBundle = bundleInstalledSince(recordBeforeContending);
    if (installedBundle) {
      if (installedBundle.version === version) {
        debugLog(
          'Using client bundle downloaded by another process: ',
          installedBundle.version
        );
        return installedBundle;
      }
      // A different version means that process is running from a bundle this
      // one must not delete.
      contended = true;
      debugLog(
        'Another process installed a different bundle: ',
        installedBundle.version
      );
    }
    // The other process failed or installed an older version, so this process
    // still needs to download.
    locked = lock.check();
  }
  lock?.lock();
  try {
    // A process that acquired the lock between the check above and lock() may
    // have completed an install already.
    const installedBundle = bundleInstalledSince(recordBeforeContending);
    if (installedBundle) {
      if (installedBundle.version === version) {
        debugLog(
          'Using client bundle downloaded by another process: ',
          installedBundle.version
        );
        return installedBundle;
      }
      // A different version means that process is running from a bundle this
      // one must not delete.
      contended = true;
      debugLog(
        'Another process installed a different bundle: ',
        installedBundle.version
      );
    }

    const fullPath = await downloadAndExtractBundle(
      axios,
      version,
      url,
      contended
    );
    return { version, fullPath };
  } finally {
    lock?.unlock();
  }
}

// Records "<version> <nonce>", written only once an install has COMPLETED.
// The nonce makes every install distinct, so a waiter can tell "an install
// finished while I waited" from "this record is left over from a past run" by
// comparing the record it read before contending. Timestamps cannot answer
// that: filesystem mtime granularity is coarser than the race window.
function readDownloadRecord(): string {
  try {
    return readFileSync(downloadRecordFilePath, 'utf-8').trim();
  } catch {
    return '';
  }
}

function writeDownloadRecord(version: string): void {
  ensureStateDirectory();
  writeFileSync(downloadRecordFilePath, `${version} ${randomUUID()}`, 'utf-8');
}

/** The bundle the record names, if it is still on disk. */
function recordedBundle(): CloudBundleInstall | null {
  const version = readDownloadRecord().split(' ')[0];
  if (!version || !VALID_BUNDLE_VERSION.test(version)) {
    return null;
  }
  const fullPath = join(runnerBundleInstallDirectory, version);
  return existsSync(fullPath) ? { version, fullPath } : null;
}

/**
 * The bundle an install completed during this call, or null. Requires the
 * record to have changed since `recordBefore` was read: a directory existing
 * proves only that some earlier run left one there, and an install
 * interrupted on a released nx leaves exactly that.
 */
function bundleInstalledSince(recordBefore: string): CloudBundleInstall | null {
  return readDownloadRecord() === recordBefore ? null : recordedBundle();
}

async function downloadAndExtractBundle(
  axios: AxiosInstance,
  version: string,
  url: string,
  contended: boolean
): Promise<string> {
  const bundleExtractLocation = join(runnerBundleInstallDirectory, version);

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
          writeStream.on('error', rej);

          stream.resume();
        } else {
          // Any other entry type still has to advance the stream. Calling
          // neither next() nor resume() stalls tar-stream, and this process is
          // holding the download lock while it stalls.
          stream.resume();
          next();
        }
      });

      extract.on('error', (e) => {
        rej(e);
      });

      extract.on('finish', function () {
        res();
      });

      // A failure on the response or gunzip stream is not forwarded to
      // `extract`, so without these the promise never settles: the download
      // lock stays held and every other nx process waits on it forever.
      const gunzip = createGunzip();
      resp.data.on('error', rej);
      gunzip.on('error', rej);
      resp.data.pipe(gunzip).pipe(extract);
    });

    rmSync(bundleExtractLocation, { recursive: true, force: true });
    renameSync(tempExtractLocation, bundleExtractLocation);
    // Recorded only now: the record is the signal that a bundle at this
    // version was installed by this process, which is what lets a waiter
    // adopt it instead of downloading again.
    writeDownloadRecord(version);
  } catch (e) {
    rmSync(tempExtractLocation, { recursive: true, force: true });
    throw e;
  }

  // On a contended install another process just installed — and is running
  // from — an older bundle; leave it on disk and let a later uncontended
  // install clean it up.
  if (!contended) {
    removeOldClientBundles(version);
  }
  writeBundleVerificationLock();
  return bundleExtractLocation;
}

function removeOldClientBundles(currentInstallVersion: string) {
  const filesAndFolders = readdirSync(runnerBundleInstallDirectory);

  for (let fileOrFolder of filesAndFolders) {
    // '.state' holds the control files. A '.tmp-*' left by a crashed extract
    // is still reclaimed here: this runs after our own was renamed away, and
    // the lock means no other process is extracting.
    if (fileOrFolder === currentInstallVersion || fileOrFolder === '.state') {
      continue;
    }
    const fileOrFolderPath = join(runnerBundleInstallDirectory, fileOrFolder);

    // Another process's cleanup can remove an entry between the readdir above
    // and these calls, so both tolerate it already being gone.
    let isBundle: boolean;
    try {
      // Only directories are bundles. The lock files must survive: a lock on
      // a deleted file no longer excludes processes that reopen the path.
      isBundle = statSync(fileOrFolderPath).isDirectory();
    } catch {
      continue;
    }
    if (isBundle) {
      rmSync(fileOrFolderPath, { recursive: true, force: true });
    }
  }
}
