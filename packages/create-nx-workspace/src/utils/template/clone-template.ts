import { execAndWait } from '../child-process-utils';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { output } from '../output';
import { mapErrorToBodyLines } from '../error-utils';

export async function cloneTemplate(
  templateUrl: string,
  targetDirectory: string
): Promise<void> {
  if (existsSync(targetDirectory)) {
    throw new Error(
      `The directory '${targetDirectory}' already exists and is not empty. Choose a different name or remove the existing directory.`
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
    if (e instanceof Error) {
      output.error({
        title: 'Failed to create starter workspace',
        bodyLines: mapErrorToBodyLines(e),
      });
    } else {
      console.error(e);
    }
    process.exit(1);
  }
}
