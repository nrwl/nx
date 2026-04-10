---
title: 'createConfig - @nx/angular-rspack'
description: 'API Reference for createConfig from @nx/angular-rspack'
---

# createConfig

```bash
import { createConfig } from '@nx/angular-rspack';
```

The `createConfig` function is used to create an Rspack configuration object setup for Angular applications.

It takes an optional `Configuration` object as an argument, which allows for customization of the Rspack configuration.

```ts
async function createConfig(
  defaultOptions: {
    options: AngularRspackPluginOptions;
    rspackConfigOverrides?: Partial<Configuration>;
  },
  configurations: Record<
    string,
    {
      options: Partial<AngularRspackPluginOptions>;
      rspackConfigOverrides?: Partial<Configuration>;
    }
  > = {},
  configEnvVar = 'NGRS_CONFIG'
);
```

---

## Examples

{% tabs %}

{% tab label="Server-Side Rendering (SSR)" %}
The following example shows how to create a configuration for a SSR application:

```ts {% fileName="myapp/rspack.config.ts" %}
import { createConfig } from '@nx/angular-rspack';

export default createConfig({
  options: {
    browser: './src/main.ts',
    server: './src/main.server.ts',
    ssrEntry: './src/server.ts',
  },
});
```

{% /tab %}

{% tab label="Client-Side Rendering (CSR)" %}
The following example shows how to create a configuration for a CSR application:

```ts {% fileName="myapp/rspack.config.ts" %}
import { createConfig } from '@nx/angular-rspack';

export default createConfig({
  options: {
    browser: './src/main.ts',
  },
});
```

{% /tab %}

{% tab label="Modify Rspack Configuration" %}
The following example shows how to modify the base Rspack configuration:

```ts {% fileName="myapp/rspack.config.ts" %}
import { createConfig } from '@nx/angular-rspack';

export default createConfig({
  options: {
    browser: './src/main.ts',
    server: './src/main.server.ts',
    ssrEntry: './src/server.ts',
  },
  rspackConfigOverrides: {
    mode: 'development',
  },
});
```

{% /tab %}

{% tab label="File Replacements" %}
The following example shows how to use file replacements:

```ts {% fileName="myapp/rspack.config.ts" %}
import { createConfig } from '@nx/angular-rspack';

export default createConfig({
  options: {
    browser: './src/main.ts',
    server: './src/main.server.ts',
    ssrEntry: './src/server.ts',
    fileReplacements: [
      {
        replace: './src/environments/environment.ts',
        with: './src/environments/environment.prod.ts',
      },
    ],
  },
});
```

{% /tab %}

{% /tabs %}

---

## AngularRspackPluginOptions

The `AngularRspackPluginOptions` object is an object that contains the following properties:

```ts
export interface AngularRspackPluginOptions extends PluginUnsupportedOptions {
  aot?: boolean;
  assets?: AssetElement[];
  browser?: string;
  commonChunk?: boolean;
  devServer?: DevServerOptions;
  extractLicenses?: boolean;
  fileReplacements?: FileReplacement[];
  index?: IndexElement;
  inlineStyleLanguage?: InlineStyleLanguage;
  namedChunks?: boolean;
  optimization?: boolean | OptimizationOptions;
  outputHashing?: OutputHashing;
  outputPath?:
    | string
    | (Required<Pick<OutputPath, 'base'>> & Partial<OutputPath>);
  polyfills?: string[];
  root?: string;
  scripts?: ScriptOrStyleEntry[];
  server?: string;
  skipTypeChecking?: boolean;
  sourceMap?: boolean | Partial<SourceMap>;
  ssr?:
    | boolean
    | {
        entry: string;
        experimentalPlatform?: 'node' | 'neutral';
      };
  stylePreprocessorOptions?: StylePreprocessorOptions;
  styles?: ScriptOrStyleEntry[];
  tsConfig?: string;
  useTsProjectReferences?: boolean;
  vendorChunk?: boolean;
}

export interface DevServerOptions extends DevServerUnsupportedOptions {
  port?: number;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyConfig?: string;
}

export interface OptimizationOptions {
  scripts?: boolean;
  styles?: boolean;
  fonts?: boolean;
}

export type OutputHashing = 'none' | 'all' | 'media' | 'bundles';
export type HashFormat = {
  chunk: string;
  extract: string;
  file: string;
  script: string;
};

export interface OutputPath {
  base: string;
  browser: string;
  server: string;
  media: string;
}

export type AssetExpandedDefinition = {
  glob: string;
  input: string;
  ignore?: string[];
  output?: string;
};
export type AssetElement = AssetExpandedDefinition | string;
export type NormalizedAssetElement = AssetExpandedDefinition & {
  output: string;
};
export type ScriptOrStyleEntry =
  | string
  | {
      input: string;
      bundleName?: string;
      inject?: boolean;
    };
export type GlobalEntry = {
  name: string;
  files: string[];
  initial: boolean;
};
export type IndexExpandedDefinition = {
  input: string;
  output?: string;
  preloadInitial?: boolean;
};
export type IndexElement = IndexExpandedDefinition | string | false;
export type IndexHtmlTransform = (content: string) => Promise<string>;
export type NormalizedIndexElement =
  | (IndexExpandedDefinition & {
      insertionOrder: [string, boolean][];
      transformer: IndexHtmlTransform | undefined;
    })
  | false;

export interface SourceMap {
  scripts: boolean;
  styles: boolean;
  hidden: boolean;
  vendor: boolean;
}

export type InlineStyleExtension = 'css' | 'scss' | 'sass' | 'less';
export interface FileReplacement {
  replace: string;
  with: string;
}
export interface StylePreprocessorOptions {
  includePaths?: string[];
  sass?: Sass;
}
export interface Sass {
  fatalDeprecations?: DeprecationOrId[];
  futureDeprecations?: DeprecationOrId[];
  silenceDeprecations?: DeprecationOrId[];
}
```

