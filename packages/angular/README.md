<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx.png" width="600" alt="Nx - Smart, Extensible Build Framework"></p>

{{links}}

<hr>

# Angular Plugin for Nx

The Nx Plugin for Angular contains executors, generators, and utilities for managing Angular applications, and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Cypress, Karma, Protractor, and Storybook.
- Helper services, and functions to use along with NgRx libraries.
- Scaffolding for upgrading AngularJS applications.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Adding the Angular plugin

Adding the Angular plugin to a workspace can be done with the following:

```bash
#yarn
yarn add @nrwl/angular
```

```bash
#npm
npm install @nrwl/angular
```

For more information about the `@nrwl/angular` package take a look at the [Angular Plugin Overview](https://nx.dev/l/a/angular/overview).

{{what-is-nx}}

{{getting-started}}

```

✔ Workspace name (e.g., org name)     · happyorg
✔ What to create in the new workspace · angular
✔ Application name                    · my app
✔ Default stylesheet format           · css

```

### Serving Application

- Run `nx serve myapp` to serve the newly generated application!
- Run `nx test myapp` to test it.
- Run `nx e2e myapp-e2e` to run e2e tests for it.

You can also use `ng` instead of `nx`:

- Run `ng serve myapp` to serve the newly generated application!
- Run `ng test myapp` to test it.
- Run `ng e2e myapp-e2e` to run e2e tests for it.

## Quick Start Videos

<a href="https://www.youtube.com/watch?v=mVKMse-gFBI" target="_blank">
<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-angular-video.png" width="350" alt="Nx - Quick Start Videos"></p>
</a>

- [Nx Dev Tools for Monorepos, In-Depth Explainer](https://youtu.be/h5FIGDn5YM0)

{{resources}}
