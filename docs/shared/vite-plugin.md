The Nx plugin for [Vite](https://vitejs.dev/) and [Vitest](https://vitest.dev/).

{% callout type="warning" title="Early release plugin" %}
This Nx plugin is in active development and may not be ready for real-world use. The planned release date for the stable plugin is December, 2022.
{% /callout %}

Why should you use this plugin?

- Instant dev server start
- Lightning fast Hot-Module Reloading
- _Fast_ builds using Vite.
- Vite-powered tests with smart and instant watch mode

## Setting up Vite

To create a new workspace, run `npx create-nx-workspace@latest --preset=npm`.

To add the Vite plugin to an existing workspace, run the following:

{% tabs %}
{% tab label="npm" %}

```shell
npm install -D @nrwl/vite
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nrwl/vite
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm install -D @nrwl/vite
```

{% /tab %}
{% /tabs %}
