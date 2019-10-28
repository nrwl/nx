/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { tags } from '@angular-devkit/core';
import { AugmentIndexHtmlOptions, FileInfo, augmentIndexHtml } from './augment-index-html';

describe('augment-index-html', () => {
  const indexGeneratorOptions: AugmentIndexHtmlOptions = {
    input: 'index.html',
    inputContent: '<html><head></head><body></body></html>',
    baseHref: '/',
    sri: false,
    files: [],
    loadOutputFile: async (_fileName: string) => '',
    entrypoints: ['scripts', 'polyfills', 'main', 'styles'],
  };

  const oneLineHtml = (html: TemplateStringsArray) =>
    tags.stripIndents`${html}`.replace(/(\>\s+)/g, '>');

  it('can generate index.html', async () => {
    const source = augmentIndexHtml({
      ...indexGeneratorOptions,
      files: [
        { file: 'styles.css', extension: '.css', name: 'styles' },
        { file: 'runtime.js', extension: '.js', name: 'main' },
        { file: 'main.js', extension: '.js', name: 'main' },
        { file: 'runtime.js', extension: '.js', name: 'polyfills' },
        { file: 'polyfills.js', extension: '.js', name: 'polyfills' },
      ],
    });

    const html = await source;
    expect(html).toEqual(oneLineHtml`
      <html>
        <head><base href="/">
          <link rel="stylesheet" href="styles.css">
        </head>
        <body>
          <script src="runtime.js" defer></script>
          <script src="polyfills.js" defer></script>
          <script src="main.js" defer></script>
        </body>
      </html>
    `);
  });

  it(`should emit correct script tags when having 'module' and 'non-module' js`, async () => {
    const es2015JsFiles: FileInfo[] = [
      { file: 'runtime-es2015.js', extension: '.js', name: 'main' },
      { file: 'main-es2015.js', extension: '.js', name: 'main' },
      { file: 'runtime-es2015.js', extension: '.js', name: 'polyfills' },
      { file: 'polyfills-es2015.js', extension: '.js', name: 'polyfills' },
    ];

    const es5JsFiles: FileInfo[] = [
      { file: 'runtime-es5.js', extension: '.js', name: 'main' },
      { file: 'main-es5.js', extension: '.js', name: 'main' },
      { file: 'runtime-es5.js', extension: '.js', name: 'polyfills' },
      { file: 'polyfills-es5.js', extension: '.js', name: 'polyfills' },
    ];

    const source = augmentIndexHtml({
      ...indexGeneratorOptions,
      files: [
        { file: 'styles.css', extension: '.css', name: 'styles' },
        { file: 'styles.css', extension: '.css', name: 'styles' },
      ],
      moduleFiles: es2015JsFiles,
      noModuleFiles: es5JsFiles,
    });

    const html = await source;
    expect(html).toEqual(oneLineHtml`
      <html>
        <head>
          <base href="/">
          <link rel="stylesheet" href="styles.css">
        </head>
        <body>
          <script src="runtime-es2015.js" type="module"></script>
          <script src="polyfills-es2015.js" type="module"></script>
          <script src="runtime-es5.js" nomodule defer></script>
          <script src="polyfills-es5.js" nomodule defer></script>
          <script src="main-es2015.js" type="module"></script>
          <script src="main-es5.js" nomodule defer></script>
        </body>
      </html>
    `);
  });

  it(
    `should not add 'module' and 'non-module' attr to js files which are in both module formats`,
    async () => {
      const es2015JsFiles: FileInfo[] = [
        { file: 'scripts.js', extension: '.js', name: 'scripts' },
        { file: 'main-es2015.js', extension: '.js', name: 'main' },
      ];

      const es5JsFiles: FileInfo[] = [
        { file: 'scripts.js', extension: '.js', name: 'scripts' },
        { file: 'main-es5.js', extension: '.js', name: 'main' },
      ];

      const source = augmentIndexHtml({
        ...indexGeneratorOptions,
        files: [
          { file: 'styles.css', extension: '.css', name: 'styles' },
          { file: 'styles.css', extension: '.css', name: 'styles' },
        ],
        moduleFiles: es2015JsFiles,
        noModuleFiles: es5JsFiles,
      });

      const html = await source;
      expect(html).toEqual(oneLineHtml`
      <html>
        <head>
          <base href="/">
          <link rel="stylesheet" href="styles.css">
        </head>
        <body>
          <script src="scripts.js" defer></script>
          <script src="main-es2015.js" type="module"></script>
          <script src="main-es5.js" nomodule defer></script>
        </body>
      </html>
    `);
    });

});
