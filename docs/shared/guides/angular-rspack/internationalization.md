---
title: 'Build-time Internationalization (i18n) with Angular Rspack'
description: "Guide on how to use Angular's build-time i18n with Angular Rspack"
---

# Build-time Internationalization (i18n) with Angular Rspack

Angular Rspack supports Angular's [build-time i18n](https://angular.dev/guide/i18n) out of the box. This guide will walk you through how to use it.  
You can follow the steps completely, just make sure to place any changes to `angular.json` in your project's `project.json` file. Some of these changes may also need to be made to the `rspack.config` file.
The steps below indicate where to make these changes.

The process of building an Angular Rspack application with i18n is similar to building an Angular application with i18n and reuses most of the same steps and configuration.

## Prerequisites

- `@angular/localize` must be installed in your project.
- You must have an `i18n` configuration in your `project.json` file.

It is assumed you have an `i18n` property in your `project.json` file that looks like this:

```json {% highlightLines=["3-10"] %}
{
  "name": "my-app",
  "i18n": {
    "sourceLocale": "en-GB",
    "locales": {
      "fr": {
        "translation": "src/locale/messages.fr.xlf"
      }
    }
  },
  "targets": {
    "extract-i18n": {}
  }
}
```

{% callout type="note" title="Extracting i18n messages" %}
The `extract-i18n` target found in Angular projects will still be used to extract the i18n messages into XLIFF (or chosen format) files.
You simply need to run `nx extract-i18n my-app` to extract the messages.
{% /callout %}

## Step 1: Configure the Rspack Configuration

To enable i18n, you need to add the following configuration to your `rspack.config` file:

```js {% highlightLines=[7,15] %}
export default createConfig(
  {
    options: {
      root: __dirname,
      polyfills: [
        'zone.js',
        '@angular/localize/init',
      ],
      ...,
    },
  },
  {
    production: {
        options: {
            localize: true,
        },
    },
  }
);
```

## Step 2: Run the build

After configuring the Rspack configuration, you can run the build with the following command:

```bash
npx nx build my-app
```

It will output bundles in the `dist` directory with the following structure:

```text
dist
├── browser
│   ├── [localeCode]
│   │   ├── main.js
│   │   ├── main.js.map
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── ...
```
