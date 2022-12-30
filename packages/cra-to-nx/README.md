# Migrating CRA to Nx

This package will turn your React app into an [Nx workspace](https://nx.dev/) with [Vite](https://vitejs.dev/). To use this package, your React app must have been generated and kept the structure of [Create-React-App](https://reactjs.org/docs/create-a-new-react-app.html), with files generated either in js/jsx or ts/tsx.

## How to use

Go to your CRA React app directory and run the following command:

```
npx nx init
```

Nx will automatically detect that you are in a CRA project and add Nx, Vite, and Vitest for you.

## Ok, it's done, what do I do now?

### Run, build, lint, test

Your previous scripts still work:

```
# Serve and build app with Vite
npm start
npm run build

# Run unit tests with Vitest
npm test
```

### Generate code

Nx comes with code generators to automate repeatable tasks performed on your code.

Take a look at [this guide](https://nx.dev/plugin-features/use-code-generators).

And try generating a library:

```
nx generate lib ui-button
```

### Courses, guides, docs

- [Follow the Nx React tutorial](https://nx.dev/getting-started/react-standalone-tutorial)

- [Free Nx course on Egghead.io](https://egghead.io/playlists/scale-react-development-with-nx-4038)

- Or just use the VS Code Nx Extension, [Nx Console](/core-features/integrate-with-editors) to do all these using a UI.
