## Code Generation

**Nx** extends the power of the AngularCLI. Under the hood of the AngularCLI
resides the new `@angular-devkit/schematics` package. The AngularCLI comes with a set of schematics
that help generate new files and folders from a command. **Nx** comes with a package called 
`@nrwl/schematics`. This schematics package focuses on the generation of files and folders 
that help you implement patterns.

For example, **Nx** comes with a set of schematics for creating apps and creating libs.

You can run `schematics @nrwl/schematics:app --name=myapp` to create a new Angular application in your Nx Workspace.

You can run `schematics @nrwl/schematics:lib --name=mylib` to create a new TypeScript library in your Nx Workspace (shared classes/functions/etc).

You can run `schematics @nrwl/schematics:lib --name=mylib --ngmodule` to create a new Angular library in your Nx Workspace (a NgModule).

**Nx** also comes with schematics for generating new [NgRx](https://github.com/ngrx/platform) code.
