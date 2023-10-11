import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createHash } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import { CloudTaskRunnerOptions } from '../core/models/cloud-task-runner-options';
import { createApiAxiosInstance } from '../utilities/axios';
import { debugLog } from './debug-logger';

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

export async function verifyOrUpdateCloudBundle(
  options: CloudTaskRunnerOptions
): Promise<CloudBundleInstall | null> {
  const runnerBundleInstallDirectory = getRunnerBundleInstallDirectory(options);
  const currentBundle = getLatestInstalledRunnerBundle(
    runnerBundleInstallDirectory
  );

  if (
    shouldVerifyInstalledRunnerBundle(
      runnerBundleInstallDirectory,
      currentBundle
    )
  ) {
    const axios = createApiAxiosInstance(options);

    let verifyBundleResponse: AxiosResponse<VerifyClientBundleResponse>;
    try {
      verifyBundleResponse = await verifyCurrentBundle(axios, currentBundle);
    } catch (e: any) {
      // Enterprise image compatibility, to be removed
      if (e.message === 'Request failed with status code 404' && options.url) {
        console.warn(
          '[WARNING] Nx Cloud was unable to fetch or verify its bundle from the instance hosted at: ',
          options.url
        );
        console.warn(
          '[WARNING] Nx Cloud will continue to function as expected, but your installation should be updated'
        );
        console.warn('[WARNING] soon for the best experience.');
        console.warn('[WARNING] ');
        console.warn(
          '[WARNING] If you are an Nx Enterprise customer, please reach out to your assigned Developer Productivity Engineer.'
        );
        console.warn('[WARNING] ');
        console.warn(
          '[WARNING] If you are NOT an Nx Enterprise customer but are seeing this message, please reach out to cloud-support@nrwl.io.'
        );
        console.warn('[WARNING] ');
        console.warn(
          '[WARNING] To prevent this check on startup, set `useLightClient: false` in your task runner options found in `nx.json`.'
        );

        return {
          version: 'NX_ENTERPRISE_OUTDATED_IMAGE',
          fullPath: '',
        };
      }

      debugLog(
        'Could not verify bundle. Resetting validation timer and using previously installed or default runner. Error: ',
        e
      );
      writeBundleVerificationLock(runnerBundleInstallDirectory);

      return currentBundle;
    }

    if (verifyBundleResponse.data.valid) {
      debugLog('Currently installed bundle is valid');
      writeBundleVerificationLock(runnerBundleInstallDirectory);
      return currentBundle!!;
    }

    const { version, url } = verifyBundleResponse.data;
    debugLog(
      'Currently installed bundle is invalid, downloading version',
      version,
      ' from ',
      url
    );
    return {
      version,
      fullPath: await downloadAndExtractClientBundle(
        axios,
        runnerBundleInstallDirectory,
        version,
        url
      ),
    };
  }

  return currentBundle!!;
}

function findWorkspaceRoot(startPath) {
  let currentPath = isAbsolute(startPath) ? startPath : resolve(startPath);

  while (currentPath !== dirname(currentPath)) {
    const potentialFile = join(currentPath, 'nx.json');
    if (existsSync(potentialFile)) {
      return currentPath;
    }
    currentPath = dirname(currentPath);
  }

  return null;
}

function getRunnerBundleInstallDirectory(
  options: CloudTaskRunnerOptions
): string {
  const cacheDirectory =
    (process.env.NX_CACHE_DIRECTORY || options.cacheDirectory) ??
    join('node_modules', '.cache', 'nx');
  const runnerBundlePath = join(cacheDirectory, 'cloud');

  if (isAbsolute(runnerBundlePath)) {
    return runnerBundlePath;
  } else {
    const workspaceRoot = findWorkspaceRoot(process.cwd());
    return join(workspaceRoot, runnerBundlePath);
  }
}

function getLatestInstalledRunnerBundle(
  runnerBundleInstallDirectory: string
): CloudBundleInstall | null {
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
  runnerBundleInstallDirectory: string,
  currentBundle: CloudBundleInstall | null
): boolean {
  if (process.env.NX_CLOUD_FORCE_REVALIDATE === 'true') {
    return true;
  }

  // No bundle, need to download anyway
  if (currentBundle != null) {
    debugLog('A local bundle currently exists: ', currentBundle);
    const lastVerification = getLatestBundleVerificationTimestamp(
      runnerBundleInstallDirectory
    );
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
  const contentHash = getBundleContentHash(currentBundle);
  const queryParams =
    currentBundle && contentHash
      ? `?${new URLSearchParams({
          version: currentBundle.version,
          contentHash: contentHash,
        }).toString()}`
      : '';
  return axios.get('/nx-cloud/client/verify' + queryParams);
}

function getLatestBundleVerificationTimestamp(
  runnerBundleInstallDirectory: string
): number | null {
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

function writeBundleVerificationLock(runnerBundleInstallDirectory: string) {
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

function hashDirectory(dir) {
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

  const tar = require('tar');
  const extractStream = resp.data.pipe(
    tar.x({
      cwd: bundleExtractLocation,
    })
  );
  return new Promise((res, rej) => {
    extractStream.on('error', (e) => {
      rej(e);
    });
    extractStream.on('close', () => {
      removeOldClientBundles(runnerBundleInstallDirectory, version);
      writeBundleVerificationLock(runnerBundleInstallDirectory);
      res(bundleExtractLocation);
    });
  });
}

function removeOldClientBundles(
  runnerBundleInstallDirectory: string,
  currentInstallVersion: string
) {
  const filesAndFolders = readdirSync(runnerBundleInstallDirectory);

  for (let fileOrFolder of filesAndFolders) {
    const fileOrFolderPath = join(runnerBundleInstallDirectory, fileOrFolder);

    if (fileOrFolder !== currentInstallVersion) {
      rmSync(fileOrFolderPath, { recursive: true });
    }
  }
}
