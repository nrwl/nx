import { replaceEnvVarsWithinEnv } from './executor-utils';

describe('Test options utils', () => {
  describe('replaceEnvVarsWithinEnv', () => {
    let originalProcessEnv;

    beforeEach(() => {
      originalProcessEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalProcessEnv;
    });

    it('should correctly replace environment variables within other environment variables', () => {
      process.env.VITE_KEY = '123';
      process.env.VITE_KEY1 = 'test$foo';
      process.env.VITE_KEY2 = 'test\\$foo';
      process.env.VITE_KEY3 = 'test$VITE_KEY';
      process.env.VITE_KEY4 = 'HELLO';
      process.env.VITE_API_PATH = '/api/v2/$VITE_KEY';
      process.env.NX_API_PATH = '/api/v2/$VITE_KEY';

      replaceEnvVarsWithinEnv();

      expect(process.env.VITE_KEY).toBe('123');
      expect(process.env.VITE_KEY1).toBe('test');
      expect(process.env.VITE_KEY2).toBe('test$foo');
      expect(process.env.VITE_KEY3).toBe('test123');
      expect(process.env.VITE_KEY4).toBe('HELLO');
      expect(process.env.VITE_API_PATH).toBe('/api/v2/123');
      expect(process.env.NX_API_PATH).toBe('/api/v2/$VITE_KEY');
    });
  });
});
