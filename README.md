<p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/nx-logo.png" width="450"></p>

<div align="center">

[![Build Status](https://travis-ci.org/nrwl/nx.svg?branch=master)](https://travis-ci.org/nrwl/nx)
[![License](https://img.shields.io/npm/l/@nrwl/schematics.svg?style=flat-square)]()
[![NPM Version](https://badge.fury.io/js/%40nrwl%2Fnx.svg)](https://www.npmjs.com/@nrwl/nx)
[![NPM Downloads](https://img.shields.io/npm/dt/@nrwl/schematics.svg?style=flat-square)](https://www.npmjs.com/@nrwl/nx)
[![Semantic Release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)]()
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

</div>

<hr>

<p align="center">
  <a href="https://hubs.ly/H0g97pW0" target="_blank">  
    <img 
         width="728"
         src="https://images.ctfassets.net/8eyogtwep6d2/40ASb6l6MR7V0w5ntqZ2yi/b4d439fcf56e50085d1f76df1bee41af/monorepo-banner-angularconsole.png"  
         alt="Our Newest Enterprise Angular Book">
  </a>
</p>

<hr>

# What is Nx?

🔎 **Nx is a set of Angular CLI power-ups for modern development.**

## Nx Helps You

### Use Modern Tools

Using Nx, you can add Cypress, Jest, Prettier, and Nest into your dev workflow. Nx sets up these tools and allows you to use them seamlessly. Nx fully integrates with the other modern tools you already use and love.

### Build Full-Stack Applications

With Nx, you can build full-stack applications using Angular and Node.js frameworks such as Nest and Express. You can share code between the frontend and the backend. And you can use the familiar `ng build/test/serve` commands to power whole dev experience.

### Develop Like Google

With Nx, you can develop multiple full-stack applications holistically and share code between them all in the same workspace. Nx provides advanced tools which help you scale your enterprise development. Nx helps enforce your organization’s standards and community best practices.

## A la carte

Most importantly, you can use these power-ups a la carte. Just want to build a single Angular application using Cypress? Nx is still an excellent choice for that.

## Does it replace Angular CLI?

Nx **is not** a replacement for Angular CLI. **An Nx workspace is an Angular CLI workspace.**

- You run same `ng build`, `ng serve` commands.
- You configure your projects in `angular.json`.
- Anything you can do in a standard Angular CLI project, you can also do in an Nx workspace.

# Getting Started

## Creating an Nx Workspace

**Using `npx`**

```bash
npx create-nx-workspace myworkspace
```

**Using `npm init`**

```bash
npm init nx-workspace myworkspace
```

**Using `yarn create`**

```bash
yarn create nx-workspace myworkspace
```

## Adding Nx to an Existing Angular CLI workspace

If you already have a regular Angular CLI project, you can add Nx power-ups by running:

```bash
ng add @nrwl/schematics
```

## Creating First Application

Unlike the CLI, an Nx workspace starts blank. There are no applications to build, serve, and test. To create one run:

```bash
ng g application myapp
```

The result will look like this:

```treeview
<workspace name>/
├── README.md
├── angular.json
├── apps/
│   ├── myapp/
│   │   ├── browserslist
│   │   ├── jest.conf.js
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.scss
│   │   │   └── test.ts
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
│   └── myapp-e2e/
│       ├── cypress.json
│       ├── src/
│       │   ├── fixtures/
│       │   │   └── example.json
│       │   ├── integration/
│       │   │   └── app.spec.ts
│       │   ├── plugins/
│       │   │   └── index.ts
│       │   └── support/
│       │       ├── app.po.ts
│       │       ├── commands.ts
│       │       └── index.ts
│       ├── tsconfig.e2e.json
│       ├── tsconfig.json
│       └── tslint.json
├── libs/
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

All the files that the CLI would have in a new project are still here, just in a different folder structure which makes it easier to create more applications and libraries in the future.

## Serving Application

Run `ng serve myapp` to serve the newly generated application!

You are good to go!

## Quick Start & Documentation

### Documentation

- [Nx Documentation and Guides](https://nx.dev)
- [Nx blog posts](https://blog.nrwl.io/nx/home)

### Books

- [Angular Enterprise Monorepo Patterns](https://go.nrwl.io/angular-enterprise-monorepo-patterns-new-book?utm_campaign=Book%3A%20Monorepo%20Patterns%2C%20Jan%202019&utm_source=Github&utm_medium=Banner%20Ad)

### Videos

- [5-minute video on how to get started with Nx.](http://nrwl.io/nx)
- [Video course on using Nx Workspaces](https://angularplaybook.com/p/nx-workspaces)

### Talks

- [Angular at Large Organizations](https://www.youtube.com/watch?v=piQ0EZhtus0)
- [Nx: The New Way to Build Enterprise Angular Apps](https://www.youtube.com/watch?v=xo-1SDmvM8Y)
- [Supercharging the Angular CLI](https://www.youtube.com/watch?v=bMkKz8AedHc)
- [Hands on Full Stack development with Nx and Bazel](https://www.youtube.com/watch?v=1KDDIhcQORM)

### Podcasts and Shows

- [ngAir 140: Nx for Enterprise Angular Development](https://www.youtube.com/watch?v=qYNiOKDno_I)
- [ngHouston: NX Demo](https://www.youtube.com/watch?v=E_UlU2Yv4G0)

## Misc

- [nx-examples](https://github.com/nrwl/nx-examples) repo has branches for different nx comments to display expected behavior and example app and libraries. Check out the branch (workspace, ngrx...) to see what gets created for you. More info on readme.
- [xplat - Cross-platform tools for Nx workspaces](https://nstudio.io/xplat/)

## Want to help?

If you want to file a bug or submit a PR, read up on our [guidelines for contributing](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md).

## Core Team

| Victor Savkin                                                                  | Jason Jean                                                                 | Benjamin Cabanes                                                               |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Victor Savkin](https://github.com/nrwl/nx/blob/master/static/victor_pic.jpg) | ![Jason Jean](https://github.com/nrwl/nx/blob/master/static/jason_pic.jpg) | ![Benjamin Cabanes](https://github.com/nrwl/nx/blob/master/static/ben_pic.jpg) |
| [vsavkin](https://github.com/vsavkin)                                          | [FrozenPandaz](https://github.com/FrozenPandaz)                            | [bcabanes](https://github.com/bcabanes)                                        |
