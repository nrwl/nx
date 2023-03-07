# Migrating a Create-React-App project into an Nx Workspace

Create-React-App (CRA) is one of the most widely used tool for creating, building and testing a React app. This guide will show you how to move an app generated with CRA into an Nx workspace. Once the migration process is complete, you'll be able to take advantage of all of Nx's features without needing to completely recreate your build process.

## Automated migration

The easiest way to setup Nx in your CRA project is to use the automated migration tool.

```shell
npx nx@latest init
```

{% callout type="note" title="Want to migrate to a monorepo instead?" %}
This automatically migrates to an [Nx standalone setup](/concepts/integrated-vs-package-based#standalone-applications). If you would rather migrate to a Nx monorepo setup, pass the `--integrated` flag.
{% /callout %}

The command above will detect that the project is generated with CRA, and that it has not been _ejected_, or _
customized_ with either `react-app-rewired` or `@craco/craco`. If the project has either been ejected or customized,
then the migration will still continue but you will be prompted for more information.

That's it!

{% callout type="note" title="Vite" %}
You will notice that the project now uses [Vite](https://vitejs.dev/) and [Vitest](https://vitest.dev/) to build and
test your application. Vite is a next-gen tooling for building frontend applications, and is much faster than Webpack (
which CRA uses).

If you do not want to use Vite, you can run `npx nx@latest init --vite=false` instead.
{% /callout %}

## Try Nx

Use the same scripts as before, and Nx will run underneath the hood with `nx exec`.

```shell
npm start
npm run build
npm test
```

`build` and `test` are set up to automatically cache their results. Subsequent runs of `npm run build` (without changing any code), for example, should only take a couple seconds.
