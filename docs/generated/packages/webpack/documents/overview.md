---
title: Overview of the Nx Webpack Plugin
description: The Nx Plugin for Webpack contains executors and generators that support building applications using Webpack.
---

The Nx plugin for [webpack](https://webpack.js.org/).

[Webpack](https://webpack.js.org/) is a static module bundler for modern JavaScript applications. The `@nx/webpack` plugin provides executors that allow you to build and serve your projects using webpack, plus an executor for SSR.

Nx now allows you to [customize your webpack configuration](/packages/webpack/documents/webpack-config-setup) for your projects. And we also offer [a number of webpack plugins](/packages/webpack/documents/webpack-plugins) for supporting Nx and other frameworks.

## Setting up a new Nx workspace with Webpack

You can create a new workspace that uses Webpack with one of the following commands:

- Generate a new standalone React app set up with Webpack

```shell
npx create-nx-workspace@latest --preset=react-standalone --bundler=webpack
```

- Generate a new React monorepo set up with Webpack

```shell
npx create-nx-workspace@latest --preset=react-monorepo --bundler=webpack
```

## Generate a new project using Webpack

You can generate a [React](/packages/react) application or library or a [Web](/packages/web) application that uses Webpack in an existing Nx workspace. The [`@nx/react:app`](/packages/react/generators/application), [`@nx/node:app`](/packages/node/generators/application) and [`@nx/web:app`](/packages/web/generators/application) generators accept the `bundler` option, where you can pass `webpack`. This will generate a new application configured to use Webpack, and it will also install all the necessary dependencies, including the `@nx/webpack` plugin.

To generate a React application using Webpack, run the following:

```bash
nx g @nx/react:app my-app --bundler=webpack
```

To generate a Node application using Webpack, run the following:

```bash
nx g @nx/node:app my-app --bundler=webpack
```

To generate a Web application using Webpack, run the following:

```bash
nx g @nx/web:app my-app --bundler=webpack
```
