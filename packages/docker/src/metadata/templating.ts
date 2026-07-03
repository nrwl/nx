import Handlebars from 'handlebars';
import { GitRefContext } from './types';

const DEFAULT_SHORT_SHA_LENGTH = 7;

/**
 * Detects a pattern that is nothing but a bare `{{raw}}` mustache statement, matching the
 * semver/pep440 processors' special-cased "use the raw ref value verbatim" behavior.
 */
export function isRawStatement(pattern: string): boolean {
  try {
    const hp: any = Handlebars.parseWithoutProcessing(pattern);
    if (hp.body.length === 1 && hp.body[0].type === 'MustacheStatement') {
      const stm = hp.body[0];
      return stm.path?.parts?.length === 1 && stm.path.parts[0] === 'raw';
    }
  } catch {
    return false;
  }
  return false;
}

export function shortSha(sha: string): string {
  let length = DEFAULT_SHORT_SHA_LENGTH;
  if (process.env.NX_CONTAINER_SHORT_SHA_LENGTH) {
    if (isNaN(Number(process.env.NX_CONTAINER_SHORT_SHA_LENGTH))) {
      throw new Error(
        `NX_CONTAINER_SHORT_SHA_LENGTH is not a valid number: ${process.env.NX_CONTAINER_SHORT_SHA_LENGTH}`
      );
    }
    length = Number(process.env.NX_CONTAINER_SHORT_SHA_LENGTH);
  }
  if (length >= sha.length) {
    return sha;
  }
  return sha.substring(0, length);
}

const DATE_TOKEN_REGEX = /YYYY|YY|MM|DD|HH|mm|ss/g;

/**
 * Renders a subset of moment-style date tokens (YYYY/YY/MM/DD/HH/mm/ss) for a given IANA
 * timezone, using native `Intl.DateTimeFormat` instead of pulling in `moment-timezone`.
 * Arbitrary moment tokens (e.g. `Do`, `ddd`) are not supported.
 */
export function formatDateInTimeZone(
  date: Date,
  format: string,
  timeZone: string
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const yyyy = get('year');
  let hh = get('hour');
  // Some ICU implementations render midnight as hour '24' even with hour12:false.
  if (hh === '24') {
    hh = '00';
  }

  return format.replace(DATE_TOKEN_REGEX, (token) => {
    switch (token) {
      case 'YYYY':
        return yyyy;
      case 'YY':
        return yyyy.slice(-2);
      case 'MM':
        return get('month');
      case 'DD':
        return get('day');
      case 'HH':
        return hh;
      case 'mm':
        return get('minute');
      case 'ss':
        return get('second');
      default:
        return token;
    }
  });
}

function dateHelper(now: Date) {
  return function (
    format: string,
    options: { hash: Record<string, string> }
  ): string {
    let tz = 'UTC';
    for (const key of Object.keys(options.hash)) {
      if (key === 'tz') {
        tz = options.hash[key];
      } else {
        throw new Error(`Unknown ${key} attribute`);
      }
    }
    return formatDateInTimeZone(now, format, tz);
  };
}

/**
 * Handlebars view object exposing the same global helpers as the original GitHub-Actions
 * flavored implementation (`{{branch}}`, `{{tag}}`, `{{sha}}`, `{{base_ref}}`,
 * `{{is_default_branch}}`, `{{date 'FORMAT' tz='TZ'}}`), backed by a local `GitRefContext`
 * instead of a GitHub Actions event payload. `base_ref` always resolves to `''` since there is
 * no local-git equivalent of a PR/tag "base ref" outside of a CI checkout with an event payload.
 */
export function buildGlobalTemplateHelpers(ctx: GitRefContext, now: Date) {
  return {
    branch(): string {
      if (!/^refs\/heads\//.test(ctx.ref)) {
        return '';
      }
      return ctx.ref.replace(/^refs\/heads\//, '');
    },
    tag(): string {
      if (!/^refs\/tags\//.test(ctx.ref)) {
        return '';
      }
      return ctx.ref.replace(/^refs\/tags\//, '');
    },
    sha(): string {
      return ctx.sha ? shortSha(ctx.sha) : '';
    },
    base_ref(): string {
      return '';
    },
    is_default_branch(): string {
      return ctx.isDefaultBranch ? 'true' : 'false';
    },
    date: dateHelper(now),
  };
}

export function compileTemplate(
  pattern: string,
  view: Record<string, unknown>
): string {
  return Handlebars.compile(pattern)(view);
}
