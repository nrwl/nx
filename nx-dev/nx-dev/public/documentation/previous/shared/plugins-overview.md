# Plugins

Nx plugins are npm packages that contain generators and executors to extend an Nx workspace. Generators are blueprints to create or modify code, and executors perform actions on the code.

The [Workspace](/{{framework}}/workspace/nrwl-workspace-overview) plugin contains executors and generators that are useful for any Nx workspace. It should be present in every Nx workspace and other plugins build on it.

There are plugins for application frameworks like [Angular](/{{framework}}/angular/overview), [Express](/{{framework}}/express/overview), [Gatsby](/{{framework}}/gatsby/overview), [Nest](/{{framework}}/nest/overview), [Next](/{{framework}}/next/overview), [Node](/{{framework}}/node/overview), [React](/{{framework}}/react/overview) and [Web](/{{framework}}/web/overview). There are also plugins to help manage tooling ([Cypress](/{{framework}}/cypress/overview), [Jest](/{{framework}}/jest/overview), [Linter](/{{framework}}/linter/eslint) and [Storybook](/{{framework}}/storybook/overview)).

The [Nx Plugin](/{{framework}}/nx-plugin/overview) plugin helps you build your own custom plugins.

## nx list

Use the `nx list` command to see installed and available plugins. Both Nrwl maintained (`@nrwl/something`) and community plugins are listed.

```bash
❯ nx list
>  NX  Installed plugins:
  @nrwl/angular (builders,schematics)
  @nrwl/cypress (builders,schematics)
  @nrwl/jest (builders,schematics)
  @nrwl/linter (builders)
  @nrwl/nest (schematics)
  @nrwl/node (builders,schematics)
  @nrwl/nx-cloud (schematics)
  @nrwl/workspace (builders,schematics)
>  NX  Also available:
  @nrwl/express (builders,schematics)
  @nrwl/next (builders,schematics)
  @nrwl/react (builders,schematics)
  @nrwl/storybook (builders,schematics)
  @nrwl/web (builders,schematics)
>  NX  Community plugins:
  @nxtend/ionic-react - An Nx plugin for developing Ionic React applications and libraries
  @angular-architects/ddd - Nx plugin for structuring a monorepo with domains and layers
  @offeringsolutions/nx-karma-to-jest - Nx plugin for replacing karma with jest in an Nx workspace
  @flowaccount/nx-serverless - Nx plugin for node/angular-universal schematics and deployment builders in an Nx workspace
  @dev-thought/nx-deploy-it - Nx plugin to deploy applications on your favorite cloud provider
```

## See Also

[Nx Community Plugins](/nx-community)
