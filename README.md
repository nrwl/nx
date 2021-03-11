<p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx.png" width="600"></p>

<div align="center">

[![CircleCI](https://circleci.com/gh/nrwl/nx.svg?style=svg)](https://circleci.com/gh/nrwl/nx)
[![License](https://img.shields.io/npm/l/@nrwl/workspace.svg?style=flat-square)]()
[![NPM Version](https://badge.fury.io/js/%40nrwl%2Fworkspace.svg)](https://www.npmjs.com/@nrwl/workspace)
[![Semantic Release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)]()
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![Join the chat at https://gitter.im/nrwl-nx/community](https://badges.gitter.im/nrwl-nx/community.svg)](https://gitter.im/nrwl-nx/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Join us @nrwl/community on slack](https://img.shields.io/badge/slack-%40nrwl%2Fcommunity-brightgreen)](http://go.nrwl.io/join-slack)

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
❯ empty             [an empty workspace with a layout that works best for building apps]
  oss               [an empty workspace with a layout that works best for open-source projects]
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

If it's your first Nx project, the command will recommend you to install the `nx` package globally, so you can invoke `nx` directly without going through yarn or npm.

## Serving Application

- Run `nx serve myapp` to serve the newly generated application!
- Run `nx test myapp` to test it.
- Run `nx e2e myapp-e2e` to run e2e tests for it.

Angular users can also run `ng g/serve/test/e2e`.

You are good to go!

## Resources

### Documentation

- [Nx Documentation and Guides](https://nx.dev)

### Quick Start Videos

<table>
  <tr>
    <td>    
      <a href="https://www.youtube.com/watch?v=mVKMse-gFBI" target="_blank">
      <p align="center">Angular<br><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-angular-video.png" width="350"></p>
      </a>
    </td>
    <td>    
      <a href="https://www.youtube.com/watch?v=E188J7E_MDU" target="_blank">
      <p align="center">React<br><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-react-video.png" width="350"></p>
      </a>
    </td>
  </tr>
</table>

### Courses

<table>
  <tr>
    <td><strong>Scale React Development with Nx</strong></td>
    <td><strong>Nx Workspaces</strong></td>
    <td><strong>Advanced Nx Workspaces</strong></td>
  </tr>
  <tr>
    <td>
      <a href="https://egghead.io/playlists/scale-react-development-with-nx-4038" target="_blank">
      <p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/EGH_ScalingReactNx.png" height="150px"></p>
      </a>
    </td>
    <td>
      <a href="https://www.youtube.com/watch?v=2mYLe9Kp9VM&list=PLakNactNC1dH38AfqmwabvOszDmKriGco" target="_blank">
        <p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-workspace-course.png" width="350"></p>
      </a>
    </td>
    <td>  
      <a href="https://nxplaybook.com/p/advanced-nx-workspaces" target="_blank">
      <p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/advanced-nx-workspace-course.png" width="350"></p>
      </a>
    </td>
  </tr>
</table>

### Nx Demo & Tutorial Videos

- [Nx Dev Tools for Monorepos, In-Depth Explainer (React)](https://www.youtube.com/watch?v=jCf92IyR-GE)

- [Nx Dev Tools for Monorepos, In-Depth Explainer (Angular)](https://youtu.be/h5FIGDn5YM0)

- [Storybook Integration with Nx](https://youtu.be/sFpqyjT7u4s)

- [Building Custom Plugins for Nx](https://youtu.be/XYO689PAhow)

- [Improved Dependency Graph Visualization for Nx](https://youtu.be/cMZ-ReC-jWU)

- [Group all your stories into a single viewable Storybook with Nx](https://youtu.be/c323HOuFKkA)

- [Debug Nx with Node and VSCode](https://youtu.be/OGV4R0cPRPc)

- [Debug your Jest tests in Nx with VSCode](https://youtu.be/9_lgM2nokLg)

- [Nx Console - A Must-Have Visual Studio Code Extension for Angular Developers](https://youtu.be/IIetmfgozgI)

- [Introducing Nx Cloud](https://youtu.be/pwG20nNTEQc)

- [Setting up distributed caching using Nx Cloud, @nrwl/nx-cloud](https://youtu.be/w1-GiB74ddc)

- [High Quality React apps with Nx & Cypress](https://youtu.be/mfJBLhjYMdo)

### Books and Blogs

- [Nx blog posts](https://blog.nrwl.io/nx/home)

- [Angular Enterprise Monorepo Patterns Book (free)](https://go.nrwl.io/angular-enterprise-monorepo-patterns-new-book?utm_campaign=Book%3A%20Monorepo%20Patterns%2C%20Jan%202019&utm_source=Github&utm_medium=Banner%20Ad)

- [High Quality React apps with Nx & Cypress](https://cypress.io/blog/2020/04/14/high-quality-react-apps-with-nx-cypress/) (April 2020)

- [Shell Library patterns with Nx and Monorepo Architectures](https://indepth.dev/the-shell-library-patterns-with-nx-and-monorepo-architectures/) (March 2020)

- [Tiny Angular application projects in Nx workspaces](https://indepth.dev/tiny-angular-application-projects-in-nx-workspaces/#peer-reviewers--30/) (March 2020)

### Additional Resources

- [nx-examples](https://github.com/nrwl/nx-examples) repo has branches for different nx comments to display expected behavior and example app and libraries. Check out the branch (workspace, ngrx...) to see what gets created for you. More info on readme.

- [xplat - Cross-platform tools for Nx workspaces](https://nstudio.io/xplat/)
- [Nrwl Talks, Presentations, and Podcasts playlist on YouTube](https://www.youtube.com/playlist?list=PLakNactNC1dHHWx4JIORwfnEajRv6FG5m)

- [Nx Office Hours playlist on YouTube](https://www.youtube.com/playlist?list=PLakNactNC1dE8KLQ5zd3fQwu_yQHjTmR5)

## Want to help?

If you want to file a bug or submit a PR, read up on our [guidelines for contributing](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md) and watch this video that will help you get started.

<a href="https://www.youtube.com/watch?v=o11p0zSm0No&feature=youtu.be" target="_blank">
<p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/how-to-contribute.png" width="600"></p>
</a>

## Core Team

| Victor Savkin                                                          | Jason Jean                                                            | Benjamin Cabanes                                                            | Brandon Roberts                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ![Victor Savkin](https://avatars1.githubusercontent.com/u/35996?s=150) | ![Jason Jean](https://avatars2.githubusercontent.com/u/8104246?s=150) | ![Benjamin Cabanes](https://avatars2.githubusercontent.com/u/3447705?s=150) | ![Brandon Roberts](https://avatars1.githubusercontent.com/u/42211?s=150) |
| [vsavkin](https://github.com/vsavkin)                                  | [FrozenPandaz](https://github.com/FrozenPandaz)                       | [bcabanes](https://github.com/bcabanes)                                     | [brandonroberts](https://github.com/brandonroberts)                      |

| Jack Hsu                                                              | Jo Hanna Pearce                                                               | Jon Cammisuli                                                                | Isaac Mann                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ![Jack Hsu](https://avatars0.githubusercontent.com/u/53559?s=150&v=4) | ![Jo Hanna Pearce](https://avatars1.githubusercontent.com/u/439121?s=150&v=4) | ![Jon Cammisuli](https://avatars2.githubusercontent.com/u/4332460?s=150&v=4) | ![Isaac Mann](https://avatars1.githubusercontent.com/u/861504?s=150) |
| [jaysoo](https://github.com/jaysoo)                                   | [jdpearce](https://github.com/jdpearce)                                       | [cammisuli](https://github.com/cammisuli)                                    | [isaacplmann](https://github.com/isaacplmann)                        |

| Tasos Bekos                                                              | Juri Strumpflohner                                                               | Philip Fulcher                                                            | Katerina Skroumpelou                                                                |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ![Tasos Bekos](https://avatars.githubusercontent.com/u/551595?s=150&v=4) | ![Juri Strumpflohner](https://avatars1.githubusercontent.com/u/542458?s=150&v=4) | ![Philip Fulcher](https://avatars1.githubusercontent.com/u/1536471?s=150) | ![Katerina Skroumpelou](https://avatars0.githubusercontent.com/u/6603745?s=150&v=4) |
| [bekos](https://github.com/bekos)                                        | [juristr](https://github.com/juristr)                                            | [philipjfulcher](https://github.com/philipjfulcher)                       | [mandarini](https://github.com/mandarini)                                           |

| Kirils Ladovs                                                               |
| --------------------------------------------------------------------------- |
| ![Kirils Ladovs](https://avatars.githubusercontent.com/u/9858620?s=150&v=4) |
| [kirjai](https://github.com/kirjai)                                         |
