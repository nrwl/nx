import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

const copies = [
  '.github/skills/monitor-ci/scripts/ci-state-update.mjs',
  '.agents/skills/monitor-ci/scripts/ci-state-update.mjs',
  '.opencode/skills/monitor-ci/scripts/ci-state-update.mjs',
];

const script = join(repoRoot, copies[0]);

function run(...args) {
  const stdout = execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
  });
  return JSON.parse(stdout);
}

describe('checked-in monitor-ci scripts', () => {
  it('keeps the generated copies identical', () => {
    const [first, ...rest] = copies.map((path) =>
      readFileSync(join(repoRoot, path), 'utf8')
    );
    for (const content of rest) {
      assert.equal(content, first);
    }
  });
});

describe('gate local-fix', () => {
  it('uses defaults when the counters are omitted', () => {
    assert.deepEqual(run('gate', '--gate-type', 'local-fix'), {
      allowed: true,
      localVerifyCount: 1,
      message: null,
    });
  });

  it('allows a count below the maximum and increments it', () => {
    assert.deepEqual(
      run(
        'gate',
        '--gate-type',
        'local-fix',
        '--local-verify-count',
        '2',
        '--local-verify-attempts',
        '3'
      ),
      {
        allowed: true,
        localVerifyCount: 3,
        message: null,
      }
    );
  });

  it('rejects a count that has reached the maximum', () => {
    assert.deepEqual(
      run(
        'gate',
        '--gate-type',
        'local-fix',
        '--local-verify-count',
        '3',
        '--local-verify-attempts',
        '3'
      ),
      {
        allowed: false,
        localVerifyCount: 3,
        message: 'Local fix budget exhausted (3/3 attempts)',
      }
    );
  });

  it('treats a leading-zero count as that integer', () => {
    assert.deepEqual(
      run(
        'gate',
        '--gate-type',
        'local-fix',
        '--local-verify-count',
        '00',
        '--local-verify-attempts',
        '03'
      ),
      {
        allowed: true,
        localVerifyCount: 1,
        message: null,
      }
    );
  });

  for (const value of ['abc', '-1', '1.5', '3abc', '+2', ' 2', '']) {
    it(`fails closed when local-verify-count is ${JSON.stringify(value)}`, () => {
      const result = run(
        'gate',
        '--gate-type',
        'local-fix',
        '--local-verify-count',
        value
      );
      assert.equal(result.allowed, false);
      assert.equal(result.localVerifyCount, null);
      assert.match(result.message, /Local fix budget exhausted/);
    });
  }

  for (const value of ['abc', '-1', '3.5', '+3']) {
    it(`fails closed when local-verify-attempts is ${JSON.stringify(value)}`, () => {
      const result = run(
        'gate',
        '--gate-type',
        'local-fix',
        '--local-verify-count',
        '0',
        '--local-verify-attempts',
        value
      );
      assert.equal(result.allowed, false);
      assert.equal(result.localVerifyCount, 0);
    });
  }
});

describe('gate env-rerun', () => {
  it('uses a default count of 0', () => {
    assert.deepEqual(run('gate', '--gate-type', 'env-rerun'), {
      allowed: true,
      envRerunCount: 1,
      message: null,
    });
  });

  it('allows the second rerun and rejects the third', () => {
    assert.deepEqual(
      run('gate', '--gate-type', 'env-rerun', '--env-rerun-count', '1'),
      { allowed: true, envRerunCount: 2, message: null }
    );
    assert.deepEqual(
      run('gate', '--gate-type', 'env-rerun', '--env-rerun-count', '2'),
      {
        allowed: false,
        envRerunCount: 2,
        message:
          'Environment issue persists after 2 reruns. Manual investigation needed.',
      }
    );
  });

  for (const value of ['abc', '-1', '1.2', '+1']) {
    it(`fails closed when env-rerun-count is ${JSON.stringify(value)}`, () => {
      const result = run(
        'gate',
        '--gate-type',
        'env-rerun',
        '--env-rerun-count',
        value
      );
      assert.equal(result.allowed, false);
      assert.equal(result.envRerunCount, null);
    });
  }
});

