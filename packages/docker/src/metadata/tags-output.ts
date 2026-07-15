import { ParsedFlavor, ParsedImage, ResolvedVersion } from './types';

function sanitizeTag(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

/**
 * Ported from `Meta.getTags()`: fans a resolved version out across every enabled image,
 * emitting the main version tag, all partial (secondary) tags, and — if the resolved version is
 * flagged `latest` — a `latest` tag with optional flavor prefix/suffix-on-latest applied.
 * With no images configured, tags are emitted unprefixed (bare, no `image:` prefix).
 */
export function buildTagStrings(
  images: ParsedImage[],
  version: ResolvedVersion,
  flavor: ParsedFlavor
): string[] {
  if (!version.main) {
    return [];
  }

  const generateTags = (imageName: string): string[] => {
    const prefix = imageName !== '' ? `${imageName}:` : '';
    const tags = [`${prefix}${version.main}`];
    for (const partial of version.partial) {
      tags.push(`${prefix}${partial}`);
    }
    if (version.latest) {
      const latestTag = `${flavor.prefixLatest ? flavor.prefix : ''}latest${
        flavor.suffixLatest ? flavor.suffix : ''
      }`;
      tags.push(`${prefix}${sanitizeTag(latestTag)}`);
    }
    return tags;
  };

  const enabledImageNames = images
    .filter((image) => image.enable)
    .map((image) => image.name.toLowerCase());

  const tags: string[] = [];
  if (enabledImageNames.length > 0) {
    for (const imageName of enabledImageNames) {
      tags.push(...generateTags(imageName));
    }
  } else {
    tags.push(...generateTags(''));
  }
  return tags;
}
