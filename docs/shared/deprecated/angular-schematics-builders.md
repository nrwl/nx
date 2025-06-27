---
title: 'Angular Schematics and Builders'
description: 'Learn about the deprecation of Angular schematics and builders in Nx 17, and how to handle interoperability between Nx and Angular CLI tools.'
---

# Angular Schematics and Builders

As of Nx 17, official Nx plugins no longer export [schematics](https://angular.dev/tools/cli/schematics) and [builders](https://angular.dev/tools/cli/cli-builder) that can be directly consumed by the Angular CLI. Since Angular CLI users are not a large portion of Nx's user base, it made sense to stop maintaining that code.

Currently, the Angular CLI can only run its own schematics and builders. The Nx CLI is still able to directly run any schematics or builders created for the Angular CLI as well as Nx's own generators and executors. The only thing that has changed is that Nx is no longer taking the extra step of converting our own code into a format that the Angular CLI recognizes.

To switch from using the Angular CLI to using the Nx CLI follow the [migrating an Angular CLI project to Nx](technologies/angular/migration/angular) recipe.

## Interop between Nx Generators and Angular Schematics

You can wrap any Nx generator with the [convertNxGenerator](/reference/core-api/devkit/documents/convertNxGenerator) function and re-export it in your own plugin as a schematic. This is helpful if you still want to support the Angular CLI.

To convert an existing Angular Schematic to an Nx Generator, use the [wrapAngularDevkitSchematic](/reference/core-api/devkit/documents/ngcli_adapter/wrapAngularDevkitSchematic) utility function. This is helpful if you want to [programmatically call](/extending-nx/recipes/composing-generators) an Angular Schematic inside of a [custom Nx Generator](/extending-nx/recipes/local-generators).

## Interop between Nx Executors and Angular Builders

You can wrap any Nx executor with the [convertNxExecutor](/reference/core-api/devkit/documents/convertNxExecutor) function and re-export it in your own plugin as a builder.

There is no existing utility function to convert an Angular Builder to an Nx Executor. If you want to [programmatically call](/extending-nx/recipes/compose-executors) an Angular Builder inside of a [custom Nx Executor](extending-nx/recipes/local-executors), you can import the Angular Builder into your Nx Executor's implementation and call it directly.
