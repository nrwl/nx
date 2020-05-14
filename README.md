<p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/nx-logo.png" width="450"></p>

<div align="center">

[![CircleCI](https://circleci.com/gh/nrwl/nx.svg?style=svg)](https://circleci.com/gh/nrwl/nx)
[![License](https://img.shields.io/npm/l/@nrwl/workspace.svg?style=flat-square)]()
[![NPM Version](https://badge.fury.io/js/%40nrwl%2Fworkspace.svg)](https://www.npmjs.com/@nrwl/workspace)
[![Semantic Release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)]()
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![Join the chat at https://gitter.im/nrwl-nx/community](https://badges.gitter.im/nrwl-nx/community.svg)](https://gitter.im/nrwl-nx/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Join us @nrwl/community on slack](https://img.shields.io/badge/slack-%40nrwl%2Fcommunity-brightgreen)](https://join.slack.com/t/nrwlcommunity/shared_invite/enQtNzU5MTE4OTQwOTk0LTgxY2E0ZWYzMWE0YzA5ZDA2MWM1NDVhNmI2ZWMyYmZhNWJiODk3MjkxZjY3MzU5ZjRmM2NmNWU1OTgyZmE4Mzc)

</div>

<hr>

# What is Nx?

🔎 **Extensible Dev Tools for Monorepos.**

## Nx Helps You

### Develop like Google, Facebook, and Microsoft

Nx helps scale your development from one team building one application to many teams building multiple frontend and backend applications all in the same workspace. When using Nx, developers have a holistic dev experience powered by an advanced CLI (with editor plugins), capabilities for controlled code sharing and consistent code generation.

### Use Intelligent Build System with Distributed Caching

Nx is smart. It analyzes your workspace and figures out what can be affected by every code change. That's why Nx doesn't rebuild and retest everything on every commit--it only rebuilds what is necessary.

Nx also uses a distributed computation cache. If someone has already built or tested similar code, Nx will use their results to speed up the command for everyone else instead of rebuilding or retesting the code from scratch. This, in combination with Nx’s support for distributed and incremental builds, can help teams see up to 10x reduction in build and test times.

### Use Modern Tools

Nx is an open platform with plugins for many modern tools and frameworks. It has support for TypeScript, React, Angular, Cypress, Jest, Prettier, Nest.js, Next.js, Storybook, Ionic among others. With Nx, you get a consistent dev experience regardless of the tools used.

# Getting Started

## Creating an Nx Workspace

**Using `npx`**

```bash
npx create-nx-workspace
```

**Using `npm init`**

```bash
npm init nx-workspace
```

**Using `yarn create`**

```bash
yarn create nx-workspace
```

The `create-nx-workspace` command will ask you to select a preset, which will configure some plugins and create your applications to help you get started.

```
? What to create in the new workspace (Use arrow keys)
❯ empty             [an empty workspace]
  web components    [a workspace with a single app built using web components]
  angular           [a workspace with a single Angular application]
  angular-nest      [a workspace with a full stack application (Angular + Nest)]
  react             [a workspace with a single React application]
  react-express     [a workspace with a full stack application (React + Express)]
  next.js           [a workspace with a single Next.js application]
```

Select the preset that works best for you. You can always add plugins later.

```
? Workspace name (e.g., org name)     happyorg
? What to create in the new workspace web components    [a workspace with a single app built using web components]
? Application name                    myapp
? Default stylesheet format           CSS
```

If it's your first Nx project, the command will recommend you to install `@nrwl/cli` globally, so you can invoke `nx` directly without going through yarn or npm.

## Serving Application

- Run `nx serve myapp` to serve the newly generated application!
- Run `nx test myapp` to test it.
- Run `nx e2e myapp-e2e` to run e2e tests for it.

Angular users can also run `ng g/serve/test/e2e`.

You are good to go!

### Documentation

- [Nx Documentation and Guides](https://nx.dev)
- [Nx blog posts](https://blog.nrwl.io/nx/home)

### Quick Start Videos

<table>
  <tr>
    <td>    
      <a href="https://www.youtube.com/watch?v=mVKMse-gFBI" target="_blank">
      <p align="center">Angular<br><img src="https://raw.githubusercontent.com/nrwl/nx/master/nx-angular-video.png" width="350"></p>
      </a>
    </td>
    <td>    
      <a href="https://www.youtube.com/watch?v=E188J7E_MDU" target="_blank">
      <p align="center">React<br><img src="https://raw.githubusercontent.com/nrwl/nx/master/nx-react-video.png" width="350"></p>
      </a>
    </td>
  </tr>
</table>

### Courses

<table>
  <tr>
    <td>
      <a href="https://www.youtube.com/watch?v=2mYLe9Kp9VM&list=PLakNactNC1dH38AfqmwabvOszDmKriGco" target="_blank">
        <p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/nx-workspace-course.png" width="350"></p>
      </a>
    </td>
    <td>    
      <a href="https://nxplaybook.com/p/advanced-nx-workspaces" target="_blank">
      <p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/advanced-nx-workspace-course.png" width="350"></p>
      </a>
    </td>
  </tr>
</table>

### Books

- [Effective React Development with Nx](https://go.nrwl.io/effective-react-development-with-nx-new-book)
- [Angular Enterprise Monorepo Patterns](https://go.nrwl.io/angular-enterprise-monorepo-patterns-new-book?utm_campaign=Book%3A%20Monorepo%20Patterns%2C%20Jan%202019&utm_source=Github&utm_medium=Banner%20Ad)

### Videos

- [45-Minute Walkthrough (React)](https://www.youtube.com/watch?v=jCf92IyR-GE)
- [45-Minute Walkthrough (Angular)](https://www.youtube.com/watch?v=h5FIGDn5YM0)

### Talks

- [Angular at Large Organizations](https://www.youtube.com/watch?v=piQ0EZhtus0)
- [Nx: The New Way to Build Enterprise Angular Apps](https://www.youtube.com/watch?v=xo-1SDmvM8Y)
- [Supercharging the Angular CLI](https://www.youtube.com/watch?v=bMkKz8AedHc)
- [Hands on Full Stack development with Nx and Bazel](https://www.youtube.com/watch?v=1KDDIhcQORM)

## Misc

- [nx-examples](https://github.com/nrwl/nx-examples) repo has branches for different nx comments to display expected behavior and example app and libraries. Check out the branch (workspace, ngrx...) to see what gets created for you. More info on readme.
- [xplat - Cross-platform tools for Nx workspaces](https://nstudio.io/xplat/)

## Want to help?

If you want to file a bug or submit a PR, read up on our [guidelines for contributing](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md) and watch this video that will help you get started.

<a href="https://www.youtube.com/watch?v=o11p0zSm0No&feature=youtu.be" target="_blank">
<p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/how-to-contribute.png" width="600"></p>
</a>

## Core Team

| Victor Savkin                                                          | Jason Jean                                                            | Benjamin Cabanes                                                            | Brandon Roberts                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ![Victor Savkin](https://avatars1.githubusercontent.com/u/35996?s=150) | ![Jason Jean](https://avatars2.githubusercontent.com/u/8104246?s=150) | ![Benjamin Cabanes](https://avatars2.githubusercontent.com/u/3447705?s=150) | ![Brandon Roberts](https://avatars1.githubusercontent.com/u/42211?s=150) |
| [vsavkin](https://github.com/vsavkin)                                  | [FrozenPandaz](https://github.com/FrozenPandaz)                       | [bcabanes](https://github.com/bcabanes)                                     | [brandonroberts](https://github.com/brandonroberts)                      |

| Jack Hsu                                                              | Jo Hanna Pearce                                                               | Matt Briggs                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ![Jack Hsu](https://avatars0.githubusercontent.com/u/53559?s=150&v=4) | ![Jo Hanna Pearce](https://avatars1.githubusercontent.com/u/439121?s=150&v=4) | ![Matt Briggs](https://avatars2.githubusercontent.com/u/89260?s=150&v=4) |
| [jaysoo](https://github.com/jaysoo)                                   | [jdpearce](https://github.com/jdpearce)                                       | [mbriggs](https://github.com/mbriggs)                                    |
