# CRA - to - Nx

This package will turn your React app into an [Nx workspace](https://nx.dev/). To use this package, your React app must have been generated and kept the structure of [Create-React-App](https://reactjs.org/docs/create-a-new-react-app.html), with files generated either in js/jsx or ts/tsx.

This tool follows the steps described in this [migration guide](https://nx.dev/migration/migration-cra), with some enhancements.

It will, essentially, generate a new Nx workspace, and then place your existing CRA React app in the `apps` directory of the Nx workspace, while configuring the Nx workspace as needed.

## Before starting

As this package will change your folder structure and edit some of your files, you must commit any local changes you have, to start with clean history. In any case, to protect you, the package will exit if there are local uncommited changes.

## How to use

Go to your CRA React app directory and run the following command:

```
npx cra-to-nx
```

Then just sit back and wait. After a while you will be able to take advantage of the [full magic of Nx](https://nx.dev/latest/react/getting-started/getting-started).

## Ok, it's done, what do I do now?

### Run, build, lint, test

You can try the following commands:

```
nx serve your-app-name
nx build your-app-name
nx lint your-app-name
nx test your-app-name
```

### Generate code

Take a look at [this guide](https://nx.dev/latest/react/workspace/generators/using-schematics)

Or just try generating a library:

```
nx generate lib ui-button
```

### Courses, guides, docs

- [Follow the Nx React tutorial](https://nx.dev/react-tutorial/01-create-application)

- [Free Nx course on Egghead.io](https://egghead.io/playlists/scale-react-development-with-nx-4038)

- Or just use the VS Code Nx Extension, [Nx Console](https://nx.dev/latest/react/getting-started/console) to do all these using a UI.

## So, now I just have my React app in a monorepo?

No. You have your React app in an **Nx workspace**. So you also have the full power of Nx tools. You can watch this [10-minute quick overview](https://youtu.be/sNz-4PUM0k8) if you want to know more.
