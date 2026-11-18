export function parseChangelogMarkdown(contents: string) {
  /**
   * The release header may include prerelease identifiers (e.g., -alpha.13),
   * and major releases may use a single #, instead of the standard ## used
   * for minor and patch releases. This regex matches all of these cases.
   *
   * Headings must follow a \n. The m flag would also match after \r, U+2028
   * and U+2029, which commit text can carry mid-line.
   */
  const CHANGELOG_RELEASE_HEAD_RE = new RegExp(
    '(?<=^|\\n)#+\\s*\\[?(\\d+\\.\\d+\\.\\d+(?:-[a-zA-Z0-9\\.]+)?)\\]?',
    'g'
  );

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
