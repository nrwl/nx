import {
  buildGlobalTemplateHelpers,
  compileTemplate,
  formatDateInTimeZone,
  isRawStatement,
  shortSha,
} from './templating';
import { GitRefContext } from './types';

describe('isRawStatement', () => {
  it('detects a bare {{raw}} mustache statement', () => {
    expect(isRawStatement('{{raw}}')).toBe(true);
  });

  it('rejects a pattern with surrounding text', () => {
    expect(isRawStatement('v{{raw}}')).toBe(false);
  });

  it('rejects a pattern referencing a different helper', () => {
    expect(isRawStatement('{{version}}')).toBe(false);
  });

  it('returns false for malformed handlebars', () => {
    expect(isRawStatement('{{')).toBe(false);
  });
});

describe('shortSha', () => {
  const fullSha = '0123456789abcdef0123456789abcdef01234567';

  afterEach(() => {
    delete process.env.NX_CONTAINER_SHORT_SHA_LENGTH;
  });

  it('defaults to 7 characters', () => {
    expect(shortSha(fullSha)).toEqual('0123456');
  });

  it('respects NX_CONTAINER_SHORT_SHA_LENGTH override', () => {
    process.env.NX_CONTAINER_SHORT_SHA_LENGTH = '10';
    expect(shortSha(fullSha)).toEqual('0123456789');
  });

  it('throws on a non-numeric override', () => {
    process.env.NX_CONTAINER_SHORT_SHA_LENGTH = 'abc';
    expect(() => shortSha(fullSha)).toThrow(/not a valid number/);
  });

  it('returns the input unchanged when shorter than the requested length', () => {
    expect(shortSha('abc')).toEqual('abc');
  });
});

describe('formatDateInTimeZone', () => {
  it('formats YYYYMMDD in UTC', () => {
    const date = new Date(Date.UTC(2024, 0, 5, 3, 4, 5));
    expect(formatDateInTimeZone(date, 'YYYYMMDD', 'UTC')).toEqual('20240105');
  });

  it('formats with separators and time tokens', () => {
    const date = new Date(Date.UTC(2024, 0, 5, 3, 4, 5));
    expect(formatDateInTimeZone(date, 'YYYY-MM-DD HH:mm:ss', 'UTC')).toEqual(
      '2024-01-05 03:04:05'
    );
  });
});

describe('buildGlobalTemplateHelpers', () => {
  const now = new Date(Date.UTC(2024, 0, 1));

  it('resolves branch from a heads ref', () => {
    const ctx: GitRefContext = {
      ref: 'refs/heads/main',
      sha: 'abc123',
      isDefaultBranch: true,
      eventName: '',
    };
    const helpers = buildGlobalTemplateHelpers(ctx, now);
    expect(helpers.branch()).toEqual('main');
    expect(helpers.tag()).toEqual('');
    expect(helpers.is_default_branch()).toEqual('true');
  });

  it('resolves tag from a tags ref', () => {
    const ctx: GitRefContext = {
      ref: 'refs/tags/v1.2.3',
      sha: 'abc123',
      isDefaultBranch: false,
      eventName: '',
    };
    const helpers = buildGlobalTemplateHelpers(ctx, now);
    expect(helpers.tag()).toEqual('v1.2.3');
    expect(helpers.branch()).toEqual('');
    expect(helpers.is_default_branch()).toEqual('false');
  });

  it('base_ref always resolves to empty string (no local-git equivalent)', () => {
    const ctx: GitRefContext = {
      ref: 'refs/heads/main',
      sha: 'abc123',
      isDefaultBranch: true,
      eventName: '',
    };
    expect(buildGlobalTemplateHelpers(ctx, now).base_ref()).toEqual('');
  });

  it('compiles a template using the global helpers', () => {
    const ctx: GitRefContext = {
      ref: 'refs/heads/main',
      sha: 'abc123',
      isDefaultBranch: true,
      eventName: '',
    };
    const helpers = buildGlobalTemplateHelpers(ctx, now);
    expect(compileTemplate('{{branch}}', helpers)).toEqual('main');
  });
});
