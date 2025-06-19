---
title: '@nx/storybook Executors'
description: 'Complete reference for all @nx/storybook executor commands'
sidebar_label: Executors
---

# @nx/storybook Executors

The @nx/storybook plugin provides various executors to run tasks on your storybook projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `build`

Build storybook in production mode.

**Usage:**

```bash
nx run &lt;project&gt;:build [options]
```

#### Options

| Option                       | Type    | Description                                                                                                                                                          | Default                           |
| ---------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------- |
| `--configDir` **[required]** | string  | Directory where to load Storybook configurations from.                                                                                                               |                                   |
| `--debugWebpack`             | boolean | Display final webpack configurations for debugging purposes.                                                                                                         |                                   |
| `--disableTelemetry`         | boolean | Disables Storybook's telemetry.                                                                                                                                      |                                   |
| `--docs`                     | boolean | Starts Storybook in documentation mode. Learn more about it : https://storybook.js.org/docs/react/writing-docs/build-documentation#preview-storybooks-documentation. |                                   |
| `--docsMode`                 | boolean | Build a documentation-only site using addon-docs.                                                                                                                    | `false`                           |
| `--loglevel`                 | string  | Controls level of logging during build. Can be one of: [silly, verbose, info (default), warn, error, silent].                                                        |                                   |
| `--outputDir`                | string  | Directory where to store built files.                                                                                                                                |                                   |
| `--quiet`                    | boolean | Suppress verbose build output.                                                                                                                                       |                                   |
| `--staticDir`                | array   | Directory where to load static files from, array of strings.                                                                                                         |                                   |
| `--stylePreprocessorOptions` | object  | Options to pass to style preprocessors.                                                                                                                              |                                   |
| `--styles`                   | array   | Global styles to be included in the build.                                                                                                                           |                                   |
| `--webpackStatsJson`         | boolean | string                                                                                                                                                               | Write Webpack Stats JSON to disk. | `false` |

### `storybook`

Serve up Storybook in development mode.

**Usage:**

```bash
nx run &lt;project&gt;:storybook [options]
```

#### Options

| Option                       | Type    | Description                                                                                                                                                          | Default                           |
| ---------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------- |
| `--configDir` **[required]** | string  | Directory where to load Storybook configurations from.                                                                                                               |                                   |
| `--ci`                       | boolean | CI mode (skip interactive prompts, don't open browser).                                                                                                              | `false`                           |
| `--debugWebpack`             | boolean | Display final webpack configurations for debugging purposes.                                                                                                         |                                   |
| `--disableTelemetry`         | boolean | Disables Storybook's telemetry.                                                                                                                                      |                                   |
| `--docs`                     | boolean | Starts Storybook in documentation mode. Learn more about it : https://storybook.js.org/docs/react/writing-docs/build-documentation#preview-storybooks-documentation. |                                   |
| `--docsMode`                 | boolean | Starts Storybook in documentation mode. Learn more about it : https://storybook.js.org/docs/react/writing-docs/build-documentation#preview-storybooks-documentation. | `false`                           |
| `--host`                     | string  | Host to listen on.                                                                                                                                                   |                                   |
| `--https`                    | boolean | Serve Storybook over HTTPS. Note: You must provide your own certificate information.                                                                                 | `false`                           |
| `--loglevel`                 | string  | Controls level of logging during build. Can be one of: [silly, verbose, info (default), warn, error, silent].                                                        |                                   |
| `--noOpen`                   | boolean | Do not open Storybook automatically in the browser.                                                                                                                  |                                   |
| `--open`                     | boolean | Open browser window automatically.                                                                                                                                   |                                   |
| `--port`                     | number  | Port to listen on.                                                                                                                                                   | `9009`                            |
| `--previewUrl`               | string  | Preview URL.                                                                                                                                                         |                                   |
| `--quiet`                    | boolean | Suppress verbose build output.                                                                                                                                       |                                   |
| `--smokeTest`                | boolean | Exit after successful start.                                                                                                                                         |                                   |
| `--sslCa`                    | string  | Provide an SSL certificate authority. (Optional with --https, required if using a self-signed certificate).                                                          |                                   |
| `--sslCert`                  | string  | Provide an SSL certificate. (Required with --https).                                                                                                                 |                                   |
| `--sslKey`                   | string  | Provide an SSL key. (Required with --https).                                                                                                                         |                                   |
| `--staticDir`                | array   | Directory where to load static files from, array of strings.                                                                                                         |                                   |
| `--uiFramework`              | string  | Storybook framework npm package.                                                                                                                                     |                                   |
| `--webpackStatsJson`         | boolean | string                                                                                                                                                               | Write Webpack Stats JSON to disk. | `false` |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
