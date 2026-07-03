import { parseFlavor } from './flavor';
import { parseTags } from './tag';
import { GitRefContext } from './types';
import { resolveVersion } from './version-resolver';

const now = new Date(Date.UTC(2024, 0, 1));
const defaultFlavor = parseFlavor([]);

function branchCtx(branch: string, sha = 'abcdef1234567890'): GitRefContext {
  return {
    ref: `refs/heads/${branch}`,
    sha,
    isDefaultBranch: branch === 'main',
    eventName: '',
  };
}

function tagCtx(tag: string, sha = 'abcdef1234567890'): GitRefContext {
  return {
    ref: `refs/tags/${tag}`,
    sha,
    isDefaultBranch: false,
    eventName: '',
  };
}

function prCtx(number: number, sha = 'abcdef1234567890'): GitRefContext {
  return {
    ref: `refs/pull/${number}/merge`,
    sha,
    isDefaultBranch: false,
    eventName: '',
  };
}

describe('resolveVersion', () => {
  it('resolves a branch ref via the default tag rules', () => {
    const tags = parseTags([]);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      branchCtx('feature-x'),
      'main',
      now
    );
    expect(version.main).toEqual('feature-x');
    expect(version.latest).toBe(false);
  });

  it('resolves a tag ref as latest via the default tag rules', () => {
    const tags = parseTags([]);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      tagCtx('v1.2.3'),
      'main',
      now
    );
    expect(version.main).toEqual('v1.2.3');
    expect(version.latest).toBe(true);
  });

  it('resolves a pr ref with the pr- prefix via the default tag rules', () => {
    const tags = parseTags([]);
    const version = resolveVersion(tags, defaultFlavor, prCtx(42), 'main', now);
    expect(version.main).toEqual('pr-42');
    expect(version.latest).toBe(false);
  });

  it('produces no main version on a detached/untagged HEAD with only ref-based rules', () => {
    const tags = parseTags([]);
    const detached: GitRefContext = {
      ref: '',
      sha: 'abc',
      isDefaultBranch: false,
      eventName: '',
    };
    const version = resolveVersion(tags, defaultFlavor, detached, 'main', now);
    expect(version.main).toBeUndefined();
  });

  it('keeps the schedule rule inert by default, even when explicitly configured, so it never shadows branch/tag/PR builds', () => {
    const tags = parseTags([
      'type=schedule,pattern=nightly',
      'type=ref,event=branch',
    ]);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      branchCtx('main'),
      'main',
      now
    );
    expect(version.main).toEqual('main');
  });

  it('picks the highest-priority match as main, others as partial, when the schedule rule is explicitly signalled active', () => {
    const tags = parseTags([
      'type=schedule,pattern=nightly',
      'type=ref,event=branch',
    ]);
    const ctx = { ...branchCtx('main'), eventName: 'schedule' };
    const version = resolveVersion(tags, defaultFlavor, ctx, 'main', now);
    expect(version.main).toEqual('nightly');
    expect(version.partial).toEqual(['main']);
  });

  it('applies semver pattern against a valid tag', () => {
    const tags = parseTags(['type=semver,pattern={{version}}']);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      tagCtx('v1.2.3'),
      'main',
      now
    );
    expect(version.main).toEqual('1.2.3');
    expect(version.latest).toBe(true);
  });

  it('does not treat an invalid semver tag as a match', () => {
    const tags = parseTags(['type=semver,pattern={{version}}']);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      tagCtx('not-a-version'),
      'main',
      now
    );
    expect(version.main).toBeUndefined();
  });

  it('applies sha rule with short format by default', () => {
    const tags = parseTags(['type=sha']);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      branchCtx('main', '0123456789abcdef'),
      'main',
      now
    );
    expect(version.main).toEqual('sha-0123456');
  });

  it('applies sha rule with long format', () => {
    const tags = parseTags(['type=sha,format=long']);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      branchCtx('main', '0123456789abcdef'),
      'main',
      now
    );
    expect(version.main).toEqual('sha-0123456789abcdef');
  });

  it('applies a raw tag with a templated value and prefix/suffix', () => {
    const tags = parseTags([
      'type=raw,value={{branch}},prefix=v-,suffix=-final',
    ]);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      branchCtx('release'),
      'main',
      now
    );
    expect(version.main).toEqual('v-release-final');
  });

  it('marks edge tag as main only on the matching branch', () => {
    const tags = parseTags(['type=edge']);
    const onDefault = resolveVersion(
      tags,
      defaultFlavor,
      branchCtx('main'),
      'main',
      now
    );
    expect(onDefault.main).toEqual('edge');

    const onOther = resolveVersion(
      tags,
      defaultFlavor,
      branchCtx('other'),
      'main',
      now
    );
    expect(onOther.main).toBeUndefined();
  });

  it('respects flavor.latest=true override even for a branch ref', () => {
    const tags = parseTags(['type=ref,event=branch']);
    const flavor = parseFlavor(['latest=true']);
    const version = resolveVersion(
      tags,
      flavor,
      branchCtx('main'),
      'main',
      now
    );
    expect(version.latest).toBe(true);
  });

  it('respects flavor.latest=false override even for a tag ref', () => {
    const tags = parseTags(['type=ref,event=tag']);
    const flavor = parseFlavor(['latest=false']);
    const version = resolveVersion(tags, flavor, tagCtx('v1.0.0'), 'main', now);
    expect(version.latest).toBe(false);
  });

  it('dedupes partial versions', () => {
    const tags = parseTags(['type=ref,event=branch', 'type=raw,value=main']);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      branchCtx('main'),
      'main',
      now
    );
    expect(version.partial).toEqual([]);
  });

  it('skips a tag disabled via the enable attribute', () => {
    const tags = parseTags(['type=ref,event=branch,enable=false']);
    const version = resolveVersion(
      tags,
      defaultFlavor,
      branchCtx('main'),
      'main',
      now
    );
    expect(version.main).toBeUndefined();
  });
});