---

### aot

`boolean` `default: true`
Enables or disables Ahead-of-Time compilation for Angular applications.

### assets

`AssetElement[]`
Array of static assets to include in the build output. Can be either a string path or an object with glob patterns.

### browser

`string`
The entry point file for the browser bundle (e.g., 'src/main.ts').

### commonChunk

`boolean` `default: true`
Controls whether to create a separate bundle containing shared code between multiple chunks.

### devServer

`DevServerOptions`
Configuration options for the development server including port, SSL settings, and proxy configuration.

### extractLicenses

`boolean` `default: false`
When true, extracts all license information from dependencies into a separate file.

### fileReplacements

`FileReplacement[]`
List of files to be replaced during the build process, typically used for environment-specific configurations.

### index

`IndexElement`
Configuration for the index.html file. Can be a string path, an object with specific settings, or false to disable.

### inlineStyleLanguage

`InlineStyleLanguage`
Specifies the default language to use for inline styles in components.

### namedChunks

`boolean` `default: true`
When true, generates named chunks instead of numerical IDs.

### optimization

`boolean | OptimizationOptions` `default: true`
Controls build optimization settings for scripts, styles, and fonts.

### outputHashing

`OutputHashing` `default: 'none'`
Defines the hashing strategy for output files. Can be 'none', 'all', 'media', or 'bundles'.

### outputPath

`string | OutputPath`
Specifies the output directory for built files. Can be a string or an object defining paths for browser, server, and media files.

### polyfills

`string[]`
Array of polyfill files to include in the build.

### root

`string`
The root directory of the project where the rspack.config.ts file is located.

### scripts

`ScriptOrStyleEntry[]`
Array of global scripts to include in the build, with options for bundling and injection.

### server

`string`
The entry point file for the server bundle in SSR applications.

### skipTypeChecking

`boolean` `default: false`
When true, skips TypeScript type checking during the build process.

### sourceMap

`boolean | Partial<SourceMap>` `default: true`
Controls generation of source maps for debugging. Can be boolean or detailed configuration object.

### ssr

`boolean | { entry: string; experimentalPlatform?: 'node' | 'neutral' }`
Configuration for Server-Side Rendering. Can be boolean or object with specific SSR settings.

### stylePreprocessorOptions

`StylePreprocessorOptions`
Options for style preprocessors, including include paths and Sass-specific configurations.

### styles

`ScriptOrStyleEntry[]`
Array of global styles to include in the build, with options for bundling and injection.

### tsConfig

`string`
Path to the TypeScript configuration file.

### useTsProjectReferences

`boolean` `default: false`
Enables usage of TypeScript project references.

### vendorChunk

`boolean` `default: true`
When true, creates a separate bundle for vendor (third-party) code.
