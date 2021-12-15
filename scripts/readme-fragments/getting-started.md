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
❯ empty             [an empty workspace with a layout that works best for building apps]
  npm               [an empty workspace set up to publish npm packages (similar to and compatible with yarn workspaces)]
  react             [a workspace with a single React application]
  angular           [a workspace with a single Angular application]
  next.js           [a workspace with a single Next.js application]
  gatsby            [a workspace with a single Gatsby application]
  nest              [a workspace with a single Nest application]
  express           [a workspace with a single Express application]
  fastify           [a workspace with a single Fastify application]
  web components    [a workspace with a single app built using web components]
  react-express     [a workspace with a full stack application (React + Express)]
  angular-nest      [a workspace with a full stack application (Angular + Nest)]
```

Select the preset that works best for you.
