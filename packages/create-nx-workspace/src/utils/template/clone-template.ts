import { execAndWait } from '../child-process-utils';
import { existsSync } from 'fs';
import { rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { output } from '../output';
import { mapErrorToBodyLines } from '../error-utils';

export async function cloneTemplate(
  templateUrl: string,
  targetDirectory: string,
  workspaceName: string
): Promise<void> {
  try {
    // 1. Clone with shallow history
    await execAndWait(
      `git clone --depth 1 "${templateUrl}" "${targetDirectory}"`,
      process.cwd()
    );

    // 2. Remove git history (start fresh)
    const gitDir = join(targetDirectory, '.git');
    if (existsSync(gitDir)) {
      await rm(gitDir, { recursive: true, force: true });
    }

    // 3. Update workspace name in package.json
    const pkgPath = join(targetDirectory, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      pkg.name = workspaceName;
      await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    } else {
      output.error({
        title: 'Invalid template',
        bodyLines: [
          'Template is missing package.json file.',
          'Please ensure the template is a valid Nx workspace.',
        ],
      });
      process.exit(1);
    }

    // 4. Remove any Cloud config from template's nx.json
    const nxJsonPath = join(targetDirectory, 'nx.json');
    if (existsSync(nxJsonPath)) {
      const nxJson = JSON.parse(await readFile(nxJsonPath, 'utf-8'));
      delete nxJson.nxCloudId;
      delete nxJson.nxCloudAccessToken;
      await writeFile(nxJsonPath, JSON.stringify(nxJson, null, 2) + '\n');
    } else {
      output.error({
        title: 'Invalid template',
        bodyLines: [
          'Template is missing nx.json file.',
          'Please ensure the template is a valid Nx workspace.',
        ],
      });
      process.exit(1);
    }
  } catch (e) {
    if (e instanceof Error) {
      output.error({
        title: 'Failed to clone template',
        bodyLines: mapErrorToBodyLines(e),
      });
    } else {
      console.error(e);
    }
    process.exit(1);
  }
}

export async function cleanupLockfiles(
  targetDirectory: string,
  packageManager: string
): Promise<void> {
  const lockfiles = {
    npm: 'package-lock.json',
    yarn: 'yarn.lock',
    pnpm: 'pnpm-lock.yaml',
    bun: 'bun.lockb',
  };

  for (const [pm, lockfile] of Object.entries(lockfiles)) {
    if (pm !== packageManager) {
      const lockPath = join(targetDirectory, lockfile);
      if (existsSync(lockPath)) {
        await rm(lockPath, { force: true });
      }
    }
  }
}
