import { execAndWait } from '../child-process-utils';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { CnwError } from '../error-utils';

export async function cloneTemplate(
  templateUrl: string,
  targetDirectory: string
): Promise<void> {
  if (existsSync(targetDirectory)) {
    throw new CnwError(
      'DIRECTORY_EXISTS',
      `The directory '${targetDirectory}' already exists. Choose a different name or remove the existing directory.`
    );
  }

  try {
    await execAndWait(
      `git clone --depth 1 "${templateUrl}" "${targetDirectory}"`,
      process.cwd()
    );

    // Ensure clean history
    const gitDir = join(targetDirectory, '.git');
    if (existsSync(gitDir)) {
      await rm(gitDir, { recursive: true, force: true });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new CnwError(
      'TEMPLATE_CLONE_FAILED',
      `Failed to create starter workspace: ${message}`
    );
  }
}
