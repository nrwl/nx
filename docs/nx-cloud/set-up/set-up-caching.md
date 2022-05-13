# Adding Nx Cloud to an Nx Workspace

## Adding Nx Cloud When Creating a Workspace

You can enable Nx Cloud when creating a new workspace with `npx create-nx-workspace`.

```bash
? Use Nx Cloud? (It's free and doesn't require registration.)
  (Use arrow keys)
❯ Yes [Faster builds, run details, Github integration. Learn
  more at https://nx.app]
  No
```

This will connect your workspace to Nx Cloud, so you can start testing it out right away.

## Adding Nx Cloud to an Existing Workspace

If you are on the latest version of Nx, you can connect your existing Nx workspace to Nx Cloud by running `nx connect-to-nx-cloud`.

If you are using an older version of Nx (`< 12.0.0`), you can connect your workspace by adding the `@nrwl/nx-cloud` package to your workspace and running `nx g @nrwl/nx-cloud:init`.

## Connecting Your Workspace to Your Nx Cloud Account

After you have enabled Nx Cloud in your workspace, you will see the following:

```bash
>  NX   NOTE  Nx Cloud has been enabled

  Your workspace is currently public. Anybody with code access
  can view the workspace on nx.app.

  You can connect the workspace to your Nx Cloud account at
  https://nx.app/orgs/workspace-setup?accessToken=N2Y3NzcyO...
  (You can do this later.)
```

Click on this link to associate the workspace with your Nx Cloud account. If you don't have an Nx Cloud account, you can create one on the spot.

After you claim your workspace, you will be able to manage permissions, create access tokens, set up billing, and so forth.

If you lose this link, you can still connect your workspace to Nx Cloud. Go to [nx.app](https://nx.app), create an account, and connect your workspace using the access token from `nx.json`.
