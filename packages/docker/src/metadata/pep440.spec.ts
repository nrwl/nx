import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { valid, explain, clean, major, minor, patch } from './pep440';

describe('valid', () => {
  const validCases = [
    '1.0',
    '1.2.3',
    '1.2.3.4',
    'v1.2.3',
    '1.2.3a1',
    '1.2.3alpha1',
    '1.2.3b1',
    '1.2.3beta1',
    '1.2.3rc1',
    '1.2.3c1',
    '1.2.3.post1',
    '1.2.3-1', // implicit post release
    '1.2.3.dev1',
    '1.2.3.post1.dev1',
    '2!1.0',
    '1.0+local.1',
    '1.0+local-1.2',
    '1.0.dev0',
  ];

  for (const v of validCases) {
    test(`"${v}" is valid (returns the input string, matching v5)`, () => {
      assert.equal(valid(v), v);
    });
  }

  const invalidCases = ['', 'not-a-version', 'abc', '1.2.3-', '1.2.3++local'];

  for (const v of invalidCases) {
    test(`"${v}" is invalid (returns null, matching v5)`, () => {
      assert.equal(valid(v), null);
    });
  }
});

describe('explain', () => {
  test('returns null for invalid input', () => {
    assert.equal(explain('not-a-version'), null);
  });

  test('parses a plain release version', () => {
    const result = explain('1.2.3');
    assert.deepEqual(result, {
      epoch: 0,
      release: [1, 2, 3],
      pre: null,
      post: null,
      dev: null,
      local: null,
      public: '1.2.3',
      base_version: '1.2.3',
      is_prerelease: false,
      is_postrelease: false,
      is_devrelease: false,
    });
  });

  test('strips a leading "v"', () => {
    const result = explain('v1.2.3');
    assert.deepEqual(result?.release, [1, 2, 3]);
  });

  test('parses an epoch and includes it in base_version/public', () => {
    const result = explain('2!1.0');
    assert.equal(result?.epoch, 2);
    assert.deepEqual(result?.release, [1, 0]);
    assert.equal(result?.base_version, '2!1.0');
    assert.equal(result?.public, '2!1.0');
  });

  test('normalizes pre-release labels (alpha -> a)', () => {
    const result = explain('1.0alpha1');
    assert.deepEqual(result?.pre, ['a', 1]);
    assert.equal(result?.is_prerelease, true);
  });

  test('normalizes pre-release labels (beta -> b)', () => {
    const result = explain('1.0beta2');
    assert.deepEqual(result?.pre, ['b', 2]);
  });

  test('normalizes pre-release labels (c/pre/preview -> rc)', () => {
    assert.deepEqual(explain('1.0c1')?.pre, ['rc', 1]);
    assert.deepEqual(explain('1.0pre1')?.pre, ['rc', 1]);
    assert.deepEqual(explain('1.0preview1')?.pre, ['rc', 1]);
    assert.deepEqual(explain('1.0rc1')?.pre, ['rc', 1]);
  });

  test('defaults pre-release number to 0 when omitted', () => {
    assert.deepEqual(explain('1.0a')?.pre, ['a', 0]);
  });

  test('parses an explicit post release', () => {
    const result = explain('1.0.post1');
    assert.equal(result?.post, 1);
    assert.equal(result?.is_postrelease, true);
  });

  test('parses an implicit post release ("-N" shorthand)', () => {
    const result = explain('1.0-1');
    assert.equal(result?.post, 1);
  });

  test('parses "rev"/"r" as post release labels', () => {
    assert.equal(explain('1.0.rev2')?.post, 2);
    assert.equal(explain('1.0.r2')?.post, 2);
  });

  test('parses a dev release (counts as pre-release too)', () => {
    const result = explain('1.0.dev5');
    assert.equal(result?.dev, 5);
    assert.equal(result?.is_devrelease, true);
    assert.equal(result?.is_prerelease, true);
  });

  test('defaults dev number to 0 when omitted', () => {
    assert.equal(explain('1.0.dev')?.dev, 0);
  });

  test('parses a local version segment (dot-separated in explain())', () => {
    const result = explain('1.0+local.1-2');
    assert.equal(result?.local, 'local.1.2');
  });

  test('base_version excludes pre/post/dev/local, public excludes only local', () => {
    const result = explain('1.2.3a1.post2.dev3+build.4');
    assert.equal(result?.base_version, '1.2.3');
    assert.equal(result?.public, '1.2.3a1.post2.dev3');
  });

  test('parses a combined pre+post+dev version', () => {
    const result = explain('1.2.3a1.post2.dev3');
    assert.deepEqual(result?.pre, ['a', 1]);
    assert.equal(result?.post, 2);
    assert.equal(result?.dev, 3);
    assert.equal(result?.is_prerelease, true);
    assert.equal(result?.is_postrelease, true);
    assert.equal(result?.is_devrelease, true);
  });
});

describe('clean', () => {
  test('returns null for invalid input', () => {
    assert.equal(clean('not-a-version'), null);
  });

  test('normalizes a leading "v"', () => {
    assert.equal(clean('v1.2.3'), '1.2.3');
  });

  test('normalizes pre-release labels', () => {
    assert.equal(clean('1.0alpha1'), '1.0a1');
    assert.equal(clean('1.0beta2'), '1.0b2');
    assert.equal(clean('1.0preview1'), '1.0rc1');
  });

  test('renders epoch, post and dev segments', () => {
    assert.equal(clean('2!1.0'), '2!1.0');
    assert.equal(clean('1.0.post1'), '1.0.post1');
    assert.equal(clean('1.0-1'), '1.0.post1');
    assert.equal(clean('1.0.dev1'), '1.0.dev1');
  });

  test('joins the local-version segment with commas (matches v5)', () => {
    assert.equal(clean('1.0+local.1'), '1.0+local,1');
    assert.equal(clean('1.0+local-1.2'), '1.0+local,1,2');
    assert.equal(clean('1.0+abc'), '1.0+abc');
  });

  test('round-trips a fully-loaded version string', () => {
    assert.equal(
      clean('1.2.3a1.post2.dev3+build.4'),
      '1.2.3a1.post2.dev3+build,4'
    );
  });
});

describe('major / minor / patch', () => {
  test('extract release segments', () => {
    assert.equal(major('1.2.3'), 1);
    assert.equal(minor('1.2.3'), 2);
    assert.equal(patch('1.2.3'), 3);
  });

  test('default missing minor/patch segments to 0', () => {
    assert.equal(major('5'), 5);
    assert.equal(minor('5'), 0);
    assert.equal(patch('5'), 0);

    assert.equal(major('5.1'), 5);
    assert.equal(minor('5.1'), 1);
    assert.equal(patch('5.1'), 0);
  });

  test('throw a TypeError for invalid versions (matches v5)', () => {
    assert.throws(() => major('not-a-version'), {
      name: 'TypeError',
      message: 'Invalid Version: not-a-version',
    });
    assert.throws(() => minor('not-a-version'), TypeError);
    assert.throws(() => patch('not-a-version'), TypeError);
  });

  test('ignore extra release segments beyond patch', () => {
    assert.equal(major('1.2.3.4'), 1);
    assert.equal(minor('1.2.3.4'), 2);
    assert.equal(patch('1.2.3.4'), 3);
  });
});
