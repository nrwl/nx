---
title: Examples for the Vite init generator
description: This page contains examples for the Vite @nrwl/vite:init generator, which helps you initialize vite in your Nx workspace, by installing the necessary dependencies.
---

This is a generator will initialize Vite.js in your workspace. It will install all the necessary dependencies. You can read more about how this generator works, in the [Vite package overview page](/packages/vite).

{% callout type="note" title="string" %}
You don't need to use this generator on its own.
{% /callout %}

This generator will be called automatically when you are either converting an existing React or Web app to use Vite, using the [`@nrwl/vite:configuration` generator](/packages/vite/generators/configuration), or when you are creating a new React or Web app using the [`@nrwl/react:app`](/packages/react/generators/application) or [`@nrwl/web:app`](/packages/web/generators/application) generators, if you choose `vite` as the `bundler`.

If you need to for some reason, you can use it on its own like this:

```bash
nx g @nrwl/vite:init
```

## Examples

### Install all the necessary dependencies for Vite and the React plugin

```bash
nx g @nrwl/vite:init --uiFramework=react
```

### Install all the necessary dependencies for Vite

```bash
nx g @nrwl/vite:init --uiFramework=none
```
