import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AffectedExplanation } from './affected-reasons';
import { printAffectedExplanation } from './print-explanation';

const explanation: AffectedExplanation = {
  affected: {
    'app:build': [{ kind: 'dependent-output', producer: 'app:prebuild' }],
  },
  upstream: {
    'app:prebuild': [{ kind: 'input-file', file: 'apps/app/src/x.ts' }],
  },
};

describe('printAffectedExplanation', () => {
  afterEach(() => vi.restoreAllMocks());

  // The not-selected producers ride along, so a reason naming one resolves
  // within the same JSON.
  it('prints both halves as JSON for stdout', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    printAffectedExplanation(explanation, 'Affected tasks', 'stdout');
    expect(JSON.parse(log.mock.calls[0][0])).toEqual(explanation);
  });

  it('writes the same JSON to any other destination', () => {
    const dir = mkdtempSync(join(tmpdir(), 'explain-'));
    try {
      const file = join(dir, 'reasons.json');
      printAffectedExplanation(explanation, 'Affected tasks', file);
      expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual(explanation);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
