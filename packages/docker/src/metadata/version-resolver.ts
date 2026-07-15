import * as pep440 from './pep440';
import Handlebars from 'handlebars';
import * as semver from 'semver';
import {
  buildGlobalTemplateHelpers,
  compileTemplate,
  isRawStatement,
} from './templating';
import {
  GitRefContext,
  ParsedFlavor,
  ParsedTag,
  ResolvedVersion,
} from './types';

interface WorkingVersion {
  main: string | undefined;
  partial: string[];
  latest: boolean | undefined;
}

function sanitizeTag(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function setVersion(
  version: WorkingVersion,
  val: string,
  latest: boolean
): WorkingVersion {
  if (val.length === 0) {
    return version;
  }
  val = sanitizeTag(val);
  if (version.main === undefined) {
    version.main = val;
  } else if (val !== version.main) {
    version.partial.push(val);
  }
  if (version.latest === undefined) {
    version.latest = latest;
  }
  return version;
}

function latestForFlavor(flavor: ParsedFlavor, autoValue: boolean): boolean {
  if (flavor.latest === 'auto') {
    return autoValue;
  }
  return flavor.latest === 'true';
}

function applyPrefixSuffix(
  val: string,
  tag: ParsedTag,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): string {
  if ('prefix' in tag.attrs) {
    val = `${compileTemplate(tag.attrs['prefix'], globalHelpers)}${val}`;
  } else if (flavor.prefix.length > 0) {
    val = `${compileTemplate(flavor.prefix, globalHelpers)}${val}`;
  }
  if ('suffix' in tag.attrs) {
    val = `${val}${compileTemplate(tag.attrs['suffix'], globalHelpers)}`;
  } else if (flavor.suffix.length > 0) {
    val = `${val}${compileTemplate(flavor.suffix, globalHelpers)}`;
  }
  return val;
}

function procSchedule(
  version: WorkingVersion,
  tag: ParsedTag,
  ctx: GitRefContext,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  if (!/schedule/.test(ctx.eventName)) {
    return version;
  }
  const raw = Handlebars.compile(tag.attrs['pattern'])({
    date: (
      globalHelpers as { date: (format: string, options: unknown) => string }
    ).date,
  });
  const vraw = applyPrefixSuffix(raw, tag, flavor, globalHelpers);
  return setVersion(version, vraw, latestForFlavor(flavor, false));
}

function procSemver(
  version: WorkingVersion,
  tag: ParsedTag,
  ctx: GitRefContext,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  if (!/^refs\/tags\//.test(ctx.ref) && tag.attrs['value'].length === 0) {
    return version;
  }

  let raw: string;
  if (tag.attrs['value'].length > 0) {
    raw = compileTemplate(tag.attrs['value'], globalHelpers);
  } else {
    raw = ctx.ref.replace(/^refs\/tags\//, '').replace(/\//g, '-');
  }
  if (!semver.valid(raw)) {
    return version;
  }

  let latest = false;
  const sver = semver.parse(raw, { loose: true });
  let value: string;
  if (semver.prerelease(raw)) {
    if (isRawStatement(tag.attrs['pattern'])) {
      value = Handlebars.compile(tag.attrs['pattern'])(sver);
    } else {
      value = Handlebars.compile('{{version}}')(sver);
    }
  } else {
    value = Handlebars.compile(tag.attrs['pattern'])(sver);
    latest = true;
  }

  const vraw = applyPrefixSuffix(value, tag, flavor, globalHelpers);
  return setVersion(version, vraw, latestForFlavor(flavor, latest));
}

function procPep440(
  version: WorkingVersion,
  tag: ParsedTag,
  ctx: GitRefContext,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  if (!/^refs\/tags\//.test(ctx.ref) && tag.attrs['value'].length === 0) {
    return version;
  }

  let raw: string;
  if (tag.attrs['value'].length > 0) {
    raw = compileTemplate(tag.attrs['value'], globalHelpers);
  } else {
    raw = ctx.ref.replace(/^refs\/tags\//, '').replace(/\//g, '-');
  }
  if (!pep440.valid(raw)) {
    return version;
  }

  let latest = false;
  const explained = pep440.explain(raw);
  let value: string;
  if (
    explained?.is_prerelease ||
    explained?.is_postrelease ||
    explained?.is_devrelease
  ) {
    if (isRawStatement(tag.attrs['pattern'])) {
      value = raw;
    } else {
      value = (pep440.clean(raw) as string | null) ?? raw;
    }
  } else {
    value = Handlebars.compile(tag.attrs['pattern'])({
      raw: () => raw,
      version: () => pep440.clean(raw),
      major: () => pep440.major(raw),
      minor: () => pep440.minor(raw),
      patch: () => pep440.patch(raw),
    });
    latest = true;
  }

  const vraw = applyPrefixSuffix(value, tag, flavor, globalHelpers);
  return setVersion(version, vraw, latestForFlavor(flavor, latest));
}

function procMatch(
  version: WorkingVersion,
  tag: ParsedTag,
  ctx: GitRefContext,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  if (!/^refs\/tags\//.test(ctx.ref) && tag.attrs['value'].length === 0) {
    return version;
  }

  let raw: string;
  if (tag.attrs['value'].length > 0) {
    raw = compileTemplate(tag.attrs['value'], globalHelpers);
  } else {
    raw = ctx.ref.replace(/^refs\/tags\//, '');
  }

  const isRegExLiteral = tag.attrs['pattern'].match(/^\/(.+)\/(.*)$/);
  const match = isRegExLiteral
    ? raw.match(new RegExp(isRegExLiteral[1], isRegExLiteral[2]))
    : raw.match(tag.attrs['pattern']);
  if (!match) {
    return version;
  }
  const group = (match as any)[tag.attrs['group']];
  if (typeof group === 'undefined') {
    return version;
  }

  const vraw = applyPrefixSuffix(group, tag, flavor, globalHelpers);
  return setVersion(version, vraw, latestForFlavor(flavor, true));
}

function procRefBranch(
  version: WorkingVersion,
  tag: ParsedTag,
  ctx: GitRefContext,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  if (!/^refs\/heads\//.test(ctx.ref)) {
    return version;
  }
  const vraw = applyPrefixSuffix(
    ctx.ref.replace(/^refs\/heads\//, ''),
    tag,
    flavor,
    globalHelpers
  );
  return setVersion(version, vraw, latestForFlavor(flavor, false));
}

function procRefTag(
  version: WorkingVersion,
  tag: ParsedTag,
  ctx: GitRefContext,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  if (!/^refs\/tags\//.test(ctx.ref)) {
    return version;
  }
  const vraw = applyPrefixSuffix(
    ctx.ref.replace(/^refs\/tags\//, ''),
    tag,
    flavor,
    globalHelpers
  );
  return setVersion(version, vraw, latestForFlavor(flavor, true));
}

function procRefPr(
  version: WorkingVersion,
  tag: ParsedTag,
  ctx: GitRefContext,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  if (!/^refs\/pull\//.test(ctx.ref)) {
    return version;
  }
  const vraw = applyPrefixSuffix(
    ctx.ref.replace(/^refs\/pull\//, '').replace(/\/merge$/, ''),
    tag,
    flavor,
    globalHelpers
  );
  return setVersion(version, vraw, latestForFlavor(flavor, false));
}

function procEdge(
  version: WorkingVersion,
  tag: ParsedTag,
  ctx: GitRefContext,
  repoDefaultBranch: string,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  if (!/^refs\/heads\//.test(ctx.ref)) {
    return version;
  }
  const branch = ctx.ref.replace(/^refs\/heads\//, '');
  const targetBranch =
    tag.attrs['branch'].length === 0 ? repoDefaultBranch : tag.attrs['branch'];
  if (targetBranch !== branch) {
    return version;
  }
  const vraw = applyPrefixSuffix('edge', tag, flavor, globalHelpers);
  return setVersion(version, vraw, latestForFlavor(flavor, false));
}

function procRaw(
  version: WorkingVersion,
  tag: ParsedTag,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  const value = compileTemplate(tag.attrs['value'], globalHelpers);
  const vraw = applyPrefixSuffix(value, tag, flavor, globalHelpers);
  return setVersion(version, vraw, latestForFlavor(flavor, false));
}

function procSha(
  version: WorkingVersion,
  tag: ParsedTag,
  ctx: GitRefContext,
  flavor: ParsedFlavor,
  globalHelpers: Record<string, unknown>
): WorkingVersion {
  if (!ctx.sha) {
    return version;
  }
  const helpers = globalHelpers as { sha: () => string };
  const val = tag.attrs['format'] === 'short' ? helpers.sha() : ctx.sha;
  const vraw = applyPrefixSuffix(val, tag, flavor, globalHelpers);
  return setVersion(version, vraw, latestForFlavor(flavor, false));
}

/**
 * Ported from `container-metadata`'s `Meta.getVersion()` + its `procX` methods, flattened into
 * one function over plain data (no class/instance state). Iterates tags in priority order; the
 * first enabled rule to produce a non-empty value becomes `version.main`, subsequent matches are
 * appended to `version.partial` (deduplicated). The `schedule` tag type stays gated on
 * `gitContext.eventName` matching `/schedule/`, same as the original — since the default tag set
 * always includes a `type=schedule` rule, without this gate it would win (highest priority) over
 * every normal branch/tag/PR build.
 */
export function resolveVersion(
  tags: ParsedTag[],
  flavor: ParsedFlavor,
  gitContext: GitRefContext,
  repoDefaultBranch: string,
  now: Date
): ResolvedVersion {
  const globalHelpers = buildGlobalTemplateHelpers(gitContext, now);
  let version: WorkingVersion = {
    main: undefined,
    partial: [],
    latest: undefined,
  };

  for (const tag of tags) {
    const enabled = compileTemplate(tag.attrs['enable'], globalHelpers);
    if (!['true', 'false'].includes(enabled)) {
      throw new Error(`Invalid value for enable attribute: ${enabled}`);
    }
    if (!/true/i.test(enabled)) {
      continue;
    }

    switch (tag.type) {
      case 'schedule':
        version = procSchedule(version, tag, gitContext, flavor, globalHelpers);
        break;
      case 'semver':
        version = procSemver(version, tag, gitContext, flavor, globalHelpers);
        break;
      case 'pep440':
        version = procPep440(version, tag, gitContext, flavor, globalHelpers);
        break;
      case 'match':
        version = procMatch(version, tag, gitContext, flavor, globalHelpers);
        break;
      case 'ref':
        if (tag.attrs['event'] === 'branch') {
          version = procRefBranch(
            version,
            tag,
            gitContext,
            flavor,
            globalHelpers
          );
        } else if (tag.attrs['event'] === 'tag') {
          version = procRefTag(version, tag, gitContext, flavor, globalHelpers);
        } else if (tag.attrs['event'] === 'pr') {
          version = procRefPr(version, tag, gitContext, flavor, globalHelpers);
        }
        break;
      case 'edge':
        version = procEdge(
          version,
          tag,
          gitContext,
          repoDefaultBranch,
          flavor,
          globalHelpers
        );
        break;
      case 'raw':
        version = procRaw(version, tag, flavor, globalHelpers);
        break;
      case 'sha':
        version = procSha(version, tag, gitContext, flavor, globalHelpers);
        break;
    }
  }

  const partial = version.partial.filter(
    (item, index) => version.partial.indexOf(item) === index
  );
  return { main: version.main, partial, latest: version.latest ?? false };
}
