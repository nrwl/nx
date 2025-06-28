export interface DockerVersionActionsOptions {
  registry?: string;
  repositoryName?: string;
  versionPattern?: string | Partial<VersionPatternOptions>;
}

export interface VersionPatternOptions {
  major: string;
  premajor: string;
  minor: string;
  preminor: string;
  patch: string;
  prepatch: string;
  prerelease: string;
}

export function normalizeVersionPattern(
  versionPattern: string | Partial<VersionPatternOptions>
): VersionPatternOptions {
  if (typeof versionPattern === 'string') {
    return {
      major: versionPattern,
      premajor: versionPattern,
      minor: versionPattern,
      preminor: versionPattern,
      patch: versionPattern,
      prepatch: versionPattern,
      prerelease: versionPattern,
    };
  }
  return {
    major: versionPattern.major ?? '',
    premajor: versionPattern.premajor ?? '',
    minor: versionPattern.minor ?? '',
    preminor: versionPattern.preminor ?? '',
    patch: versionPattern.patch ?? '',
    prepatch: versionPattern.prepatch ?? '',
    prerelease: versionPattern.prerelease ?? '',
  };
}
