import type { MockInstance, MockedFunction } from 'vitest';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { writeAiOutput, logProgress, writeErrorLog } from './ai-output';

// Mock isAiAgent
vi.mock('../../native', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  isAiAgent: vi.fn(),
}));

import { isAiAgent } from '../../native';
const mockIsAiAgent = isAiAgent as MockedFunction<typeof isAiAgent>;

describe('shared ai-output', () => {
  let stdoutSpy: MockInstance;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation();
    mockIsAiAgent.mockReturnValue(false);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('writeAiOutput', () => {
    it('should write NDJSON when isAiAgent is true', () => {
      mockIsAiAgent.mockReturnValue(true);
      writeAiOutput({ stage: 'starting', message: 'test' });
      expect(stdoutSpy).toHaveBeenCalledWith(
        JSON.stringify({ stage: 'starting', message: 'test' }) + '\n'
      );
    });

    it('should not write when isAiAgent is false', () => {
      mockIsAiAgent.mockReturnValue(false);
      writeAiOutput({ stage: 'starting', message: 'test' });
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should append USER_NEXT_STEPS for success results', () => {
      mockIsAiAgent.mockReturnValue(true);
      writeAiOutput({
        stage: 'complete',
        success: true,
        userNextSteps: {
          steps: [{ title: 'Run tests', command: 'nx test' }],
        },
      });
      // First call: JSON line, second call: plain text
      expect(stdoutSpy).toHaveBeenCalledTimes(2);
      const plainText = stdoutSpy.mock.calls[1][0];
      expect(plainText).toContain('---USER_NEXT_STEPS---');
      expect(plainText).toContain('Run tests');
    });
  });

  describe('logProgress', () => {
    it('should call writeAiOutput with stage and message', () => {
      mockIsAiAgent.mockReturnValue(true);
      logProgress('cloning', 'Cloning repo...');
      expect(stdoutSpy).toHaveBeenCalledWith(
        JSON.stringify({ stage: 'cloning', message: 'Cloning repo...' }) + '\n'
      );
    });
  });

  describe('writeErrorLog', () => {
    it('should write error details to temp file and return path', () => {
      const path = writeErrorLog(new Error('test error'), 'nx-import');
      expect(path).toContain('nx-import-error-');
      expect(path).toMatch(/\.log$/);
    });

    it('should handle non-Error objects', () => {
      const path = writeErrorLog('string error', 'nx');
      expect(path).toBeTruthy();
    });

    describe.skipIf(process.platform === 'win32')('file permissions', () => {
      let root: string;
      const originalTmpdir = process.env.TMPDIR;

      beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'nx-ai-output-spec-'));
        process.env.TMPDIR = root;
      });

      afterEach(() => {
        if (originalTmpdir === undefined) delete process.env.TMPDIR;
        else process.env.TMPDIR = originalTmpdir;
        vi.restoreAllMocks();
        rmSync(root, { recursive: true, force: true });
      });

      it('should write the log readable only by the current user', () => {
        const path = writeErrorLog(new Error('secret'), 'nx');
        expect(path.startsWith(root)).toBe(true);
        expect(statSync(path).mode & 0o077).toBe(0);
        expect(statSync(dirname(path)).mode & 0o077).toBe(0);
        expect(readFileSync(path, 'utf-8')).toContain('secret');
      });

      it('should not follow a pre-created file at the predictable path', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
        const target = join(root, 'target');
        writeFileSync(target, 'untouched');
        symlinkSync(target, join(root, 'nx-error-1700000000000.log'));

        const path = writeErrorLog(new Error('secret'), 'nx');

        expect(readFileSync(target, 'utf-8')).toBe('untouched');
        expect(path).not.toBe(join(root, 'nx-error-1700000000000.log'));
      });
    });
  });
});
