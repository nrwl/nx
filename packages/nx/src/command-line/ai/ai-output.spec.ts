import { writeAiOutput, logProgress, writeErrorLog } from './ai-output';

// Mock isAiAgent
jest.mock('../../native', () => ({
  isAiAgent: jest.fn(),
}));

import { isAiAgent } from '../../native';
const mockIsAiAgent = isAiAgent as jest.MockedFunction<typeof isAiAgent>;

describe('shared ai-output', () => {
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    mockIsAiAgent.mockReturnValue(false);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    jest.restoreAllMocks();
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
  });
});