describe('gate unknown type', () => {
  it('still rejects an unknown gate', () => {
    assert.deepEqual(run('gate', '--gate-type', 'other'), {
      allowed: false,
      message: 'Unknown gate type: other',
    });
  });
});

describe('cycle-check', () => {
  it('uses defaults when the counters are omitted', () => {
    assert.deepEqual(run('cycle-check', '--code', 'failed'), {
      cycleCount: 0,
      agentTriggered: false,
      envRerunCount: 0,
      approachingLimit: false,
      limitReached: false,
      message: null,
    });
  });

  it('warns in the two cycles before the cap and stops on the cap', () => {
    assert.deepEqual(
      run(
        'cycle-check',
        '--code',
        'failed',
        '--cycle-count',
        '7',
        '--max-cycles',
        '10'
      ),
      {
        cycleCount: 7,
        agentTriggered: false,
        envRerunCount: 0,
        approachingLimit: false,
        limitReached: false,
        message: null,
      }
    );
    assert.deepEqual(
      run(
        'cycle-check',
        '--code',
        'failed',
        '--cycle-count',
        '8',
        '--max-cycles',
        '10'
      ),
      {
        cycleCount: 8,
        agentTriggered: false,
        envRerunCount: 0,
        approachingLimit: true,
        limitReached: false,
        message: 'Approaching cycle limit (8/10)',
      }
    );
    assert.deepEqual(
      run(
        'cycle-check',
        '--code',
        'failed',
        '--cycle-count',
        '10',
        '--max-cycles',
        '10'
      ),
      {
        cycleCount: 10,
        agentTriggered: false,
        envRerunCount: 0,
        approachingLimit: true,
        limitReached: true,
        message: 'Cycle limit reached (10/10). Stopping.',
      }
    );
  });

  it('counts an agent-triggered cycle before applying the cap', () => {
    assert.deepEqual(
      run(
        'cycle-check',
        '--code',
        'failed',
        '--agent-triggered',
        '--cycle-count',
        '7',
        '--max-cycles',
        '10'
      ),
      {
        cycleCount: 8,
        agentTriggered: false,
        envRerunCount: 0,
        approachingLimit: true,
        limitReached: false,
        message: 'Approaching cycle limit (8/10)',
      }
    );
  });

  it('resets the env rerun count except on environment_issue', () => {
    assert.equal(
      run('cycle-check', '--code', 'failed', '--env-rerun-count', '1')
        .envRerunCount,
      0
    );
    assert.equal(
      run(
        'cycle-check',
        '--code',
        'environment_issue',
        '--env-rerun-count',
        '1'
      ).envRerunCount,
      1
    );
  });

  for (const value of ['abc', '-1', '1.5', '+4']) {
    it(`fails closed when cycle-count is ${JSON.stringify(value)}`, () => {
      const result = run(
        'cycle-check',
        '--code',
        'failed',
        '--cycle-count',
        value
      );
      assert.equal(result.limitReached, true);
      assert.equal(result.approachingLimit, true);
      assert.equal(result.cycleCount, null);
      assert.match(result.message, /Cycle limit reached/);
    });

    it(`fails closed when max-cycles is ${JSON.stringify(value)}`, () => {
      const result = run(
        'cycle-check',
        '--code',
        'failed',
        '--cycle-count',
        '0',
        '--max-cycles',
        value
      );
      assert.equal(result.limitReached, true);
      assert.equal(result.approachingLimit, true);
      assert.equal(result.cycleCount, 0);
    });
  }
});

describe('post-action', () => {
  it('keeps tracking state for a local push', () => {
    assert.deepEqual(
      run(
        'post-action',
        '--action',
        'apply-local-push',
        '--commit-sha',
        'abc123'
      ),
      {
        waitMode: true,
        pollCount: 0,
        lastCipeUrl: null,
        expectedCommitSha: 'abc123',
        agentTriggered: true,
      }
    );
  });
});
