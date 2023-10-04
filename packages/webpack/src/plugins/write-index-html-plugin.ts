import * as webpack from 'webpack';
import { Compiler } from 'webpack';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

import { EmittedFile, ExtraEntryPoint } from '../utils/models';
import { interpolateEnvironmentVariablesToIndex } from '../utils/webpack/interpolate-env-variables-to-index';
import { generateEntryPoints } from '../utils/webpack/package-chunk-sort';
import { extname } from 'path';

const parse5 = require('parse5');

export interface WriteIndexHtmlOptions {
  indexPath: string;
  outputPath: string;
  baseHref?: string;
  deployUrl?: string;
  sri?: boolean;
  scripts?: ExtraEntryPoint[];
  styles?: ExtraEntryPoint[];
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
}

export class WriteIndexHtmlPlugin {
  constructor(private readonly options: WriteIndexHtmlOptions) {}

  apply(compiler: Compiler) {
    const {
      outputPath,
      indexPath,
      baseHref,
      deployUrl,
      sri = false,
      scripts = [],
      styles = [],
      crossOrigin,
    } = this.options;
    compiler.hooks.thisCompilation.tap(
      'WriteIndexHtmlPlugin',
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'WriteIndexHtmlPlugin',
            // After minification and sourcemaps are done
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
          },
          () => {
            const moduleFiles = this.getEmittedFiles(compilation);
            const files = moduleFiles.filter((x) => x.extension === '.css');
            let content = readFileSync(indexPath).toString();
            content = this.stripBom(content);
            compilation.assets[outputPath] = this.augmentIndexHtml({
              input: outputPath,
              inputContent: interpolateEnvironmentVariablesToIndex(
                content,
                deployUrl
              ),
              baseHref,
              deployUrl,
              crossOrigin,
              sri,
              entrypoints: generateEntryPoints({ scripts, styles }),
              files: this.filterAndMapBuildFiles(files, ['.js', '.css']),
              moduleFiles: this.filterAndMapBuildFiles(moduleFiles, ['.js']),
              loadOutputFile: (filePath) =>
                compilation.assets[filePath].source().toString(),
            });
          }
        );
      }
    );
  }

  private getEmittedFiles(compilation: webpack.Compilation): EmittedFile[] {
    const files: EmittedFile[] = [];
    // adds all chunks to the list of emitted files such as lazy loaded modules
    for (const chunk of compilation.chunks) {
      for (const file of chunk.files) {
        files.push({
          // The id is guaranteed to exist at this point in the compilation process
          // tslint:disable-next-line: no-non-null-assertion
          id: chunk.id.toString(),
          name: chunk.name,
          file,
          extension: extname(file),
          initial: chunk.isOnlyInitial(),
        });
      }
    }
    // other all files
    for (const file of Object.keys(compilation.assets)) {
      files.push({
        file,
        extension: extname(file),
        initial: false,
        asset: true,
      });
    }
    // dedupe
    return files.filter(
      ({ file, name }, index) =>
        files.findIndex(
          (f) => f.file === file && (!name || name === f.name)
        ) === index
    );
  }

  private stripBom(data: string) {
    return data.replace(/^\uFEFF/, '');
  }

  private augmentIndexHtml(params: {
    /* Input file name (e. g. index.html) */
    input: string;
    /* Input contents */
    inputContent: string;
    baseHref?: string;
    deployUrl?: string;
    sri: boolean;
    /** crossorigin attribute setting of elements that provide CORS support */
    crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
    /*
     * Files emitted by the build.
     */
    files: {
      file: string;
      name: string;
      extension: string;
    }[];
    /** Files that should be added using 'module'. */
    moduleFiles?: {
      file: string;
      name: string;
      extension: string;
    }[];
    /*
     * Function that loads a file used.
     * This allows us to use different routines within the IndexHtmlWebpackPlugin and
     * when used without this plugin.
     */
    loadOutputFile: (file: string) => string;
    /** Used to sort the inseration of files in the HTML file */
    entrypoints: string[];
  }): webpack.sources.Source {
    const { loadOutputFile, files, moduleFiles = [], entrypoints } = params;

    let { crossOrigin = 'none' } = params;
    if (params.sri && crossOrigin === 'none') {
      crossOrigin = 'anonymous';
    }

    const stylesheets = new Set<string>();
    const scripts = new Set<string>();

    // Sort files in the order we want to insert them by entrypoint and dedupes duplicates
    const mergedFiles = [...moduleFiles, ...files];
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
    const document = parse5.parse(params.inputContent, {
      treeAdapter,
      locationInfo: true,
    });
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
    const indexSource = new webpack.sources.ReplaceSource(
      new webpack.sources.RawSource(params.inputContent, false),
      params.input
    );

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
      const scriptPredictor = ({
        file,
      }: {
        file: string;
        name: string;
        extension: string;
      }): boolean => file === script;
      if (!files.some(scriptPredictor)) {
        // in some cases for differential loading file with the same name is avialable in both
        // nomodule and module such as scripts.js
        // we shall not add these attributes if that's the case
        const isModuleType = moduleFiles.some(scriptPredictor);

        if (isModuleType) {
          attrs.push({ name: 'type', value: 'module' });
        } else {
          attrs.push({ name: 'defer', value: null });
        }
      } else {
        attrs.push({ name: 'type', value: 'module' });
      }

      if (params.sri) {
        const content = loadOutputFile(script);
        attrs.push(...this.generateSriAttributes(content));
      }

      const attributes = attrs
        .map((attr) =>
          attr.value === null ? attr.name : `${attr.name}="${attr.value}"`
        )
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
          parse5.serialize(baseFragment, { treeAdapter })
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
          parse5.serialize(baseFragment, { treeAdapter })
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
        const content = loadOutputFile(stylesheet);
        attrs.push(...this.generateSriAttributes(content));
      }

      const element = treeAdapter.createElement('link', undefined, attrs);
      treeAdapter.appendChild(styleElements, element);
    }

    indexSource.insert(
      styleInsertionPoint,
      parse5.serialize(styleElements, { treeAdapter })
    );

    return indexSource;
  }

  private generateSriAttributes(content: string) {
    const algo = 'sha384';
    const hash = createHash(algo).update(content, 'utf8').digest('base64');

    return [{ name: 'integrity', value: `${algo}-${hash}` }];
  }

  private filterAndMapBuildFiles(
    files: EmittedFile[],
    extensionFilter: string[]
  ): {
    file: string;
    name: string;
    extension: string;
  }[] {
    const filteredFiles: {
      file: string;
      name: string;
      extension: string;
    }[] = [];

    // This test excludes files generated by HMR (e.g. main.hot-update.js).
    const hotUpdateAsset = /hot-update\.[cm]?js$/;

    for (const { file, name, extension, initial } of files) {
      if (
        name &&
        initial &&
        extensionFilter.includes(extension) &&
        !hotUpdateAsset.test(file)
      ) {
        filteredFiles.push({ file, extension, name });
      }
    }
    return filteredFiles;
  }
}
