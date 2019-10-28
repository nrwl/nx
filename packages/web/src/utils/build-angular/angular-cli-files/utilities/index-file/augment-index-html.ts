/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { createHash } from 'crypto';
import { RawSource, ReplaceSource } from 'webpack-sources';

const parse5 = require('parse5');

export type LoadOutputFileFunctionType = (file: string) => Promise<string>;

export type CrossOriginValue = 'none' | 'anonymous' | 'use-credentials';

export interface AugmentIndexHtmlOptions {
  /* Input file name (e. g. index.html) */
  input: string;
  /* Input contents */
  inputContent: string;
  baseHref?: string;
  deployUrl?: string;
  sri: boolean;
  /** crossorigin attribute setting of elements that provide CORS support */
  crossOrigin?: CrossOriginValue;
  /*
   * Files emitted by the build.
   * Js files will be added without 'nomodule' nor 'module'.
   */
  files: FileInfo[];
  /** Files that should be added using 'nomodule'. */
  noModuleFiles?: FileInfo[];
  /** Files that should be added using 'module'. */
  moduleFiles?: FileInfo[];
  /*
   * Function that loads a file used.
   * This allows us to use different routines within the IndexHtmlWebpackPlugin and
   * when used without this plugin.
   */
  loadOutputFile: LoadOutputFileFunctionType;
  /** Used to sort the inseration of files in the HTML file */
  entrypoints: string[];
}

export interface FileInfo {
  file: string;
  name: string;
  extension: string;
}

/*
 * Helper function used by the IndexHtmlWebpackPlugin.
 * Can also be directly used by builder, e. g. in order to generate an index.html
 * after processing several configurations in order to build different sets of
 * bundles for differential serving.
 */
