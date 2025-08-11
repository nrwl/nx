---
title: Angular - Set up Compodoc for Storybook on Nx
description: This guide explains how to set up Compodoc for Storybook on Angular projects in a Nx workspace.
---

# Set up Compodoc for Storybook on Nx

{% callout type="note" title="Note" %}
This documentation page contains information about the [Storybook plugin](/technologies/test-tools/storybook/introduction), specifically regarding [Angular projects that are using Storybook](/technologies/test-tools/storybook/recipes/overview-angular).
{% /callout %}

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/storybook-compodoc-angular" /%}

## What is Compodoc

[Compodoc](https://compodoc.app/) is a documentation generator for Angular applications. You can use [JSDoc](https://jsdoc.app/) comment blocks above your components, directives, and other Angular constructs, to add documentation to the elements that you want. These comments are used by `compodoc` to generate documentation for your application. As is noted in the [Compodoc documentation](https://compodoc.app/guides/comments.html), "Compodoc uses the Typescript AST parser and it's internal APIs, so the comments have to be JSDoc comments". You can read more about the JSDoc tags that Compodoc supports [here](https://compodoc.app/guides/jsdoc-tags.html).

## How to use Compodoc in Storybook to write documentation

In Storybook, it makes sense to add explanatory comments above your `@Input`s and `@Output`s, since these are the main elements that Storybook focuses on. The `@Input`s and `@Output`s are the elements that you can interact with in the Storybook UI, the controls.

Let's take for example an Angular component - a button - that has an `@Input` for the size of the button. In Compodoc, we could describe this input as follows:

```ts
  /**
   * How large should the button be?
   */
  @Input()
  size: 'small' | 'medium' | 'large' = 'medium';
```

This comment would result in the following documentation in Compodoc:

![Button size `@Input` generated documentation](/shared/recipes/storybook/button-size-input.png)

If we add a description and a default value to each of our component `@Input`s, we will end up with a full documentation page. See a full example of the button component [here](https://github.com/nrwl/nx-recipes/tree/main/storybook-compodoc-angular/apps/my-app/src/app/butn/butn.component.ts). The generated documentation of this example will look like this:

![Generated Docs page for the Button](/shared/recipes/storybook/button-docs.png)

When you run Compodoc, it will generate a `documentation.json` file. Storybook will then use that file to render the documentation in the `Docs` tab.

## How to enable Compodoc for Storybook

The main things that you need to do are:

1. Install the necessary packages for `compodoc`.
2. Include the component files in the TypeScript compilation for Compodoc (or any other files that contain your Compodoc documentation).
3. Use `compodoc` to generate a `documentation.json` file.
4. Tell Storybook to use the `documentation.json` file to display the documentation.
5. Do not forget to enable [Storybook Autodocs](https://storybook.js.org/docs/react/writing-docs/autodocs) in your Storybook configuration.

Let's see how you can do that.

{% callout type="note" title="Note" %}
This guide assumes that you have an Angular project with Storybook configured in your Nx workspace. If you do not know how to set these up, please read about [setting up Storybook for Angular](/technologies/test-tools/storybook/recipes/overview-angular) on the Nx documentation website.
{% /callout %}

### 1. Install the necessary packages

First we need to install the necessary packages:

{% tabs %}
{%tab label="npm"%}

```shell
npm add -D @compodoc/compodoc
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add -D @compodoc/compodoc
```

{% /tab %}
{%tab label="pnpm"%}

```shell
pnpm add -D @compodoc/compodoc
```

{% /tab %}

{% tab label="bun" %}

```shell
bun add -D @compodoc/compodoc
```

{% /tab %}
{% /tabs %}

### 2. Include the component files in the TypeScript compilation for Compodoc

When you are using Compodoc, you need to create a `tsconfig` file, and in the `include` array you need to place all the files that you want Compodoc to include in its compilation. Compodoc [suggests](https://compodoc.app/guides/installation.html) to add a `tsconfig.doc.json` to do that. Then, when running `compodoc` you can use the `-p` (or `--tsconfig`) flag to specify the path to that file. See all the options that Compodoc supports [here](https://compodoc.app/guides/options.html).

In the Storybook case, Storybook has the `--tsconfig` option [prefilled](https://github.com/storybookjs/storybook/blob/next/code/frameworks/angular/src/builders/utils/run-compodoc.ts#L23) to point to the `.storybook/tsconfig.json` file. As is noted in the [Storybook schema for the Angular builders](https://github.com/storybookjs/storybook/blob/next/code/frameworks/angular/src/builders/start-storybook/schema.json#L76), "_Options `-p` with tsconfig path and `-d` with workspace root is always given._". What this means is that you can add the paths to the component files (where Compodoc will look for JSDoc comment blocks) in the `include` array of the `.storybook/tsconfig.json` file. This is the file that Storybook will use to compile the TypeScript files, and it will also be the file that Compodoc will use to compile the TypeScript files.

In your project's `.storybook/tsconfig.json` file, in the `include` array, add the path to the component files (eg. `"../src/**/*.component.ts"`). For example, if you have an application called `my-app`, the file `apps/my-app/.storybook/tsconfig.json` will look like this:

```json {% fileName="apps/my-app/.storybook/tsconfig.json" %}
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true
  },
  "files": ["../src/polyfills.ts"],
  "exclude": ["../**/*.spec.ts"],
  "include": ["../src/**/*.stories.ts", "../src/**/*.component.ts", "*.js"]
}
```

{% callout type="warning" title="Don't forget all the paths!" %}
Important! If you are importing stories from other places, and you want the docs for these stories to be generated, too, you need to add the paths to the other components in the `include` array, as well!

For example, if your stories paths look like this:

```
"../../../**/**/src/lib/**/*.stories.ts"
```

make sure to also include

```
"../../../**/**/src/lib/**/*.component.ts"
```

for the components to be included in the TypeScript compilation as well.

This applies in cases where, for example, you have [one single Storybook for your whole workspace](/technologies/test-tools/storybook/recipes/one-storybook-for-all), where you import stories from all the projects. In that case, you need to import all the components as well!
{% /callout %}

### 3. Enable `compodoc` and configure it

#### a. Set `compodoc: true`

In your project's `project.json` file (e.g. `apps/my-app/project.json`), find the `storybook` and the `build-storybook` targets.

In the `options` you will see `"compodoc": false`. Change that to `true`.

#### b. Set the directory

Storybook has [preconfigured `compodoc`](https://github.com/storybookjs/storybook/blob/next/code/frameworks/angular/src/builders/utils/run-compodoc.ts#L25) to generate a `documentation.json` file at the root of your workspace by default. We want to change that, and keep the documentation file project-specific. Of course, you can change that later, or as you see fit for your use case. But let's keep it project-specific for now.

In your project's `project.json` file (eg. `apps/my-app/project.json`), find the `storybook` and the `build-storybook` targets. Below the `compodoc` option, create a new option called `"compodocArgs` which contains the following: `["-e", "json", "-d", "apps/my-app"]`. This means that the `exportFormat` (`-e`) will be `json` and the `output` directory (`-d`) will be `apps/my-app` (change that, of course, to the directory of your project).

Let's see the result for our `my-app` app `storybook` target, for example (in `apps/my-app/project.json`):

```jsonc {% fileName="apps/my-app/project.json" %}
    "storybook": {
      "executor": "@storybook/angular:start-storybook",
      "options": {
        "port": 4400,
        "configDir": "apps/my-app/.storybook",
        "browserTarget": "my-app:build",
        "compodoc": true,
        "compodocArgs": ["-e", "json", "-d", "apps/my-app"]
      },
    },
```

### 4. Let Storybook know of the `documentation.json` file

In your project's `.storybook/preview.ts` file (for example for your `my-app` app the path would be `apps/my-app/.storybook/preview.ts`), add the following:

```js {% fileName="apps/my-app/.storybook/preview.ts" %}
import { setCompodocJson } from '@storybook/addon-docs/angular';
import docJson from '../documentation.json';
setCompodocJson(docJson);
```

Notice how we are adding `"resolveJsonModule": true` in our app's `.storybook/tsconfig.json` in order to be able to import the `documentation.json` file:

```json {% fileName="apps/my-app/.storybook/tsconfig.json" %}
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true
  },
  "files": ["../src/polyfills.ts"],
  "exclude": ["../**/*.spec.ts"],
  "include": ["../src/**/*.stories.ts", "../src/**/*.component.ts", "*.js"]
}
```

### 5. Set up Autodocs

In your project's `.storybook/main.ts` file you have to enable autodocs:

```js {% fileName="apps/my-app/.storybook/main.ts" %}
const config = {
  stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  docs: {
    autodocs: true,
    defaultName: 'Docs',
  },
};

export default config;
```

### Now run Storybook and see the results

Now you can run Storybook or build Storybook, and documentation will be included. Just check the Docs tab!

```shell
nx storybook my-app
```

and

```shell
nx build-storybook my-app
```
