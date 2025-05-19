const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
            '{projectRoot}/vitest*.config.{js,ts,mjs,mts}',
          ],
          ignoredDependencies: [
            'css-loader',
            'less-loader',
            'sass-loader',
            'sass-embedded',
            '@angular/core',
            'rxjs',
            '@ng-rspack/build',
            'postcss-loader',
            '@code-pushup/models',
            '@code-pushup/utils',
            'jsonc-eslint-parser',
            'vitest',
            // it's only a type import, so it won't be required at runtime
            'sass',
            // shown as unused because it's required using `createRequire`
            'tailwindcss',
          ],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
];
