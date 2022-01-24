## Getting Started

### Creating an Nx Workspace

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
❯ apps              [an empty workspace with no plugins with a layout that works best for building apps]
  core              [an empty workspace with no plugins set up to publish npm packages (similar to yarn workspaces)]
  ts                [an empty workspace with the JS/TS plugin preinstalled]
  react             [a workspace with a single React application]
  angular           [a workspace with a single Angular application]
  next.js           [a workspace with a single Next.js application]
  nest              [a workspace with a single Nest application]
  express           [a workspace with a single Express application]
  web components    [a workspace with a single app built using web components]
  react-native      [a workspace with a single React Native application]
  react-express     [a workspace with a full stack application (React + Express)]
```

Select the preset that works best for you

### Adding Nx to an Existing Monorepo

Run:

```bash
npx add-nx-to-monorepo@latest
```

## Documentation & Resources

A few links to help you get started:

- [Nx.Dev: Documentation, Guides, Interactive Tutorials](https://nx.dev)
- [Tutorial: Adding Nx to an Existing Monorepo](https://nx.dev/migration/adding-to-monorepo)
- [Official Nx YouTube Channel](https://www.youtube.com/c/Nrwl_io)
- [Blog Posts About Nx](https://blog.nrwl.io/nx/home)

<p style="text-align: center;"><a href="https://nx.dev/#learning-materials" target="_blank"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-courses-and-videos.svg" 
width="100%" alt="Nx - Smart, Fast and Extensible Build System"></a></p>
