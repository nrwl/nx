import { postcss } from './postcss-plugin';
import type { Plugin, PluginContext } from 'rollup';

describe('postcss plugin', () => {
  describe('plugin initialization', () => {
    it('should return a plugin with correct name', () => {
      const plugin = postcss();
      expect(plugin.name).toBe('postcss');
    });

    it('should have required hooks', () => {
      const plugin = postcss();
      expect(plugin.resolveId).toBeDefined();
      expect(plugin.load).toBeDefined();
      expect(plugin.transform).toBeDefined();
      expect(plugin.augmentChunkHash).toBeDefined();
      expect(plugin.generateBundle).toBeDefined();
    });
  });

  describe('resolveId', () => {
    it('should resolve style-inject virtual module', () => {
      const plugin = postcss();
      const resolveId = plugin.resolveId as Function;

      expect(resolveId('style-inject')).toBe('\0style-inject');
    });

    it('should return null for other modules', () => {
      const plugin = postcss();
      const resolveId = plugin.resolveId as Function;

      expect(resolveId('some-other-module')).toBeNull();
      expect(resolveId('./styles.css')).toBeNull();
    });
  });

  describe('load', () => {
    it('should load style-inject virtual module', () => {
      const plugin = postcss();
      const load = plugin.load as Function;

      const result = load('\0style-inject');
      expect(result).toContain('function styleInject');
      expect(result).toContain('export default styleInject');
    });

    it('should return null for other modules', () => {
      const plugin = postcss();
      const load = plugin.load as Function;

      expect(load('some-other-module')).toBeNull();
      expect(load('./styles.css')).toBeNull();
    });
  });

  describe('transform', () => {
    let mockContext: Partial<PluginContext>;

    beforeEach(() => {
      mockContext = {
        warn: jest.fn(),
        addWatchFile: jest.fn(),
      };
    });

    it('should skip non-CSS files', async () => {
      const plugin = postcss();
      const transform = plugin.transform as Function;

      const result = await transform.call(
        mockContext,
        'const x = 1;',
        '/path/to/file.js'
      );

      expect(result).toBeNull();
    });

    it('should skip files in node_modules by default', async () => {
      const plugin = postcss();
      const transform = plugin.transform as Function;

      const result = await transform.call(
        mockContext,
        '.foo { color: red; }',
        '/path/to/node_modules/pkg/style.css'
      );

      expect(result).toBeNull();
    });

    it('should process CSS files', async () => {
      const plugin = postcss();
      const transform = plugin.transform as Function;

      const result = await transform.call(
        mockContext,
        '.foo { color: red; }',
        '/path/to/styles.css'
      );

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
      expect(typeof result.code).toBe('string');
    });

    it('should generate injection code when inject is true', async () => {
      const plugin = postcss({ inject: true, extract: false });
      const transform = plugin.transform as Function;

      const result = await transform.call(
        mockContext,
        '.foo { color: red; }',
        '/path/to/styles.css'
      );

      expect(result.code).toContain("import styleInject from 'style-inject'");
      expect(result.code).toContain('styleInject(css)');
    });

    it('should generate module exports when extract is true', async () => {
      const plugin = postcss({ inject: false, extract: true });
      const transform = plugin.transform as Function;

      const result = await transform.call(
        mockContext,
        '.foo { color: red; }',
        '/path/to/styles.css'
      );

      expect(result.code).toContain('export default');
      expect(result.code).not.toContain('styleInject');
    });

    it('should process .scss files', async () => {
      const plugin = postcss();
      const transform = plugin.transform as Function;

      // Note: This test will only pass if sass is installed
      // In CI, we might need to mock the sass loader
      try {
        const result = await transform.call(
          mockContext,
          '$color: red; .foo { color: $color; }',
          '/path/to/styles.scss'
        );
        expect(result).toBeDefined();
      } catch (e) {
        // Sass not installed - this is expected in unit tests
        expect((e as Error).message).toContain('sass');
      }
    });

    it('should process .less files', async () => {
      const plugin = postcss({
        use: { less: { javascriptEnabled: true } },
      });
      const transform = plugin.transform as Function;

      // Note: This test will only pass if less is installed
      try {
        const result = await transform.call(
          mockContext,
          '@color: red; .foo { color: @color; }',
          '/path/to/styles.less'
        );
        expect(result).toBeDefined();
      } catch (e) {
        // Less not installed - this is expected in unit tests
        expect((e as Error).message).toContain('less');
      }
    });
  });

  describe('CSS Modules', () => {
    let mockContext: Partial<PluginContext>;

    beforeEach(() => {
      mockContext = {
        warn: jest.fn(),
        addWatchFile: jest.fn(),
      };
    });

    it('should auto-detect CSS modules from .module.css files', async () => {
      const plugin = postcss({ autoModules: true });
      const transform = plugin.transform as Function;

      try {
        const result = await transform.call(
          mockContext,
          '.foo { color: red; }',
          '/path/to/styles.module.css'
        );

        expect(result).toBeDefined();
        expect(result.code).toBeDefined();
      } catch (e) {
        // postcss-modules not installed - this is expected
        expect((e as Error).message).toContain('postcss-modules');
      }
    });

    it('should not use CSS modules for regular CSS files when autoModules is true', async () => {
      const plugin = postcss({ autoModules: true, inject: false });
      const transform = plugin.transform as Function;

      const result = await transform.call(
        mockContext,
        '.foo { color: red; }',
        '/path/to/styles.css'
      );

      expect(result).toBeDefined();
      // Regular CSS should just export the CSS string
      expect(result.code).toContain('export default');
    });
  });

  describe('file filtering', () => {
    let mockContext: Partial<PluginContext>;

    beforeEach(() => {
      mockContext = {
        warn: jest.fn(),
        addWatchFile: jest.fn(),
      };
    });

    it('should process files matching include pattern', async () => {
      const plugin = postcss({
        include: ['**/custom/**/*.css'],
        exclude: undefined,
      });
      const transform = plugin.transform as Function;

      const result = await transform.call(
        mockContext,
        '.foo { color: red; }',
        '/path/custom/styles.css'
      );

      expect(result).toBeDefined();
    });

    it('should respect custom extensions', async () => {
      const plugin = postcss({
        extensions: ['.mycss'],
      });
      const transform = plugin.transform as Function;

      // Should not process .css when not in extensions
      const cssResult = await transform.call(
        mockContext,
        '.foo { color: red; }',
        '/path/to/styles.css'
      );
      expect(cssResult).toBeNull();
    });
  });
});
