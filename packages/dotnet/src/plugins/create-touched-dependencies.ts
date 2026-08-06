import type {
  CreateTouchedDependenciesFunction,
  TouchedDependencies,
  TouchedDependencyFile,
} from '@nx/devkit';

import { DotNetPluginOptions, nugetExternalNodeName } from './create-nodes';

/**
 * Matches every Central Package Management manifest in the workspace.
 */
export const centralPackagesFilePattern = '**/Directory.Packages.props';

/**
 * `<PackageVersion Include="Serilog" Version="4.0.0" />`, tolerating attribute order, single or
 * double quotes, and the `Update` form used to amend a version inherited from an outer manifest.
 */
const PACKAGE_VERSION_ELEMENT = /<PackageVersion\b([^>]*)\/?>/gi;
const ATTRIBUTE = /(\w+)\s*=\s*("([^"]*)"|'([^']*)')/g;

/**
 * An MSBuild property, item, or metadata expression (`$(...)`, `@(...)`, `%(...)`). A version
 * carrying one can resolve to a different value without this element's text changing, so it
 * can't be diffed textually.
 */
const MSBUILD_EXPRESSION = /[$@%]\(/;

/**
 * Keyed by lowercased package id — NuGet ids are case-insensitive, so a casing-only rename of
 * an Include is not a change. Values keep the manifest's casing for building identifiers.
 */
function parsePackageVersions(
  content: string
): Map<string, { id: string; version: string }> {
  const versions = new Map<string, { id: string; version: string }>();

  for (const [, attributeText] of content.matchAll(PACKAGE_VERSION_ELEMENT)) {
    let id: string | undefined;
    let version: string | undefined;

    for (const [, name, , doubleQuoted, singleQuoted] of attributeText.matchAll(
      ATTRIBUTE
    )) {
      const value = doubleQuoted ?? singleQuoted ?? '';
      const lowered = name.toLowerCase();
      if (lowered === 'include' || lowered === 'update') {
        id = value;
      } else if (lowered === 'version') {
        version = value;
      }
    }

    if (id) {
      // The version may be supplied by a property elsewhere; record the id regardless so
      // adding or removing the item still registers.
      versions.set(id.toLowerCase(), { id, version: version ?? '' });
    }
  }

  return versions;
}

/**
 * Attributes a change in a Directory.Packages.props to the packages whose versions moved.
 * Returns exact `nuget:<Id>@<Version>` node names when the new version is known, so a bump in
 * one Central Package Management scope doesn't select consumers of the same package pinned to a
 * different version in another scope. Falls back to the bare package id when the version can't
 * be determined: removed packages, empty versions, and versions supplied by an MSBuild
 * expression like `$(SerilogVersion)` — those can resolve differently without the element's
 * text changing, so their packages count as touched on every edit of the manifest. Returns
 * `'*'` (mark everything affected) when the change can't be attributed at all: an unreadable
 * base revision, a deleted manifest, or content that parses to nothing.
 */
export const createTouchedDependenciesFunction: CreateTouchedDependenciesFunction<
  DotNetPluginOptions
> = (touchedFiles: TouchedDependencyFile[]): TouchedDependencies => {
  const changed = new Set<string>();

  for (const { baseContent, headContent } of touchedFiles) {
    // Added, deleted, or unreadable on one side — not attributable to individual packages.
    if (baseContent === null || headContent === null) {
      return '*';
    }

    const before = parsePackageVersions(baseContent);
    const after = parsePackageVersions(headContent);

    // Content on both sides but no PackageVersion items parsed — treat as malformed.
    if (before.size === 0 && after.size === 0) {
      return '*';
    }

    for (const [key, { id, version }] of after) {
      if (MSBUILD_EXPRESSION.test(version)) {
        // The resolved version can move (e.g. a property bump) without this element's text
        // changing, so any edit of the manifest may affect this package.
        changed.add(id);
      } else if (before.get(key)?.version !== version) {
        changed.add(version ? nugetExternalNodeName({ id, version }) : id);
      }
    }
    for (const [key, { id }] of before) {
      if (!after.has(key)) {
        // No head version exists for a removed package. The bare id over-selects across scopes,
        // and consumers of the removed package fail resolution anyway, which drops them back to
        // the whole-file input.
        changed.add(id);
      }
    }
  }

  return Array.from(changed);
};

export const createTouchedDependencies = [
  centralPackagesFilePattern,
  createTouchedDependenciesFunction,
] as const;
