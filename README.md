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

🔎 **Nx is a set of Angular CLI power-ups that transform the CLI into a powerful tool for full-stack development.**

With Nx, you can:

* Build full-stack applications using Angular and NestJS
* Use effective development practices pioneered at Google
* Use innovative tools like Cypress and Jest


## Does it replace Angular CLI?

Nx **is not** a replacement for Angular CLI.  **An Nx workspace is an Angular CLI workspace.**

* You run same `ng build`, `ng serve` commands.
* You configure your projects in `angular.json`.
* Anything you can do in a standard Angular CLI project, you can also do in an Nx workspace.


## Features

### Full-Stack Development

With Nx, you can build a backend application next to your Angular application in the same repository. The backend and the frontend can share code. You can connect them to enable a fantastic development experience.

### Use effective development practices pioneered at Google

Using Nx, you can implement monorepo-style development--an approach popularized by Google and used by many tech companies today (Facebook, Uber, Twitter, etc..).

*Doesn't Angular CLI support having multiple projects in the same workspace?*

Yes, starting with Angular CLI 6 you can add different types of projects to a single workspace (by default you can add applications and libraries). This is great, but is not sufficient to enable the monorepo-style development. Nx adds an extra layer of tooling to make this possible.


In addition to using the monorepo, Google is also know for its use of automation. Nx adds powerful capabilities helping your team promote best practices and ensure consistency. 

### Use Innovative Tools

Tools like Apollo, Cypress, Jest, Prettier, and NestJS have gained a lot of popularity. 

It's not the case that Apollo is always better than REST or Cypress is always better than Protractor. There are tradeoffs. But in many situations, for many projects, these innovative tools offer a lot of advantages.

Adding these tools to the dev workflow is challenging in a regular CLI project. The choice you have is not between Protractor or Cypress, but between a hacked-up setup for Cypress and a great CLI setup for Protractor. Nx changes that!


## A la carte

Most importantly, you can use these power-ups a la carte. Just want to build a single Angular application using Cypress? Nx is still an excellent choice for that.



# Getting Started

Nx is just a set of power-ups for Angular CLI, **so an Nx workspace is an Angular CLI workspace**. This means that it will be handy to have the Angular CLI installed globally, which can be done via npm or yarn as well.

```bash
npm install -g @angular/cli
```

or

```bash
yarn global add @angular/cli
```

> Note: If you do not have the Angular CLI installed globally you may not be able to use ng from the terminal to run CLI commands within the project. But the `package.json` file comes with npm scripts to run ng commands, so you can run npm start to ng serve and you can run `npm run ng <command>` to run any of the ng commands.

After you have installed the Angular CLI, install `@nrwl/schematics`.

```bash
npm install -g @nrwl/schematics
```

or

```bash
yarn global add @nrwl/schematics
```

> If you want to work with the version still in development you can use `@nrwl/schematics@next` as the package to install.


## Nx Workspace 

### Creating an Nx Workspace

To create an Nx workspace, run: 

```bash
ng new myworkspace --collection=@nrw/schematics
```

The `ng new` command uses globally-installed packages. Anything installed globally can be in a messy state. If you have any problems running the command above, you can also run:

```bash
create-nx-workspace myworkspacename
```

This command still runs `ng new` under the hood, but it does it in a sandboxed environment, and, as a result, never fails.


### Adding to an Existing Angular CLI workspace

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

```
apps/
    myapp/
        src/
            app/
            assets/
            environment/
            favicon.ico
            index.html
            main.ts
            polyfills.ts
            styles.css
        tsconfig.json
        tsconfig.app.json
        tsconfig.spec.json
        tslint.json
    myapp-e2e/
        src/
        tsconfig.json
        tsconfig.e2e.json
        tslint.json
libs/
tools/
package.json
tsconfig.json
tslint.json
angular.json
nx.json
```

All the files that the CLI would have in a new project are still here, just in a different folder structure which makes it easier to create more apps and libs in the future.


## Serving Application

Run `ng serve myapp` to serve the newly generated application!


You are good to go!

## Quick Start & Documentation

### Books

- [Angular Enteprise Monorepo Patters](https://go.nrwl.io/angular-enterprise-monorepo-patterns-new-book?utm_campaign=Book%3A%20Monorepo%20Patterns%2C%20Jan%202019&utm_source=Github&utm_medium=Banner%20Ad)

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
