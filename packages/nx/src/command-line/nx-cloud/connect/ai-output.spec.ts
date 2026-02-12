import {
  buildMissingVcsResult,
  buildAlreadyConnectedResult,
  buildConnectedResult,
  buildConnectErrorResult,
  getConnectErrorHints,
} from './ai-output';

describe('ai-output for nx connect', () => {
  describe('buildMissingVcsResult', () => {
    it('should return needs_input result with VCS hints', () => {
      const result = buildMissingVcsResult();

      expect(result.stage).toBe('needs_input');
      expect(result.success).toBe(false);
      expect(result.inputType).toBe('vcs_remote');
      expect(result.errorCode).toBe('MISSING_VCS_REMOTE');
      expect(result.suggestedCommands).toContainEqual(
        expect.objectContaining({
          command: 'gh repo create --source=. --push',
        })
      );
      expect(result.recommendedOption).toContain('gh repo create');
    });

    it('should include manual push option', () => {
      const result = buildMissingVcsResult();

      expect(result.suggestedCommands).toContainEqual(
        expect.objectContaining({
          command: expect.stringContaining('git remote add origin'),
        })
      );
    });
  });

  describe('buildAlreadyConnectedResult', () => {
    it('should return success result with connect URL', () => {
      const url = 'https://cloud.nx.app/connect/abc123';
      const result = buildAlreadyConnectedResult(url);

      expect(result.stage).toBe('complete');
      expect(result.success).toBe(true);
      expect(result.result.connectUrl).toBe(url);
      expect(result.result.alreadyConnected).toBe(true);
      expect(result.userNextSteps.steps).toHaveLength(1);
      expect(result.userNextSteps.steps[0].url).toBe(url);
    });
  });

  describe('buildConnectedResult', () => {
    it('should return success result with connect URL and commit step', () => {
      const url = 'https://cloud.nx.app/connect/xyz789';
      const result = buildConnectedResult(url);

      expect(result.stage).toBe('complete');
      expect(result.success).toBe(true);
      expect(result.result.connectUrl).toBe(url);
      expect(result.result.alreadyConnected).toBe(false);
      expect(result.userNextSteps.steps).toHaveLength(2);
      expect(result.userNextSteps.steps[0].url).toBe(url);
      expect(result.userNextSteps.steps[1].command).toContain(
        'git add nx.json'
      );
    });
  });

  describe('buildConnectErrorResult', () => {
    it('should return error result with hints', () => {
      const result = buildConnectErrorResult(
        'Connection failed',
        'NETWORK_ERROR'
      );

      expect(result.stage).toBe('error');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(result.errorCode).toBe('NETWORK_ERROR');
      expect(result.hints.length).toBeGreaterThan(0);
    });
  });

  describe('getConnectErrorHints', () => {
    it('should return hints for MISSING_VCS_REMOTE', () => {
      const hints = getConnectErrorHints('MISSING_VCS_REMOTE');
      expect(hints).toContainEqual(expect.stringContaining('gh repo create'));
    });

    it('should return hints for ALREADY_CONNECTED', () => {
      const hints = getConnectErrorHints('ALREADY_CONNECTED');
      expect(hints).toContainEqual(
        expect.stringContaining('already connected')
      );
    });

    it('should return hints for AUTH_ERROR', () => {
      const hints = getConnectErrorHints('AUTH_ERROR');
      expect(hints).toContainEqual(
        expect.stringContaining('NX_CLOUD_ACCESS_TOKEN')
      );
    });

    it('should return hints for NETWORK_ERROR', () => {
      const hints = getConnectErrorHints('NETWORK_ERROR');
      expect(hints).toContainEqual(expect.stringContaining('internet'));
    });

    it('should return default hints for UNKNOWN', () => {
      const hints = getConnectErrorHints('UNKNOWN');
      expect(hints).toContainEqual(expect.stringContaining('unexpected error'));
    });
  });
});
