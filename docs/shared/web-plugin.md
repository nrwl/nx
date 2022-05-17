The Nx Plugin for Web Components contains generators for managing Web Component applications and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Cypress, and Storybook.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Setting Up Web

To create a new workspace with web, run `npx create-nx-workspace@latest --preset=web`.

To add the web plugin to an existing workspace, run one of the following:

```bash
# For npm users
npm install -D @nrwl/web

# For yarn users
yarn add -D @nrwl/web
```

### Creating Applications

You can add a new application with the following:

```bash
nx g @nrwl/web:app my-new-app
```

The application uses no framework and generates with web components. You can add any framework you want on top of the default setup.

To start the application in development mode, run `nx serve my-new-app`.

**Note:** If you are looking to add a React application, check out the [React plugin](/packages/react).

### Creating Libraries

To create a generic TypeScript library (i.e. non-framework specific), use the [`@nrwl/js`](/js/overview) plugin.

```bash
nx g @nrwl/js:lib my-new-lib

# If you want the library to be buildable or publishable to npm
nx g @nrwl/web:lib my-new-lib --buildable
nx g @nrwl/web:lib my-new-lib \
--publishable \
--importPath=@myorg/my-new-lib
```

## Using Web

### Testing Projects

You can run unit tests with:

```bash
nx test my-new-app
nx test my-new-lib
```

Replace `my-new-app` with the name or your project. This command works for both applications and libraries.

You can also run E2E tests for applications:

```bash
nx e2e my-new-app-e2e
```

Replace `my-new-app-e2e` with the name or your project with `-e2e` appended.

### Building Projects

React applications can be build with:

```bash
nx build my-new-app
```

And if you generated a library with `--buildable`, then you can build a library as well:

```bash
nx build my-new-lib
```

The output is in the `dist` folder. You can customize the output folder by setting `outputPath` in the project's `project.json` file.

The application in `dist` is deployable, and you can try it out locally with:

```bash
npx http-server dist/apps/my-new-app
```

The library in `dist` is publishable to npm or a private registry.

## More Documentation

- [Using Cypress](/packages/cypress)
- [Using Jest](/packages/jest)
