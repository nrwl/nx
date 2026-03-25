import { getGraphTimeoutMs } from './get-project-graph-lines';

describe('get-project-graph-lines', () => {
  describe('getGraphTimeoutMs', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.NX_PLUGIN_NO_TIMEOUTS;
      delete process.env.NX_GRADLE_GRAPH_TIMEOUT;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return 30000ms by default', () => {
      expect(getGraphTimeoutMs()).toBe(30_000);
    });

    it('should return undefined when NX_PLUGIN_NO_TIMEOUTS is true', () => {
      process.env.NX_PLUGIN_NO_TIMEOUTS = 'true';
      expect(getGraphTimeoutMs()).toBeUndefined();
    });

    it('should use NX_GRADLE_GRAPH_TIMEOUT when set', () => {
      process.env.NX_GRADLE_GRAPH_TIMEOUT = '60';
      expect(getGraphTimeoutMs()).toBe(60_000);
    });

    it('should fall back to default for invalid NX_GRADLE_GRAPH_TIMEOUT', () => {
      process.env.NX_GRADLE_GRAPH_TIMEOUT = 'abc';
      expect(getGraphTimeoutMs()).toBe(30_000);
    });

    it('should fall back to default for negative NX_GRADLE_GRAPH_TIMEOUT', () => {
      process.env.NX_GRADLE_GRAPH_TIMEOUT = '-5';
      expect(getGraphTimeoutMs()).toBe(30_000);
    });

    it('should fall back to default for zero NX_GRADLE_GRAPH_TIMEOUT', () => {
      process.env.NX_GRADLE_GRAPH_TIMEOUT = '0';
      expect(getGraphTimeoutMs()).toBe(30_000);
    });

    it('should prioritize NX_PLUGIN_NO_TIMEOUTS over NX_GRADLE_GRAPH_TIMEOUT', () => {
      process.env.NX_PLUGIN_NO_TIMEOUTS = 'true';
      process.env.NX_GRADLE_GRAPH_TIMEOUT = '60';
      expect(getGraphTimeoutMs()).toBeUndefined();
    });
  });
});
