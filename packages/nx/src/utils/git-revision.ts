/**
 * Git parses any argument beginning with `-` as an option rather than a
 * revision, so a flag-shaped revision could smuggle options such as
 * `--upload-pack` into the git commands Nx runs.
 */
export function assertValidGitRevision(revision: string): void {
  if (revision.startsWith('-')) {
    throw new Error(
      `Invalid git revision: "${revision}". Git revisions cannot start with "-".`
    );
  }
}

const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/**
 * For refs Nx itself recorded from `git rev-parse` and later read back off
 * disk, where anything other than a commit sha means the value was tampered
 * with rather than that the user picked an unusual revision.
 */
export function assertValidGitSha(sha: string): void {
  if (!COMMIT_SHA.test(sha)) {
    throw new Error(
      `Invalid git commit sha: "${sha}". Expected a hexadecimal commit sha.`
    );
  }
}
