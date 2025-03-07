---
title: Using Yarn Plug'n'Play with Nx
description: Learn how to configure and use Yarn Plug'n'Play (PnP) in your Nx workspace to improve installation speed, reduce disk usage, and enforce dependency constraints.
---

# Using Yarn Plug'n'Play

Plug'n'Play (PnP) is an innovative installation strategy for Node that tries to solve the challenges of using `node_modules` for storing installed packages:

- slow installation process
- slow node runtime cold start
- expensive packages diffing when adding new packages
- no ability to restrict access and enforce hoisting/nesting

Instead of using the `node_modules` folder, `PnP` creates a map from package names to hoisted package versions and creates dependency edges between packages. The packages are kept in `zip` archives which makes caching and restoring faster.

Read more about `PnP` on [Yarn's official docs](https://yarnpkg.com/features/pnp).

## Switching to Yarn v2+ (aka Berry)

When you run `create-nx-workspace` with the optional `--pm=yarn` flag, Nx uses the default yarn version set in your global `.yarnrc.yml` file (usually in the root of your user folder). To check your current yarn version, run:

```shell
 yarn --version
```

If the version is in the `1.x.x` range, the workspace will be created with yarn classic. To migrate an existing yarn classic workspace to the modern version of yarn, also known as `Berry`, run:

```shell {% path="~/workspace" %}
 yarn set version stable
```

This command will update `.yarnrc.yml` with the path to the local yarn `bin` of the correct version and will set the `packageManager` property in the root `package.json`:

```jsonc {% fileName="package.json" %}
{
  // ...
  "packageManager": "yarn@3.6.1"
}
```

## Switching to PnP

Once you are on the modern version of yarn, you can use the following command to switch to `PnP`:

```shell {% path="~/workspace" %}
 yarn config set nodeLinker pnp
```

Your `.yarnrc.yml` will now have `nodeLinker` set to a proper method:

```yml {% fileName=".yarnrc.yml" %}
nodeLinker: pnp
```

Once the config is changed you need to run the install again:

```shell {% path="~/workspace" %}
 yarn install
```

Running install generates a `.pnp.cjs` file that contains a mapping of external packages and strips all the packages from the `node_modules`.

## Dealing with Inaccessible Dependencies

When using Yarn Berry, Nx will set the `nodeLinker` property to a backward compatible `node-modules` value by default. This is to ensure your repository works out of the box.

Some packages come with broken dependency requirements so using strict `PnP` can lead to broken builds. This results in errors similar to the one below:

```shell {% path="~/workspace" command="yarn nx build my-project" %}
Error: [BABEL]: @babel/plugin-transform-react-jsx tried to access @babel/core (a peer dependency) but it isn't provided by your application; this makes the require call ambiguous and unsound.

Required package: @babel/core
```

The problem above is something we need to fix by ensuring the requested peer dependency exists and is available:

```shell {% path="~/workspace" %}
 yarn add -D @babel/core
```

Sometimes, simply adding a missing package doesn't work. In those cases, the only thing we can do is contact the author of the package causing the issues and notify them of the missing dependency requirement.
The alternative is to switch back to using the `node-modules` node linker.
