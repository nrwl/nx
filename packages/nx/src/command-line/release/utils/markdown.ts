export function parseChangelogMarkdown(contents: string) {
  const CHANGELOG_RELEASE_HEAD_RE = new RegExp(
    '^#{2,}\\s+(\\d+\\.\\d+\\.\\d+)',
    'gm'
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
