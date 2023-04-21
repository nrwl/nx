# Migrating an Angular CLI project to Nx

Within an Nx workspace, you gain many capabilities that help you build applications and libraries. If you are currently using an Angular CLI workspace, you can transform it into an Nx workspace.

## Migrating to a Standalone Angular App with Nx

You can migrate to a [Standalone Angular App](/concepts/integrated-vs-package-based#standalone-applications) with the command:

```shell
npx nx@latest init
```

This command will install the correct version of Nx based on your Angular version.

This will enable you to use the Nx CLI in your existing Angular CLI workspace while keeping your existing file structure in place. The following changes will be made in your repo to enable Nx:

- The `nx`, `@nx/workspace` and `prettier` packages will be installed.
- An `nx.json` file will be created in the root of your workspace.
- For an Angular 14+ repo, the `angular.json` file is split into separate `project.json` files for each project.

**Note:** The changes will be slightly different for Angular 13 and lower.

Your workspace is now powered by Nx! You can verify that your application still runs as intended:

- To serve, run `nx serve <app name>`.
- To build, run `nx build <app name>`.
- To run unit tests, run `nx test <app name>`.
- To see your project graph, run `nx graph`.

> Your project graph will grow as you add and use more applications and libraries.

Learn more about the advantages of Nx in the following guides:

- [Using Cypress for e2e tests](/packages/cypress)
- [Using Jest for unit tests](/packages/jest)
- [Computation Caching](/concepts/how-caching-works)
- [Rebuilding and Retesting What is Affected](/concepts/affected)

## From Nx Console

{% youtube
src="https://www.youtube.com/embed/vRj9SNVYKrE"
title="Nx Console Updates 17.15.0"
width="100%" /%}

Nx Console no longer supports the Angular CLI. Angular CLI users will receive a notice, asking if they want to switch to Nx.

When you click this button, we’ll run the `nx init` command to set up the Nx CLI, allowing for cached builds, and for you to share this cache with your teammates via Nx Cloud.

The script will make the following changes:

- Installs the `@nx/workspace` and `nx` packages.
  - If you opted into Nx Cloud, `nx-cloud` will be installed as well.
  - If your project's Angular version is greater than or equal to version 13, then the `@nx/angular` package will be installed as well.
- Creates an `nx.json` file in the root of your workspace.

By running this command and accepting Nx Cloud, Nx distributed caching is now enabled.

Once the script has run, commit the changes. Reverting this commit will effectively undo the changes made.

If you're not ready to make the change yet, you can come back to this later:

- If you're using Nx Console: open the Vs Code command palette and start typing "Convert Angular CLI to Nx Workspace".
- Regardless of using Nx Console (or your IDE): run `npx nx init` from the root of your project.

{% cards %}

{% card title="Nx and the Angular CLI" description="Differences between Nx and the Angular CLI" type="documentation" url="/more-concepts/nx-and-angular" /%}

{% card title="Angular CLI to Integrated Nx Workspace" description="Change the folder structure to use an integrated style" type="documentation" url="/recipes/adopting-nx-angular/angular-integrated" /%}

{% card title="Angular CLI manual migration" description="Add Nx by hand" type="documentation" url="/recipes/adopting-nx-angular/angular-manual" /%}

{% card title="Multiple Angular Repositories to one Nx Workspace" description="Combine multiple Angular CLI workspaces into one Nx workspace" type="documentation" url="/recipes/adopting-nx-angular/angular-multiple" /%}

{% /cards %}
