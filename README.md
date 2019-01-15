<p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/nx-logo.png"></p>

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
         height="90" 
         src="https://images.ctfassets.net/8eyogtwep6d2/77nvAJVU9yTDmbUj2zjqS5/3cae7d978f6502fffd0130a5644bb055/monorepo-book-banner_2x.jpg?w=728" 
         srcset="https://images.ctfassets.net/8eyogtwep6d2/77nvAJVU9yTDmbUj2zjqS5/3cae7d978f6502fffd0130a5644bb055/monorepo-book-banner_2x.jpg 2x" 
         alt="Our Newest Enterprise Angular Book">
  </a>
</p>

<hr>

# What is Nx?

🔎 **Nx is an open source toolkit for enterprise Angular applications**, which is based on our experience working at Google and helping the Fortune 500 build ambitious Angular applications. It provides an opinionated approach to application project structure and patterns.

Nx is an extension for the the Angular CLI implementing the monorepo-style development. It is also a collection of runtime libraries, linters, and code generators helping large teams build better with Angular.

## Features

Because Nx is built on top of the Angular CLI, you get all the conventional and loved features plus:

- Nx Workspace
- Workspace-Specific Schematics
- Intelligent Builds and Unit Testing
- State Management
- NgRx
- Data Persistence
- Linters
- Code Formatter
- UpgradeModule and downgradeModule helpers
- Jest unit tests integration
- Node build tooling

# Why Nx?

On the surface, large and small organizations care about the same things: consistency, writing robust, maintainable code, making changes with confidence, being able to understand how the system works.

What’s different about large organizations is that they have hundreds of Angular engineers building dozens of apps. So they have a lot of code, which changes everything.

- While ten (10) developers can reach a consensus on best practices by chatting over lunch, five hundred (500) developers cannot. You have to establish best practices, team standards, **and use tools to promote them**.
- With three (3) projects developers will know what needs to be retested after making a change, with thirty (30) projects, however, this is no longer a simple process. Informal team rules to manage change will no longer work with large teams and multi-team, multi-project efforts. **You have to rely on the automated CI process instead.** …

In other words, small organizations can often get by with informal ad-hoc processes, whereas large organizations cannot. **Large organizations must rely on tooling to enable that. Nx is this tooling.**

# Getting Started

An Nx workspace is an Angular CLI project that has been enhanced to be enterprise ready. Being an Angular CLI project means it will be handy to have the Angular CLI installed globally, which can be done via npm or yarn as well.

```
npm install -g @angular/cli
```

> Note: If you do not have the Angular CLI installed globally you may not be able to use ng from the terminal to run CLI commands within the project. But the package.json file comes with npm scripts to run ng commands, so you can run npm start to ng serve and you can run npm run ng <command> to run any of the ng commands.

After you have installed the Angular CLI, install `@nrwl/schematics`.

```
npm install -g @nrwl/schematics
```

After installing it you can create a new Nx workspace by running:

```
create-nx-workspace myworkspacename
```

You can also add Nx capabilities to an existing CLI project by running:

```
ng add @nrwl/schematics
```

You are good to go!

## Quick Start & Documentation

### Documentation

- [Nx Documentation and Guides](https://nrwl.io/nx)
- [Nx blog posts](https://blog.nrwl.io/nx/home)

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
