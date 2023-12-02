# Angular Schematics and Builders

As of Nx 17, official Nx plugins no longer export [schematics](https://angular.io/guide/schematics) and [builders](https://angular.io/guide/cli-builder) that can be directly consumed by the Angular CLI. Since Angular CLI users are not a large portion of Nx's user base, it made sense to stop maintaining that code.

Currently, the Angular CLI can only run its own schematics and builders. The Nx CLI is still able to directly run any schematics or builders created for the Angular CLI as well as Nx's own generators and executors. The only thing that has changed is that Nx is no longer taking the extra step of converting our own code into a format that the Angular CLI recognizes.

To switch from using the Angular CLI to using the Nx CLI follow the [migrating an Angular CLI project to Nx](/recipes/angular/migration/angular) recipe.

## Converting Nx Generators to Schematics and Nx Executors to Builders

If you need to still support the Angular CLI, you can wrap any Nx generator with the [convertNxGenerator](/nx-api/devkit/documents/convertNxGenerator) function and re-export it in your own plugin as a schematic. In the same way, you can wrap any Nx executor with the [convertNxExecutor](/nx-api/devkit/documents/convertNxExecutor) function and re-export it in your own plugin as a builder.
