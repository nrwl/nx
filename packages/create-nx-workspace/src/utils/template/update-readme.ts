import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'path';
import { execAndWait } from '../child-process-utils';

const BEGIN_MARKER = '<!-- BEGIN: nx-cloud -->';
const END_MARKER = '<!-- END: nx-cloud -->';

const CLOUD_SETUP_SECTION = `## Finish your Nx platform setup

🚀 [Finish setting up your workspace]({{CONNECT_URL}}) to get faster builds with remote caching, distributed task execution, and self-healing CI. [Learn more about Nx Cloud](https://nx.dev/ci/intro/why-nx-cloud).
`;

/**
 * Updates README content by processing the nx-cloud marker section.
 * - If connectUrl is provided: replaces markers and content with the connect URL section
 * - If connectUrl is undefined: keeps the content between markers but strips the marker comments
 *
 * This ensures users never see the raw <!-- BEGIN/END: nx-cloud --> markers in their README.
 *
 * @param readmeContent - The current README content
 * @param connectUrl - The Nx Cloud connect URL (optional)
 * @returns The updated README content with markers processed, or original if markers not found
 */
export function updateReadmeContent(
  readmeContent: string,
  connectUrl: string | undefined
): string {
  const beginIndex = readmeContent.indexOf(BEGIN_MARKER);
  const endIndex = readmeContent.indexOf(END_MARKER);

  if (beginIndex === -1 || endIndex === -1 || beginIndex >= endIndex) {
    return readmeContent;
  }

  // If no connect URL, keep the content between markers but strip the marker comments
  if (!connectUrl) {
    // Extract content between markers (after BEGIN marker + newline, before END marker)
    const contentStart = beginIndex + BEGIN_MARKER.length;
    const contentStartSkipNewline =
      readmeContent[contentStart] === '\n' ? contentStart + 1 : contentStart;
    const content = readmeContent.slice(contentStartSkipNewline, endIndex);

    // Skip trailing newline after END marker if present
    const afterEnd = endIndex + END_MARKER.length;
    const skipTrailing =
      readmeContent[afterEnd] === '\n' ? afterEnd + 1 : afterEnd;

    return (
      readmeContent.slice(0, beginIndex) +
      content +
      readmeContent.slice(skipTrailing)
    );
  }

  const section = CLOUD_SETUP_SECTION.replace('{{CONNECT_URL}}', connectUrl);

  // Strip the markers - only include the section content
  // Also skip one trailing newline after END marker since section already has one
  const afterEnd = endIndex + END_MARKER.length;
  const skipNewline =
    readmeContent[afterEnd] === '\n' ? afterEnd + 1 : afterEnd;

  return (
    readmeContent.slice(0, beginIndex) +
    section +
    readmeContent.slice(skipNewline)
  );
}

/**
 * Updates the README.md file in the given directory with the Nx Cloud connect URL.
 * This is a convenience wrapper around updateReadmeContent that handles file I/O.
 *
 * @param directory - The workspace directory containing README.md
 * @param connectUrl - The Nx Cloud connect URL
 * @returns true if the file was modified, false otherwise
 */
export function addConnectUrlToReadme(
  directory: string,
  connectUrl: string | undefined
): boolean {
  const readmePath = join(directory, 'README.md');
  if (!existsSync(readmePath)) {
    return false;
  }

  const content = readFileSync(readmePath, 'utf-8');
  const updated = updateReadmeContent(content, connectUrl);

  if (updated !== content) {
    writeFileSync(readmePath, updated);
    return true;
  }

  return false;
}

/**
 * Commits README.md changes, either by amending the initial commit or creating a new one.
 * - If already pushed to VCS: creates a new commit (to avoid requiring force push)
 * - If not pushed: amends the initial commit (cleaner history)
 *
 * @param directory - The workspace directory
 * @param alreadyPushed - Whether the repo was already pushed to VCS
 */
export async function amendOrCommitReadme(
  directory: string,
  alreadyPushed: boolean
): Promise<void> {
  await execAndWait('git add README.md', directory);

  if (alreadyPushed) {
    await execAndWait(
      'git commit -m "chore: add Nx Cloud setup link to README"',
      directory
    );
    await execAndWait('git push', directory);
  } else {
    try {
      await execAndWait('git commit --amend --no-edit', directory);
    } catch {
      // If amend fails, it could be that the original git init failed (we log but do not throw)
      // Let the flow continue
    }
  }
}
