/**
 * The release header may include prerelease identifiers (e.g., -alpha.13),
 * and major releases may use a single #, instead of the standard ## used
 * for minor and patch releases. This regex matches all of these cases.
 */
const CHANGELOG_RELEASE_HEAD_RE = new RegExp(
  '^#+\\s*\\[?(\\d+\\.\\d+\\.\\d+(?:-[a-zA-Z0-9\\.]+)?)\\]?',
  'gm'
);

export function parseChangelogMarkdown(contents: string) {
  const headings = [...contents.matchAll(CHANGELOG_RELEASE_HEAD_RE)];
  const releases: { version?: string; body: string }[] = [];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const version = heading[1];

    const release = {
      version: version,
      body: contents
        .slice(
          heading.index + heading[0].length,
          nextHeading ? nextHeading.index : contents.length
        )
        .trim(),
    };
    releases.push(release);
  }

  return {
    releases,
  };
}

export function replaceChangelogRelease(
  contents: string,
  version: string,
  newEntry: string
): string {
  const headings = [...contents.matchAll(CHANGELOG_RELEASE_HEAD_RE)];
  const index = headings.findIndex((heading) => heading[1] === version);
  if (index === -1) {
    return contents;
  }

  const start = headings[index].index;
  const nextHeading = headings[index + 1];
  const existingEntry = contents
    .slice(start, nextHeading ? nextHeading.index : contents.length)
    .trimEnd();

  return (
    contents.slice(0, start) +
    newEntry +
    contents.slice(start + existingEntry.length)
  );
}
