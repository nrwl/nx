import { computePlanHash, createRunId, RUN_ID_SAFE } from './run-id';

describe('createRunId', () => {
  it('matches <compact-utc-timestamp>-<random-suffix>, with no colons or dots', () => {
    expect(createRunId()).toMatch(/^\d{8}T\d{6}-[0-9a-f]{8}$/);
  });

  it('is unique across calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createRunId()));
    expect(ids.size).toBe(200);
  });
});

describe('RUN_ID_SAFE', () => {
  it('accepts generated run ids', () => {
    expect(RUN_ID_SAFE.test(createRunId())).toBe(true);
  });

  it.each(['../escape', '..', '.', 'a b', 'a;b', 'a/b'])(
    'rejects the unsafe run id %s',
    (runId) => {
      expect(RUN_ID_SAFE.test(runId)).toBe(false);
    }
  );
});

describe('computePlanHash', () => {
  const plan = {
    migrations: [
      { package: '@nx/workspace', name: 'update-1', version: '1.0.0' },
    ],
  };

  it('is invariant under top-level key order', () => {
    const a = { migrations: plan.migrations, extra: 1 };
    const b = { extra: 1, migrations: plan.migrations };

    expect(computePlanHash(a)).toBe(computePlanHash(b));
  });

  it('is invariant under nested key order', () => {
    const a = { migrations: [{ package: 'p', version: '1.0.0' }] };
    const b = { migrations: [{ version: '1.0.0', package: 'p' }] };

    expect(computePlanHash(a)).toBe(computePlanHash(b));
  });

  it('is unaffected by the presence of a top-level nx-console key', () => {
    const withConsole = { ...plan, 'nx-console': { anything: true } };

    expect(computePlanHash(withConsole)).toBe(computePlanHash(plan));
  });

  it('changes when a migration entry changes', () => {
    const changed = {
      migrations: [
        { package: '@nx/workspace', name: 'update-1', version: '2.0.0' },
      ],
    };

    expect(computePlanHash(changed)).not.toBe(computePlanHash(plan));
  });

  it('produces the same hash for an equivalent string and object input', () => {
    expect(computePlanHash(JSON.stringify(plan))).toBe(computePlanHash(plan));
  });
});
