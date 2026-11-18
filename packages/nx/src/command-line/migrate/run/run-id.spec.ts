import { createRunId, RUN_ID_SAFE } from './run-id';

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
