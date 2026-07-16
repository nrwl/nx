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