export async function augmentIndexHtml(params: AugmentIndexHtmlOptions): Promise<string> {
  const { loadOutputFile, files, noModuleFiles = [], moduleFiles = [], entrypoints } = params;

  let { crossOrigin = 'none' } = params;
  if (params.sri && crossOrigin === 'none') {
    crossOrigin = 'anonymous';
  }

  const stylesheets = new Set<string>();
  const scripts = new Set<string>();

  // Sort files in the order we want to insert them by entrypoint and dedupes duplicates
  const mergedFiles = [...moduleFiles, ...noModuleFiles, ...files];
  for (const entrypoint of entrypoints) {
    for (const { extension, file, name } of mergedFiles) {
      if (name !== entrypoint) {
        continue;
      }

      switch (extension) {
        case '.js':
          scripts.add(file);
          break;
        case '.css':
          stylesheets.add(file);
          break;
      }
    }
  }

  // Find the head and body elements
  const treeAdapter = parse5.treeAdapters.default;
  const document = parse5.parse(params.inputContent, { treeAdapter, locationInfo: true });
  let headElement;
  let bodyElement;
  for (const docChild of document.childNodes) {
    if (docChild.tagName === 'html') {
      for (const htmlChild of docChild.childNodes) {
        if (htmlChild.tagName === 'head') {
          headElement = htmlChild;
        } else if (htmlChild.tagName === 'body') {
          bodyElement = htmlChild;
        }
      }
    }
  }

  if (!headElement || !bodyElement) {
    throw new Error('Missing head and/or body elements');
  }

  // Determine script insertion point
  let scriptInsertionPoint;
  if (bodyElement.__location && bodyElement.__location.endTag) {
    scriptInsertionPoint = bodyElement.__location.endTag.startOffset;
  } else {
    // Less accurate fallback
    // parse5 4.x does not provide locations if malformed html is present
    scriptInsertionPoint = params.inputContent.indexOf('</body>');
  }

  let styleInsertionPoint;
  if (headElement.__location && headElement.__location.endTag) {
    styleInsertionPoint = headElement.__location.endTag.startOffset;
  } else {
    // Less accurate fallback
    // parse5 4.x does not provide locations if malformed html is present
    styleInsertionPoint = params.inputContent.indexOf('</head>');
  }

  // Inject into the html
  const indexSource = new ReplaceSource(new RawSource(params.inputContent), params.input);

  let scriptElements = '';
  for (const script of scripts) {
    const attrs: { name: string; value: string | null }[] = [
      { name: 'src', value: (params.deployUrl || '') + script },
    ];

    if (crossOrigin !== 'none') {
      attrs.push({ name: 'crossorigin', value: crossOrigin });
    }

    // We want to include nomodule or module when a file is not common amongs all
    // such as runtime.js
    const scriptPredictor = ({ file }: FileInfo): boolean => file === script;
    if (!files.some(scriptPredictor)) {
      // in some cases for differential loading file with the same name is avialable in both
      // nomodule and module such as scripts.js
      // we shall not add these attributes if that's the case
      const isNoModuleType = noModuleFiles.some(scriptPredictor);
      const isModuleType = moduleFiles.some(scriptPredictor);

      if (isNoModuleType && !isModuleType) {
        attrs.push({ name: 'nomodule', value: null });
        if (!script.startsWith('polyfills-nomodule-es5')) {
          attrs.push({ name: 'defer', value: null });
        }
      } else if (isModuleType && !isNoModuleType) {
        attrs.push({ name: 'type', value: 'module' });
      } else {
        attrs.push({ name: 'defer', value: null });
      }
    } else {
      attrs.push({ name: 'defer', value: null });
    }

    if (params.sri) {
      const content = await loadOutputFile(script);
      attrs.push(..._generateSriAttributes(content));
    }

    const attributes = attrs
      .map(attr => (attr.value === null ? attr.name : `${attr.name}="${attr.value}"`))
      .join(' ');
    scriptElements += `<script ${attributes}></script>`;
  }

  indexSource.insert(scriptInsertionPoint, scriptElements);

  // Adjust base href if specified
  if (typeof params.baseHref == 'string') {
    let baseElement;
    for (const headChild of headElement.childNodes) {
      if (headChild.tagName === 'base') {
        baseElement = headChild;
      }
    }

    const baseFragment = treeAdapter.createDocumentFragment();

    if (!baseElement) {
      baseElement = treeAdapter.createElement('base', undefined, [
        { name: 'href', value: params.baseHref },
      ]);

      treeAdapter.appendChild(baseFragment, baseElement);
      indexSource.insert(
        headElement.__location.startTag.endOffset,
        parse5.serialize(baseFragment, { treeAdapter }),
      );
    } else {
      let hrefAttribute;
      for (const attribute of baseElement.attrs) {
        if (attribute.name === 'href') {
          hrefAttribute = attribute;
        }
      }
      if (hrefAttribute) {
        hrefAttribute.value = params.baseHref;
      } else {
        baseElement.attrs.push({ name: 'href', value: params.baseHref });
      }

      treeAdapter.appendChild(baseFragment, baseElement);
      indexSource.replace(
        baseElement.__location.startOffset,
        baseElement.__location.endOffset,
        parse5.serialize(baseFragment, { treeAdapter }),
      );
    }
  }

  const styleElements = treeAdapter.createDocumentFragment();
  for (const stylesheet of stylesheets) {
    const attrs = [
      { name: 'rel', value: 'stylesheet' },
      { name: 'href', value: (params.deployUrl || '') + stylesheet },
    ];

    if (crossOrigin !== 'none') {
      attrs.push({ name: 'crossorigin', value: crossOrigin });
    }

    if (params.sri) {
      const content = await loadOutputFile(stylesheet);
      attrs.push(..._generateSriAttributes(content));
    }

    const element = treeAdapter.createElement('link', undefined, attrs);
    treeAdapter.appendChild(styleElements, element);
  }

  indexSource.insert(styleInsertionPoint, parse5.serialize(styleElements, { treeAdapter }));

  return indexSource.source();
}

function _generateSriAttributes(content: string) {
  const algo = 'sha384';
  const hash = createHash(algo)
    .update(content, 'utf8')
    .digest('base64');

  return [{ name: 'integrity', value: `${algo}-${hash}` }];
}
