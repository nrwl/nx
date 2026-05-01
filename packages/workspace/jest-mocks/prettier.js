const path = require('path');

const prettierDir = path.dirname(
  require.resolve('prettier', {
    paths: [path.join(__dirname, '../../../node_modules')],
  })
);

// Load standalone prettier (no dynamic imports)
const standalone = require(path.join(prettierDir, 'standalone.js'));

// Pre-load CJS parser plugins (no dynamic imports)
const pluginNames = [
  'babel',
  'estree',
  'typescript',
  'html',
  'postcss',
  'markdown',
  'angular',
  'yaml',
];
const plugins = pluginNames.map((name) =>
  require(path.join(prettierDir, 'plugins', `${name}.js`))
);

const prettierMock = {
  ...standalone,
  resolveConfig: async () => null,
  resolveConfigFile: async () => null,
  clearConfigCache: () => {},
  getFileInfo: async (filePath) => {
    const ext = path.extname(filePath);
    const parserMap = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'babel',
      '.jsx': 'babel',
      '.mjs': 'babel',
      '.cjs': 'babel',
      '.json': 'json',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.html': 'html',
      '.md': 'markdown',
      '.yaml': 'yaml',
      '.yml': 'yaml',
    };
    return { ignored: false, inferredParser: parserMap[ext] || null };
  },
  async format(source, options = {}) {
    try {
      return await standalone.format(source, {
        ...options,
        plugins: [...plugins, ...(options.plugins || [])],
      });
    } catch (e) {
      return source;
    }
  },
  async check(source, options = {}) {
    try {
      return await standalone.check(source, {
        ...options,
        plugins: [...plugins, ...(options.plugins || [])],
      });
    } catch (e) {
      return true;
    }
  },
  async formatWithCursor(source, options = {}) {
    try {
      return await standalone.formatWithCursor(source, {
        ...options,
        plugins: [...plugins, ...(options.plugins || [])],
      });
    } catch (e) {
      return { formatted: source, cursorOffset: options.cursorOffset || 0 };
    }
  },
};

const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return prettierMock;
    return prettierMock[prop];
  },
  has(target, prop) {
    return prop === '__esModule' || prop === 'default' || prop in prettierMock;
  },
  ownKeys() {
    return [...Object.keys(prettierMock), '__esModule', 'default'];
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop === '__esModule')
      return { configurable: true, enumerable: true, value: true };
    if (prop === 'default')
      return { configurable: true, enumerable: true, value: prettierMock };
    if (prop in prettierMock)
      return {
        configurable: true,
        enumerable: true,
        value: prettierMock[prop],
      };
    return undefined;
  },
};

module.exports = new Proxy({}, handler);
