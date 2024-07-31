---
title: 'Migrating an AngularJS Project into an Nx Workspace'
slug: 'migrating-an-angularjs-project-into-an-nx-workspace'
authors: ['Philip Fulcher']
cover_image: '/blog/images/2020-06-17/1*CKLoMCkrqGxE7-VhoozoNA.png'
tags: [nx, release]
---

Nx offers first-class support for Angular and React out-of-the-box. But one of the questions the Nrwl team often hears from the community is how to use AngularJS (Angular 1.x) in Nx. Nx is a great choice for managing an AngularJS to Angular upgrade, or just for consolidating your existing polyrepo approach to AngularJS into a monorepo to make maintenance a little easier.

In this article, you’ll learn how to:

- Create an Nx workspace for an AngularJS application
- Migrate an AngularJS application into your Nx workspace
- Convert an existing build process for use in Nx
- Use Webpack to build an AngularJS application
- Run unit and end-to-end tests

For this example, you’ll be migrating the [Real World AngularJS](https://github.com/gothinkster/angularjs-realworld-example-app) application from [Thinkster.io](https://thinkster.io/). You should clone this repo so you have access to the code before beginning.

There is also a [repo](https://github.com/nrwl/nx-migrate-angularjs-example) that shows a completed example of this guide.

> The RealWorld app is a great example of an AngularJS app, but it probably doesn’t have the complexity of your own codebase. As you go along, I’ll include some recommendations on how you might apply this example to your larger, more complex application.

## Creating your workspace

To start migrating the Real World app, create an Nx workspace:

```shell
npx create-nx-workspace@latest nx-migrate-angularjs
```

When prompted, choose the `empty` preset. The other presets use certain recommended defaults for the workspace configuration. Because you have existing code with specific requirements for configuration, starting with a blank workspace avoids resetting these defaults. This gives you the ability to customize the workspace for the incoming code.

At the next prompt, choose `Angular CLI` for your workspace CLI. While you may not be using Angular now, this gives you the best option to upgrade to Angular later. The Angular CLI is also the best CLI option for using Karma and Protractor, the two testing suites most commonly used for AngularJS.

```
? What to create in the new workspace empty \[an empty workspace\]? CLI to power the Nx workspace Angular CLI \[Extensible CLI for Angular applications. Recommended for Angular projects.\]
```

## Creating your app

Your new workspace doesn’t have much in it because of the `empty` preset. You need to generate an application to have some structure created. Add the Angular capability to your workspace:

```
ng add @nrwl/angular
```

When prompted, make a choice of unit test runner and e2e test runner:

```
? Which Unit Test Runner would you like to use for the application? Karma \[ [https://karma-runner.github.io](https://karma-runner.github.io) \]? Which E2E Test Runner would you like to use? Protractor \[ [https://www.protractortest.org](https://www.protractortest.org) \]
```

For this example, use Karma and Protractor, the most common unit test runner and e2e test runner for AngularJS.

> Codebases with existing unit and e2e tests should continue to use whatever runner they need. We’ve chosen Karma and Protractor here because it’s the most common. If you’re going to be adding unit testing or e2e as part of this transition and are starting fresh, we recommend starting with Jest and Cypress.

With the Angular capability added, generate your application:

```
ng generate @nrwl/angular:application — name=realworld
```

Accept the default options for each prompt:

```
? Which stylesheet format would you like to use? CSS? Would you like to configure routing for this application? No
```

> The RealWorld app doesn’t have any styles to actually bundle here. They’re all downloaded from a CDN that all of the RealWorld apps use. If your codebase uses something other than CSS, like Sass or PostCSS, you can choose that here.

## Migrating dependencies

Copy the dependencies from the RealWorld app’s `package.json` to the `package.json` in your workspace. Split the existing dependencies into `dependencies` (application libraries) and `devDependencies` (build and test libraries). Everything related to gulp can go into `devDependencies`.

Your `package.json` should now look like this:

> For your own project, you need to switch to npm if you’re using another package manager like bower. [Learn more about switching away from bower](https://bower.io/blog/2017/how-to-migrate-away-from-bower/).

## Migrating application code

This Angular application that you generated has the configuration that you need, but you don’t need any of its application code. Delete the contents of `apps/realworld/src/app.`

Starting in the `js` folder of the realworld app, copy all of the application code into `apps/realworld/src/app`. The resulting file tree should look like this:

```
_apps
|\_\_\_\_realworld-e2e
|\_\_\_\_realworld
| |\_\_\_\_src
| | |\_\_\_\_index.html
| | |\_\_\_\_app
| | | |\_\_\_\_settings
| | | |\_\_\_\_home
| | | |\_\_\_\_config
| | | |\_\_\_\_auth
| | | |\_\_\_\_layout
| | | |\_\_\_\_components
| | | |\_\_\_\_profile
| | | |\_\_\_\_article
| | | |\_\_\_\_services
| | | |\_\_\_\_editor
| | | |\_\_\_\_app.js
| | |\_\_\_\_styles.css
| | |\_\_\_\_environments
| | |\_\_\_\_main.ts
| | |\_\_\_\_test.ts
| | |\_\_\_\_assets_
```

> You most likely have your own AngularJS project written in JavaScript as well. Continue to use JavaScript through the rest of this example, but we strongly recommend switching AngularJS projects to TypeScript, especially if you’re planning an upgrade to Angular.

## Modifying index.html and main.ts

Your generated application has an `index.html` provided. However, it’s set up for an Angular application, not an AngularJS application. Replace the contents of `apps/realworld/src/index.html` with the `index.html` from the RealWorld app.

Your application also has a `main.ts` file that is responsible for bootstrapping your app. Again, you don’t need much from this file anymore. Replace its contents with:

```
import ‘./app/app.js’;
```

And re-name it to `main.js`. This imports the existing `app.js` file from the RealWorld app which bootstraps the app.

## Adding existing build and serve processes

If you’re looking at the example repo, the code for this section is available on the branch `initial-migration`. This section is an interim step that continues to use gulp to build and serve the app locally. You’ll replace gulp in the next section.

The RealWorld app uses gulp 3.9.1 to build. This version is not supported anymore and doesn’t run on any version of Node greater than 10.\*. To build this using gulp, you need to install an appropriate version of Node and make sure you re-install your dependencies. If this isn’t possible (or you just don’t want to), feel free to skip to the next section. The webpack build process should run in any modern Node version.

The RealWorld app uses gulp to build the application, as well as provide a development server. To verify that the migration has worked, stay with that build process for now.

> During migration, you should take a small step and confirm that things work before moving ahead. Stopping and checking to see that your app still builds and functions is essential to a successful migration.

Copy the `gulpfile.js` over from the RealWorld app and put it in `apps/realworld`. This is where all configuration files reside for the application. Make some adjustments to this file so that your build artifacts land in a different place. In an Nx workspace, all build artifacts should be sent to an app-specific folder in the `dist` folder at the root of your workspace. Your `gulpfile.js` should look like this:

You need to point your `build` and `serve` tasks at this gulp build process. Typically, an Angular app is built using the Angular CLI, but the Angular CLI doesn’t know how to build AngularJS projects. All of your tasks are configured in the `angular.json` file. Find the `build` and `serve` tasks and replace them with this code block:

Navigate around the application and see that things work.

> Your own project might not be using gulp. If you’re using webpack, you can follow the next section and substitute your own webpack configuration. If you’re using something else like grunt or a home-grown solution, you can follow the same steps here to use it. Use the `run-commands` builder and substitute in the commands for your project.

## Switching to webpack

So far, you’ve mostly gotten already existing code and processes to work. This is the best way to get started with any migration: get existing code to work before you start making changes. This gives you a good, stable base to build on. It also means you having working code now rather than hoping you’ll have working code in the future!

But migrating AngularJS code means you need to switch some of our tools to a more modern tool stack. Specifically, using webpack and babel is going to allow us to take advantage of Nx more easily. Becoming an expert in these build tools is outside the scope of this article, but I’ll address some AngularJS specific concerns. To get started, install a new dependency:

```
npm install babel-plugin-angularjs-annotate
```

Nx already has most of what you need for webpack added as a dependency. `babel-plugin-angularjs-annotate` is going to accomplish the same thing that `browserify-ngannotate` previously did in gulp: add dependency injection annotations.

Start with a `webpack.config.js` file in your application’s root directory:

> This webpack configuration is deliberately simplified for this tutorial. A real production-ready webpack config for your project is much more involved. See [this project](https://github.com/preboot/angularjs-webpack) for an example.

To use webpack instead of gulp, go back to your `angular.json` file and modify the `build` and `serve` commands again:

You may have noticed a rule for loading HTML in `webpack.config.js`. You need to modify some of your AngularJS code to load HTML differently. The application previously used the template cache to store all of the component templates in code, rather than download them at run time. This works, but you can do things a little better with webpack.

Rather than assigning `templateUrl` for your components, you can instead import the HTML and assign it to the `template` attribute. This is effectively the same as writing your templates in-line, but you still have the benefit of having a separate HTML file. The advantage is that the template is tied to its component, not a global module like the template cache. Loading all templates into the template cache is more performant than individually downloading templates, but it also means your user is downloading every single component’s template as part of start-up. This was fine in AngularJS when you didn’t easily have access to lazy-loading, so you always had a large up-front download cost. As you begin to upgrade to Angular or other modern frontend frameworks, you gain access to lazy-loading: only loading code when it’s necessary. By making this change now, you set yourself up for success later.

To accomplish this, open `config/app.config.js` which is the main app component. Modify it like this:

This change loads the HTML code directly and sets it to the template attribute of the component. The HTML rule that you specified in the webpack config takes care of loading the HTML correctly and adding it to the template like this.

Now, go through each component of the application and make this change. To make sure that you’ve really modified every component correctly, delete the template cache file `config/app.templates.js` that gulp generated earlier.

> In an example like this, it’s reasonable to make this kind of change by hand. In a larger codebase, doing this manually could be very time-intensive. Look into an automated tool to do this for you, such as js-codemod or Angular schematics.

Run the application the same way as before:

```
ng serve realworld
```

## Unit testing

Unit testing can be an important part of any code migration. If you migrate your code into a new system, and all of your unit tests pass, you have a higher degree of confidence that your application actually works without manually testing. Unfortunately, the RealWorld application doesn’t have any unit tests, but you can add your own.

You need to install a few dependencies for AngularJS unit testing that Nx doesn’t provide by default:

```
npm install angular-mocks@1.5.11 karma-webpack
```

Earlier, you configured this app to use Karma as its unit test runner. Nx has provided a Karma config file for you, but you need to modify it to work with AngularJS:

Now add a unit test for the comment component:

This unit test does a check to make sure the component compiles and that it sets default permissions correctly.

To run the unit tests:

```
ng test
```

You should see green text as your test passes.

![[object HTMLElement]](/blog/images/2020-06-17/1*9JjRoI1WfOtCEvD1nhyN3A.avif)
_Unit tests passing_

## End to End testing

End to End (or E2E) testing is another important part of migration. The more tests you have to verify your code, the easier it is to confirm that your code works the same way it did before. Again, the realworld application doesn’t have any e2e tests, so you need to add your own.

Nx created `realworld-e2e` for you when you generated your app. There is an example test already generated in `apps/realworld-e2e/src/app.e2e-spec.ts`. It has a helper file named `app.po.ts`. The `spec` file contains the actual tests, while the `po` file contains helper functions to retrieve information about the page. The generated test checks to make sure the title of the app is displayed properly, an indication that the app bootstrapped properly in the browser.

You need to modify these files to account for the RealWorld app layout. Make the following modifications:

To run e2e tests, use the `e2e` command:

```
ng e2e
```

You should see a browser pop up to run the Protractor tests and then green success text in your console.

## Summary

- Nx workspaces can be customized to support AngularJS projects
- AngularJS projects can be migrated into an Nx workspace using existing build and serve processes
- Switching to Webpack can enable your Angular upgrade success later
- Unit testing and e2e testing can be used on AngularJS projects and can help ensure a successful migration

## Explore More

- [(Re)Introducing Nx Console](https://medium.com/re-introducing-nx-console-a21fa9f4f668)
- Get our [**free basic Nx workspaces course on youtube**](https://youtu.be/2mYLe9Kp9VM)**!**
- **Purchase our** **premium video course on advanced practices for Nx workspaces:** [**here!**](https://nxplaybook.com/p/advanced-nx-workspaces)

As always, if you are looking for enterprise consulting, training and support, you can find out more about how we work with our clients [here](https://nrwl.io/services/consulting).

![](/blog/images/2020-06-17/0*svF6tvmpOmRUnjhP.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@nrwl_io_](https://medium.com/@nrwl_io) _to read more about Nx and Nrwl. Also follow_ [_Nx_](https://www.twitter.com/NxDevtools)_, and_ [_Nrwl_](https://www.twitter.com/nrwl_io) _on Twitter!_

![](/blog/images/2020-06-17/0*rv9rnzG1cbCF7ROG.avif)
