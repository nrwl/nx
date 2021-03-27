# Plugins

Nx plugins are npm packages that contain schematics and builders to extend a Nx workspace. Schematics are blueprints to create or modify code, and builders perform actions on the code.

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
