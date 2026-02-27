import { Loaders } from './index';
import type { LoaderContext } from './types';

describe('Loaders', () => {
  const createMockContext = (): LoaderContext => ({
    id: '/path/to/file.css',
    sourceMap: false,
    dependencies: new Set(),
    warn: jest.fn(),
  });

  describe('isSupported', () => {
    it('should support CSS files', () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {},
      });

      expect(loaders.isSupported('/path/to/styles.css')).toBe(true);
    });

    it('should support SCSS files', () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {},
      });

      expect(loaders.isSupported('/path/to/styles.scss')).toBe(true);
    });

    it('should support SASS files', () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {},
      });

      expect(loaders.isSupported('/path/to/styles.sass')).toBe(true);
    });

    it('should support Less files', () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {},
      });

      expect(loaders.isSupported('/path/to/styles.less')).toBe(true);
    });

    it('should support Stylus files', () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {},
      });

      expect(loaders.isSupported('/path/to/styles.styl')).toBe(true);
      expect(loaders.isSupported('/path/to/styles.stylus')).toBe(true);
    });

    it('should not support JS files', () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {},
      });

      expect(loaders.isSupported('/path/to/script.js')).toBe(false);
    });

    it('should not support TypeScript files', () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {},
      });

      expect(loaders.isSupported('/path/to/script.ts')).toBe(false);
    });
  });

  describe('process', () => {
    it('should process plain CSS', async () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {},
      });

      const context = createMockContext();
      const result = await loaders.process('.foo { color: red; }', context);

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
      expect(typeof result.code).toBe('string');
    });

    it('should generate inject code when inject is true', async () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {},
      });

      const context = createMockContext();
      const result = await loaders.process('.foo { color: red; }', context);

      expect(result.code).toContain('styleInject');
    });

    it('should generate extract code when extract is true', async () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: true,
          inject: false,
        },
        use: {},
      });

      const context = createMockContext();
      const result = await loaders.process('.foo { color: red; }', context);

      expect(result.extracted).toBeDefined();
      expect(result.extracted?.code).toContain('.foo');
    });

    it('should disable specific preprocessors when set to false', () => {
      const loaders = new Loaders({
        postcss: {
          plugins: [],
          modules: false,
          autoModules: false,
          extract: false,
          inject: true,
        },
        use: {
          less: false,
          sass: false,
          stylus: false,
        },
      });

      // When preprocessors are disabled, the loaders should still support CSS
      expect(loaders.isSupported('/path/to/styles.css')).toBe(true);
    });
  });
});
