import * as fs from 'fs';
import { join } from 'path';
import { interpolateEnvironmentVariablesToIndex } from '../../../interpolate-env-variables-to-index';
import {
  augmentIndexHtml,
  CrossOriginValue,
  FileInfo,
} from './augment-index-html';

function stripBom(data: string) {
  return data.replace(/^\uFEFF/, '');
}

type IndexHtmlGeneratorPlugin = (
  html: string,
  options: IndexHtmlGeneratorProcessOptions
) => Promise<string | IndexHtmlTransformResult>;

export interface IndexHtmlGeneratorProcessOptions {
  lang?: string | undefined;
  baseHref?: string | undefined;
  outputPath: string;
  files: FileInfo[];
  noModuleFiles: FileInfo[];
  moduleFiles: FileInfo[];
}

export interface IndexHtmlGeneratorOptions {
  indexPath: string;
  deployUrl?: string;
  sri?: boolean;
  entrypoints: string[];
  postTransform?: IndexHtmlTransform;
  crossOrigin?: CrossOriginValue;
  optimization?: any;
  WOFFSupportNeeded?: boolean;
}

export type IndexHtmlTransform = (content: string) => Promise<string>;

export interface IndexHtmlTransformResult {
  content: string;
  warnings: string[];
  errors: string[];
}

export class IndexHtmlGenerator {
  private readonly plugins: IndexHtmlGeneratorPlugin[];

  constructor(readonly options: IndexHtmlGeneratorOptions) {
    const extraPlugins: IndexHtmlGeneratorPlugin[] = [];
    this.plugins = [
      augmentIndexHtmlPlugin(this),
      ...extraPlugins,
      postTransformPlugin(this),
    ];
  }

  async process(
    options: IndexHtmlGeneratorProcessOptions
  ): Promise<IndexHtmlTransformResult> {
    let content = stripBom(await this.readIndex(this.options.indexPath));
    content = interpolateEnvironmentVariablesToIndex(
      content,
      this.options.deployUrl
    );
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const plugin of this.plugins) {
      const result = await plugin(content, options);
      if (typeof result === 'string') {
        content = result;
      } else {
        content = result.content;

        if (result.warnings.length) {
          warnings.push(...result.warnings);
        }

        if (result.errors.length) {
          errors.push(...result.errors);
        }
      }
    }

    return {
      content,
      warnings,
      errors,
    };
  }

  async readAsset(path: string): Promise<string> {
    return fs.promises.readFile(path, 'utf-8');
  }

  protected async readIndex(path: string): Promise<string> {
    return fs.promises.readFile(path, 'utf-8');
  }
}

function augmentIndexHtmlPlugin(
  generator: IndexHtmlGenerator
): IndexHtmlGeneratorPlugin {
  const {
    deployUrl,
    crossOrigin,
    sri = false,
    entrypoints,
  } = generator.options;

  return async (html, options) => {
    const {
      lang,
      baseHref,
      outputPath = '',
      noModuleFiles,
      files,
      moduleFiles,
    } = options;

    return augmentIndexHtml({
      html,
      baseHref,
      deployUrl,
      crossOrigin,
      sri,
      lang,
      entrypoints,
      loadOutputFile: (filePath) =>
        generator.readAsset(join(outputPath, filePath)),
      noModuleFiles,
      moduleFiles,
      files,
    });
  };
}

function postTransformPlugin({
  options,
}: IndexHtmlGenerator): IndexHtmlGeneratorPlugin {
  return async (html) =>
    options.postTransform ? options.postTransform(html) : html;
}
