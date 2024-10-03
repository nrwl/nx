---
title: 'Set up Tailwind CSS with Angular in an Nx workspace'
slug: 'set-up-tailwind-css-with-angular-in-an-nx-workspace'
authors: ['Leosvel Pérez Espinosa']
cover_image: '/blog/images/2022-01-28/1*igoocYqr8gj8n9t8qr5cuA.png'
tags: [nx]
---

[**Tailwind CSS**](https://tailwindcss.com/) is a utility-first CSS framework packed with a lot of good functionality out of the box while providing a high level of customization. It has gained a lot of attention since it came out and it’s a good option when it comes to styling our applications.

In this blog post, we are going to see how we can use **Tailwind CSS** with [**Angular**](https://angular.io/) in an **Nx** monorepo. We are going to be looking at different scenarios and how to approach them.

Let’s get started!

> Please note that this blog post is not meant to be a **Tailwind CSS** or **Angular** tutorial. The purpose is to show how to use them together and how **Nx** can help to improve the developer experience and expand the native **Angular** capabilities when working with **Tailwind CSS**.

## What are we going to build?

The final result of what we are going to be building can be found in this Github repository: [https://github.com/leosvelperez/angular-tailwind-nx](https://github.com/leosvelperez/angular-tailwind-nx).

We are going to create 2 simple applications with the following layout:

![](/blog/images/2022-01-28/1*OXo64rzyF-5nKO2fbpG4xg.avif)
_Applications mockup_

We’ll start by creating one application with the required markup and **Tailwind CSS** utility classes to achieve the above layout. Then, we’re going to leverage **Nx**’s library support and extract some common UI components into 2 different shared libraries:

- a regular non-buildable library containing the header,
- a buildable library containing the card elements.

At that point, we’ll create the second application using the components exposed by those shared libraries. Finally, we’ll extract the button elements to a publishable library and adjust both applications to use them.

The idea is to show how different applications can still use the same components and have them styled differently using **Tailwind CSS**. Both applications in this blog post will share the same layout, but the approach explained here would apply to applications with different layouts sharing the same UI components.

> Discussing the different types of libraries and the motivation to use them goes beyond the scope of this blog post. We’ll use the three different types just to showcase how to use **Tailwind CSS** with each of them. To know more about them, please check [/concepts/decisions/project-size](/concepts/decisions/project-size) and [/concepts/buildable-and-publishable-libraries](/concepts/buildable-and-publishable-libraries).

## Setting up the Nx workspace

First things first! We start by creating a new **Nx** workspace where our applications and libraries will be located. To do that, we can run:

```shell
npx create-nx-workspace@latest angular-tailwind-nx --pm=yarn
✔ What to create in the new workspace · angular
✔ Application name                    · app1
✔ Default stylesheet format           · css
✔ Use Nx Cloud? (It's free and doesn't require registration.) · No
```

> Passing the `--packageManager` (or `--pm`) flag allows us to change the package manager. If not passed, it defaults to `npm`.

The above command creates a workspace called `angular-tailwind-nx` and asks us a few questions to help us set up the workspace. We chose the `angular` preset, provided `app1` for the initial **Angular** application name, chose `css` as the stylesheet to use, and this time chose not to use [**Nx Cloud**](/nx-cloud) but feel free to opt-in to use the **Nx Cloud** free tier to benefit from distributing the computation caching of your projects.

> Any of the stylesheet options can be used. Also, using **Nx Cloud** or not doesn’t affect setting up **Tailwind CSS**.

Now that we have a workspace with an **Angular** application ready to be used, let’s start adding some **Tailwind CSS** magic!

## Adding Tailwind CSS

**Angular** added native support for building applications using **Tailwind CSS** a while ago. Still, we need to set it up in the workspace, and to do so, we can use the `@nrwl/angular:setup-tailwind` generator by simply running:

```shell
npx nx generate @nrwl/angular:setup-tailwind app1
```

The above command will do a few things for us:

- It will check if `tailwindcss` is already installed and if not installed, it will install the necessary packages (`tailwindcss`, `postcss` and `autoprefixer`)
- It will create a `tailwind.config.js` file in the project root with the default configuration to get started (specific to the installed version)
- It will recognize the project type and for applications, it will update the application styles entry point file located at `apps/app1/src/styles.css` by including the **Tailwind CSS** base styles

> The above generator supports **Tailwind CSS** v2 and v3.

Let’s take a look at the generated `apps/app1/tailwind.config.js` file:

```javascript {% fileName="tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
const { join } = require('path');

module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

We can see the `content` property is configured to scan for all the HTML and TypeScript files within our application and besides that, there’s also a call to a function called `createGlobPatternsForDependencies`. This is a pretty handy function that will identify the dependencies of the application and return the glob patterns for them. This ensures that **Tailwind CSS** utility classes that are used in the application’s dependencies are also taken into account and included in the final CSS of the application.

> Instead of using the `createGlobPatternsForDependencies`, we could just add the `_libs/**/*_` glob pattern that captures all libraries, but that could lead to bundling more CSS than needed in monorepos with multiple applications. This would happen because all applications would be scanning all libraries, regardless of whether they are dependencies or not. Such a glob pattern could also lead to scaling issues in large monorepos due to the amount of libraries to scan.

We can also see that the generator updated the `apps/app1/src/styles.css` file with the **Tailwind CSS** bases styles:

```css {% fileName="styles.css" %}
@tailwind base;
@tailwind components;
@tailwind utilities;
```

And that’s all we need. We can now go ahead and add our custom theme and layout to achieve the desired design.

## Adding a custom theme and the application markup

First, we are going to update the `theme` section of the generated `apps/app1/tailwind.config.js`. We are going to overwrite the **Tailwind CSS** default theme and provide the custom palette of colors and spacing of our theme to be used throughout the application:

```javascript {% fileName="tailwind.config.js" %}
...

module.exports = {
  ...
  theme: {
    colors: {
      primary: {
        light: '#5eead4',
        DEFAULT: '#14b8a6',
        dark: '#0f766e',
      },
      secondary: {
        light: '#bae6fd',
        DEFAULT: '#0ea5e9',
        dark: '#0369a1',
      },
      white: '#ffffff',
      black: '#000000',
    },
    spacing: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
  },
  ...
};
```

Next, we update the `apps/app1/src/app/app.component.html` file with the required markup and several **Tailwind CSS** utility classes to style the application with the look & feel we are looking for:

```angular2html {% fileName="app.component.html" %}
<div class="font-mono">
  <header class="px-xl py-md bg-primary-light text-xl font-bold shadow-md">Angular + Tailwind CSS + Nx</header>

  <main class="max-w-xl md:max-w-2xl lg:max-w-6xl mx-auto py-xl px-md md:px-xl grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-3">
    <div class="flex flex-col p-lg bg-secondary-light shadow-md hover:shadow-lg">
      <div class="pb-md text-lg font-bold">Angular</div>
      <p class="mb-xl flex-1">
        Angular is an application design framework and development platform for creating efficient and sophisticated single-page apps.
      </p>
      <a
        class="py-sm px-md bg-primary-dark hover:bg-primary text-white flex self-end"
        href="https://angular.io/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Show me!
      </a>
    </div>

    <div class="flex flex-col p-lg bg-secondary-light shadow-md hover:shadow-lg">
      <div class="pb-md text-lg font-bold">Tailwind CSS</div>
      <p class="mb-xl flex-1">
        Tailwind CSS is a utility-first CSS framework packed with classes like flex, pt-4, text-center and rotate-90 that can be composed to build any design, directly in your markup.
      </p>
      <a
        class="py-sm px-md bg-primary-dark hover:bg-primary text-white flex self-end"
        href="https://tailwindcss.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Show me!
      </a>
    </div>

    <div class="flex flex-col p-lg bg-secondary-light shadow-md hover:shadow-lg">
      <div class="pb-md text-lg font-bold">Nx</div>
      <p class="mb-xl flex-1">
        The library for web and native user interfaces
      </p>
      <a
        class="py-sm px-md bg-primary-dark hover:bg-primary text-white flex self-end"
        href="https://react.dev/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Show me!
      </a>
    </div>
  </main>
</div>
```

With all set, let’s see it in action by running:

```shell
npx nx run app1:serve
```

Visiting [https://localhost:4200](https://localhost:4200) in your browser should show the application looking like the following screenshot:

![](/blog/images/2022-01-28/1*TkIVfzbeier6j0nlAeX7ig.avif)
_Application 1 screenshot_

That’s it! We have successfully created our application to fulfill the requirements we had. Next, we are going to start extracting pieces of the UI into shared libraries to reuse them with the second application.

## Tailwind CSS and Angular libraries in an Nx workspace

Before extracting our UI components into libraries, we need to take a step back and make sure we understand how **Tailwind CSS** works and the implications of the different types of libraries in an **Nx** workspace.

From [**Tailwind CSS** docs](https://tailwindcss.com/docs/installation):

> Tailwind CSS works by scanning all of your HTML files, JavaScript components, and any other templates for class names, generating the corresponding styles and then writing them to a static CSS file.

Any project can use the [**Tailwind CSS** CLI](https://tailwindcss.com/blog/standalone-cli) or [**PostCSS**](https://postcss.org/) with the `tailwindcss` plugin to scan the relevant files in the project and collect the usage of the **Tailwind CSS** utility classes, functions, and custom CSS directives (custom CSS [at-rules](https://developer.mozilla.org/en-US/docs/Web/CSS/At-rule)). With that information, the final CSS styles are generated.

**Angular** uses **PostCSS** to support **Tailwind CSS**. As we saw in a previous section, with the help of an **Nx** generator, it’s pretty straightforward to configure a **Tailwind CSS** for applications. Libraries can also be easily configured, but there are some nuances regarding how they are processed and whether they need to be configured or not.

In an **Nx** workspace, a regular library (non-buildable and non-publishable) is just a slice of an application that is only built as part of the build process of an application that consumes it. Because of that, as long as the application that consumes it has **Tailwind CSS** configured, the library code will be processed as expected even though the library itself doesn’t have a **Tailwind CSS** configuration. In fact, adding a `tailwind.config.js` file to the library won’t have any effect whatsoever (it’ll be ignored) because the library is never built on its own.

On the other hand, buildable and publishable libraries are meant to be built on their own and their compiled output to be shared with the consumers. Therefore, they need to be able to process any **Tailwind CSS** directive or function (e.g. `@apply`, `theme()`) when they are built. If no **Tailwind CSS** directive or function is used, then the configuration is not needed.

> Providing the configuration to a buildable or publishable library that doesn’t need it adds some unnecessary overhead to the build process. The executor will still load the configuration and the **PostCSS** plugin will process the stylesheets unnecessarily.

How does this work?

**Tailwind CSS** produces the relevant CSS code where the following directives and functions are used:

- `@tailwind`
- `@apply`
- `theme()`
- `screen()`

When the **PostCSS** plugin processes a file containing these, it processes them and produces the corresponding CSS code based on the provided configuration. If none of the above is used in a buildable or publishable library, no CSS is generated, and therefore, no configuration is needed. The actual CSS will be generated when building the application consuming those libraries.

> To know more about the above directives and functions you can take a look at [https://tailwindcss.com/docs/functions-and-directives](https://tailwindcss.com/docs/functions-and-directives).

But we do use **Tailwind CSS** utility classes in the libraries and CSS needs to be generated for them. So, how is the CSS generated for those classes if the libraries are not configured?

If we recall from a previous section, in our application’s `tailwind.config.js` file, we have the following:

```javascript {% fileName="tailwind.config.js" %}
...

module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  ...
};
```

The `content` property of the configuration tells **Tailwind CSS** where to look for usages of utility classes. When the **PostCSS** plugin finds a file using the `@tailwind` directive, it will collect all the utility classes for the layer specified by the directive in the files matching the glob patterns set in the `content` property of the configuration, and it will produce the CSS replacing the directive. It’s worth noting that the **PostCSS** plugin only scans the files collecting the utility classes that are used, it doesn’t process them. Only the file containing the `@tailwind` directive is updated with the resulting CSS.

Since we have our application configured to scan the relevant files within itself and also within its dependencies, the utility classes used in the libraries that are dependencies of the application will be picked up correctly and the CSS will be generated for them.

> It’s important to note that the support for **Tailwind CSS** for **Angular** libraries is only available using the `@nrwl/angular:ng-packagr-lite` executor for buildable libraries and the `@nrwl/angular:package` executor for publishable libraries.

Below is a small decision tree to check whether a **Tailwind CSS** configuration is needed for your library in an **Nx** workspace:

![](/blog/images/2022-01-28/1*x_nZUiADymUMNsmDpAU3aA.avif)
_Decision tree for the need of Tailwind CSS configuration in Angular libraries_

## Extracting the header into a library

Our application is looking good. At the same time, there’s a great opportunity to reuse some of its components in another application. Therefore, we are going to extract the shared components into several shared libraries.

> The applications of this blog post are very simple and it’s probably not worthy to extract the components into multiple libraries. We are doing it for illustrative purposes to cover the different scenarios we might find in real-life applications.

We’ll start by extracting the header of the application into a reusable component and placing it into a library. To do so, we start by creating a new **Angular** library in our workspace by running:

```shell
npx nx generate @nrwl/angular:lib lib1
```

Next, we create the component for the header in the library we just generated and we export it so it can be imported by consumers:

```shell
npx nx generate @nrwl/angular:component header --project=lib1 --export
```

Add the markup for the header to the `libs/lib1/src/lib/header/header.component.html`:

```html {% fileName="header.component.html" %}
<header class="px-xl py-md bg-primary-light text-xl font-bold shadow-md">
  Angular + Tailwind CSS + Nx
</header>
```

Import `Lib1Module` into our application’s `AppModule`:

```typescript {% fileName="app.module.ts" %}
...
import { Lib1Module } from '@angular-tailwind-nx/lib1';

@NgModule({
  ...
  imports: [BrowserModule, Lib1Module],
  ...
})
export class AppModule {}
```

And finally, replace the existing markup for the header in the `apps/app1/src/app/app.component.html` file with the newly created header component and leaving the rest of the file as-is:

```html {% fileName="app.component.html" %}
<div class="font-mono">
  <angular-tailwind-nx-header></angular-tailwind-nx-header>

  ...
</div>
```

At this point, if we serve again the application, everything should still be working the same way as before. We successfully extracted the header into a shared library and made it reusable.

## Extracting the card into a buildable library

Similar to the previous section we are going to start by creating a new library to add the card component to. The only difference is that this library is going to be buildable.

> If you are not aware of what buildable libraries are or what problem do they intend to solve, please make sure to read [/ci/incremental-builds](/recipes/angular/setup-incremental-builds-angular).

Run the following command to generate the library:

```shell
npx nx generate @nrwl/angular:lib lib2 --buildable
```

Next, we configure **Tailwind CSS** for it:

```shell
npx nx generate @nrwl/angular:setup-tailwind lib2
```

As explained in a previous section when we did the same for the application, the above command will install any required dependencies if needed, create the `tailwind.config.js` file and in the specific case of libraries, it will also add the `tailwindConfig` property to the `build` target of the project configuration.

> **Angular** applications, buildable and publishable libraries can be created with **Tailwind CSS** support with a single command. We’ll see that in the upcoming section. The `_@nrwl/angular:setup-tailwind_` generator is used to add **Tailwind CSS** support to existing projects.

Then, we create the card component:

```shell
npx nx generate @nrwl/angular:component card --project=lib2 --export
```

We add the component to the library entry point located in `libs/lib2/src/index.ts`:

```typescript {% fileName="index.ts" %}
...
export * from './lib/card/card.component';
```

Then, we update the card component files to provide the desired functionality:

```typescript {% fileName="card.component.ts" %}
import { Component, Input } from '@angular/core';

@Component({
  selector: 'angular-tailwind-nx-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.css'],
})
export class CardComponent {
  @Input() title?: string;
  @Input() url?: string;
}
```

```angular2html {% fileName="card.component.html" %}
<div class="h-full flex flex-col p-lg bg-secondary-light shadow-md hover:shadow-lg">
  <div class="pb-md text-lg font-bold">{{ title }}</div>
  <p class="mb-xl flex-1">
    <ng-content></ng-content>
  </p>
  <a
    class="py-sm px-md bg-primary-dark hover:bg-primary text-white flex self-end"
    href="{{ url }}"
    target="_blank"
    rel="noopener noreferrer"
  >
    Show me!
  </a>
</div>
```

Import `Lib2Module` into our application’s `AppModule`:

```typescript {% fileName="app.module.ts" %}
...
import { Lib2Module } from '@angular-tailwind-nx/lib2';

@NgModule({
  ...
  imports: [BrowserModule, Lib1Module, Lib2Module],
  ...
})
export class AppModule {}
```

And finally, replace the existing markup for the cards in the `apps/app1/src/app/app.component.html` file with the newly created card component:

```angular2html {% fileName="app.component.html" %}

<div class="font-mono">
  <angular-tailwind-nx-header></angular-tailwind-nx-header>

  <main class="max-w-xl md:max-w-2xl lg:max-w-6xl mx-auto py-xl px-md md:px-xl grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-3">
    <angular-tailwind-nx-card title="Angular" url="https://angular.io/">
      Angular is an application design framework and development platform for creating efficient and sophisticated single-page apps.
    </angular-tailwind-nx-card>

    <angular-tailwind-nx-card title="Tailwind CSS" url="https://tailwindcss.com/">
      Tailwind CSS is a utility-first CSS framework packed with classes like flex, pt-4, text-center and rotate-90 that can be composed to build any design, directly in your markup.
    </angular-tailwind-nx-card>

    <angular-tailwind-nx-card title="React" url="https://react.dev/">
      The library for web and native user interfaces
    </angular-tailwind-nx-card>
  </main>
</div>
```

With that in place, we can serve the application and it should be working exactly as before, but our application is still not fully set up to consume the library build output. As it stands right now, when the application that’s consuming it is built, the library will be built together with it and its files will be processed as part of the application build pipeline.

To finish the buildable library setup, we can follow the instructions in [/recipes/angular/setup-incremental-builds-angular](/recipes/angular/setup-incremental-builds-angular). We need to install the `@nrwl/web` package, change the application `build` target executor to `@nrwl/angular:webpack-browser`, and change the application `serve` target executor to `@nrwl/web:file-server`:

```shell
yarn add -D @nrwl/web@latest
```

```json5 {% fileName="project.json" %}
{
  ...
  "targets": {
    "build": {
      "executor": "@nrwl/angular:webpack-browser",
      ...
    },
    "serve": {
      "executor": "@nrwl/web:file-server",
      "configurations": {
        "production": {
          "buildTarget": "app1:build:production"
        },
        "development": {
          "buildTarget": "app1:build:development"
        }
      },
      "defaultConfiguration": "development"
    },
    ...
  },
  ...
}
```

You can now go ahead and serve the application to check everything is working as expected. You should see the buildable library being built on its own before the application is built and served.

> The `@nrwl/web:file-server` executor uses the [http-server](https://www.npmjs.com/package/http-server) package to serve the built artifacts of our application. This is a lightweight HTTP server and it doesn’t do things like live-reload or HMR. Be sure to refresh your browser while making changes to see them reflected.

## Using Tailwind CSS directives and functions in buildable libraries

Our application is consuming a buildable library and still working as intended, but if we think about it, we didn’t configure our theme in the library’s `tailwind.config.js` file. So, how is it still working?

If we go back to the decision tree shared in a previous section, we’ll see that a buildable library only needs a **Tailwind CSS** configuration if we use a **Tailwind CSS** directive or function. As of right now, our library is not using any. We are just using some utility classes and those are processed correctly as part of the application build. You could go ahead and delete the `tailwind.config.js` file from the library and check that everything still works the same (if you do, please make sure to restore it before we continue).

Next, we are going to refactor our newly created card component to make use of some of these directives and functions and see the implications.

Update the card component files content as shown below:

```css {% fileName="card.component.css" %}
.card {
  @apply p-lg flex h-full flex-col shadow-md hover:shadow-lg;

  background-color: theme('colors.secondary.light');
}

.card-title {
  @apply text-lg font-bold;

  padding-bottom: theme('spacing.md');
}

.card-content {
  @apply mb-xl flex-1;
}
```

```angular2html {% fileName="card.component.html" %}
<div class="card">
  <div class="card-title">{{ title }}</div>
  <p class="card-content">
    <ng-content></ng-content>
  </p>
  ...
</div>
```

We created some CSS classes where we are applying the same styles we had in the component template. We are applying those styles by using a combination of the `@apply` directive and the `theme` function.

> Please note we are not recommending creating CSS classes for scenarios like the above. The card component is already a reusable component and there’s no need to extract CSS classes to style it. We are only extracting these classes to showcase how **Tailwind CSS** directives and functions can be correctly processed in buildable libraries. Make sure to check out the [**Tailwind CSS** recommendations for reusing styles](https://tailwindcss.com/docs/reusing-styles).

If we now serve our application (or build the library), we’ll find ourselves with the following error:

```
------------------------------------------------------------------------------
Building entry point '@angular-tailwind-nx/lib2'
------------------------------------------------------------------------------
/angular-tailwind-nx/libs/lib2/src/lib/card/card.component.css:2:3: The `p-lg` class does not exist. If `p-lg` is a custom class, make sure it is defined within a `@layer` directive.
```

This is to be expected. The library build is failing because now we are using some **Tailwind CSS** directives and functions, and therefore, those directives and functions are being processed within the library context. Since we haven’t touched the `tailwind.config.js` file, **Tailwind CSS** doesn’t know about our custom theme.

To solve the issue, we need to configure the library to be aware of our custom theme so it can process the library’s files correctly. Let’s update the `theme` property of the `libs/lib2/tailwind.config.js` file to match our application theme:

```javascript {% fileName="tailwind.config.js" %}
...
  theme: {
    colors: {
      primary: {
        light: '#5eead4',
        DEFAULT: '#14b8a6',
        dark: '#0f766e',
      },
      secondary: {
        light: '#bae6fd',
        DEFAULT: '#0ea5e9',
        dark: '#0369a1',
      },
      white: '#ffffff',
      black: '#000000',
    },
    spacing: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
  },
...
```

Now, we should see our application working correctly if we serve it again.

## Sharing the Tailwind CSS configuration between the application and the buildable library

Though we have successfully solved the issue and our workspace now has a library that can be built on its own and be cached, the experience is not great. We had to duplicate the application configuration in the buildable library. This introduces a maintainability concern and it will most likely be a cause for errors due to having to maintain them in sync. Also, we only have one buildable library in this small example, but imagine a real-life scenario where hundreds of these libraries need to be kept in sync. A nightmare!

Well, no need to fret!

If we think about it, the same reasoning behind creating shared libraries applies to this. We just need to share the **Tailwind CSS** configuration. To do so, we have a couple of options:

- Create a shared file containing and exporting the theme so it can be imported by every project’s `tailwind.config.js` file.
- Create a [**Tailwind CSS** preset](https://tailwindcss.com/docs/presets) to expose a base configuration for your projects.

The last option is the better one. We can take advantage of the **Tailwind CSS** built-in support for defining a base configuration to be reused across different projects. The first option is almost the same, with the difference that we have to manually handle merging the configurations.

We’ll go ahead and create a **Tailwind CSS** preset and we’ll then use it in our projects. Start by creating a `tailwind.config.js` file in the root of the workspace with the following content:

```javascript {% fileName="tailwind.config.js" %}
module.exports = {
  theme: {
    colors: {
      primary: {
        light: '#5eead4',
        DEFAULT: '#14b8a6',
        dark: '#0f766e',
      },
      secondary: {
        light: '#bae6fd',
        DEFAULT: '#0ea5e9',
        dark: '#0369a1',
      },
      white: '#ffffff',
      black: '#000000',
    },
    spacing: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
  },
  plugins: [],
};
```

We just added the configuration that is common to our projects to use as a base in each of them. Next, we need to add the preset configuration to each project.

Update both `apps/app1/tailwind.config.js` and `libs/lib2/tailwind.config.js` files to match the following:

```javascript {% fileName="tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
const { join } = require('path');
const sharedTailwindConfig = require('../../tailwind.config');

module.exports = {
  presets: [sharedTailwindConfig],
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
};
```

Notice how we added the preset and removed almost all the configuration because it’s already defined in the preset.

That’s all it takes. You can go ahead and serve the application (or refresh the browser if you are already serving it) to check everything is running correctly.

## Sharing the Tailwind CSS preset in a library

We now only have to maintain our theme in a single place as opposed to keeping in sync the configuration of all the different projects. But we can still improve the experience. As it stands, if you now make a change on the `tailwind.config.js` file located at the root of the workspace (our preset), the file server doesn’t pick up the change and therefore, it doesn’t rebuild the affected projects.

This happens because the file server is watching for changes under the `apps` and `libs` folders. The preset configuration is not under those directories, it’s in the root of the workspace.

It would be better if we place the preset configuration in a small shared library. By doing that, we not only solve the issue regarding detecting changes on it, but we also make its library appear on the [**Nx** project graph](/concepts/mental-model), and with that, we benefit from all the goodies associated with the project graph (affected commands, enforcing module boundaries constraints, etc.).

This library is only going to contain the `tailwind.config.js` file and no targets in the project configuration. There’s no generator among the **Nx** core plugins that generate such an empty library. We could use one of the library generators and remove some content, but let’s create it manually.

Start by creating a new folder `libs/tailwind-preset` and moving the `tailwind.config.js` file we created in the previous section at the root of the workspace to that folder.

Next, add the project to the `angular.json`:

```json5 {% fileName="angular.json" %}
{
  "version": 2,
  "projects": {
    ...
    "tailwind-preset": "libs/tailwind-preset"
  }
}
```

Create the configuration for the project in `libs/tailwind-preset/project.json`:

```json5 {% fileName="project.json" %}
{
  projectType: 'library',
  root: 'libs/tailwind-preset',
  sourceRoot: 'libs/tailwind-preset',
  targets: {},
  tags: [],
}
```

And finally, adjust both `apps/app1/tailwind.config.js` and `libs/lib2/tailwind.config.js` files to import the preset from the correct location:

```javascript {% fileName="tailwind.config.js" %}
...
const sharedTailwindConfig = require('../../libs/tailwind-preset/tailwind.config');
...
```

Once again, if we serve our application everything should still be working as expected, but now our file server will pick up the changes made to the **Tailwind CSS** preset configuration.

Also, if we visualize the workspace projects we’ll see how `app1` and `lib2` now have a dependency on `tailwind-preset`:

![](/blog/images/2022-01-28/1*F1p0OfL4WrmubTQ2QPX04Q.avif)
_Project graph showing dependencies between the projects in the workspace_

## Creating the second application

We are now at a stage where we can develop our second application without having to duplicate the common functionality. So, before going ahead and distributing our buttons in a publishable library, let’s first create the second application to see how we can reuse what we have been putting into libraries.

There’s one important thing to note though, this new application will have a different theme.

Generate the application by running the following command:

```shell
npx nx generate @nrwl/angular:app app2 --addTailwind --style=css --routing=false
```

The above command will generate the new application and it will configure **Tailwind CSS** as well. Using the `--addTailwind` flag will instruct the application generator to automatically run the `@nrwl/angular:setup-tailwind` generator when creating a new application.

> The `--addTailwind` flag is available in both `@nrwl/angular:app` and `@nrwl/angular:lib` generators.

Let’s now update the application to use the shared components and achieve the layout we are after. Start by updating the `apps/app2/src/app/app.module.ts` to import `Lib1Module` and `Lib2Module`:

```typescript {% fileName="app.module.ts" %}
...
import { Lib1Module } from '@angular-tailwind-nx/lib1';
import { Lib2Module } from '@angular-tailwind-nx/lib2';

@NgModule({
  ...
  imports: [BrowserModule, Lib1Module, Lib2Module],
  ...
})
export class AppModule {}
```

Next, update the `apps/app2/src/app/app.component.html` file with the required markup and **Tailwind CSS** utility classes to achieve our application’s layout and using the component exported by the shared libraries we previously created:

```angular2html {% fileName="app.component.html" %}
<div class="font-mono">
  <angular-tailwind-nx-header></angular-tailwind-nx-header>

  <main class="max-w-xl md:max-w-2xl lg:max-w-6xl mx-auto py-xl px-md md:px-xl grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-3">
    <angular-tailwind-nx-card title="Angular" url="https://angular.io/">
      Angular is an application design framework and development platform for creating efficient and sophisticated single-page apps.
    </angular-tailwind-nx-card>

    <angular-tailwind-nx-card title="Tailwind CSS" url="https://tailwindcss.com/">
      Tailwind CSS is a utility-first CSS framework packed with classes like flex, pt-4, text-center and rotate-90 that can be composed to build any design, directly in your markup.
    </angular-tailwind-nx-card>

    <angular-tailwind-nx-card title="React" url="https://react.dev/">
      The library for web and native user interfaces
    </angular-tailwind-nx-card>
  </main>
</div>
```

Like we did with `app1`, we also need to update the `build` and `serve` targets configuration for `app2` to be able to consume the buildable library compiled output. We do so by updating the `app2` configuration located in the `apps/app2/project.json` file:

```json5 {% fileName="project.json" %}

{
  ...
  "targets": {
    "build": {
      "executor": "@nrwl/angular:webpack-browser",
      ...
    },
    "serve": {
      "executor": "@nrwl/web:file-server",
      "configurations": {
        "production": {
          "buildTarget": "app1:build:production"
        },
        "development": {
          "buildTarget": "app1:build:development"
        }
      },
      "defaultConfiguration": "development"
    },
    ...
  },
  ...
}
```

Last but not least, we need to configure **Tailwind CSS** with our custom theme for `app2`. We’ll do that by updating the `apps/app2/tailwind.config.js` file with the following:

```javascript {% fileName="tailwind.config.js" %}
...
module.exports = {
  ...
  theme: {
    colors: {
      primary: {
        light: '#a5b4fc',
        DEFAULT: '#6366f1',
        dark: '#4338ca',
      },
      secondary: {
        light: '#e9d5ff',
        DEFAULT: '#a855f7',
        dark: '#7e22ce',
      },
      white: '#ffffff',
      black: '#000000',
    },
    spacing: {
      sm: '1rem',
      md: '1.5rem',
      lg: '2rem',
      xl: '3rem',
    },
  },
  ...
};
```

Now that we have the second application configured, let’s run it:

```shell
npx nx run app2:serve
```

> You can pass a `--port=4201` to the above command to run it in a different port if it’s in use or if you want to have both applications running side-by-side.

Now, open your browser and navigate to it where you should see the application looking like the following screenshot:

![](/blog/images/2022-01-28/1*LoOmmjSzfB33ho9NhcqQKQ.avif)
_Application 2 screenshot_

That does indeed look different, but something is off. The card background color is not right, it’s still the same used for `app1` even though we provided a different theme. Also, some of the spacing for the elements within the card doesn’t seem to have changed according to our configuration.

What is going on here?

You might have realized a couple of things by now:

- The card component comes from `lib2` which is a buildable library and as such, it’s built on its own using its own **Tailwind CSS** configuration
- `app1` and `lib2` use a **Tailwind CSS** preset to share the common configuration, while `app2` is adding its own

So, the first bullet point above would explain why the card component looks like the one rendered using the theme for `app1`. But that’s not exactly what we are seeing, the buttons inside the card look different than what we have in `app1`. This is explained by the fact that the buttons are styled without using any **Tailwind CSS** directive or function, they just use utility classes, so the CSS for them is generated in the `app2` build using the application configuration. The rest of the card does use directives and functions, so the CSS for that is generated in the `lib2` build using the library configuration.

Also, we previously created a **Tailwind CSS** preset so we could share the base configuration among different projects. The problem is that all those projects shared a common theme, but `app2` requires a different one, so we can’t just use the preset as it is right now.

So, how do we solve this?

Enter CSS variables!

We can configure the **Tailwind CSS** preset to use CSS variables. This will allow each application to provide its own values for the variables and therefore, it enables us to have multiple themes using the same **Tailwind CSS** configuration.

Let’s update our preset in the `libs/tailwind-preset/tailwind.config.js` file to use CSS variables instead of literal values:

```javascript {% fileName="tailwind.config.js" %}
module.exports = {
  theme: {
    colors: {
      primary: {
        light: 'var(--primary-light)',
        DEFAULT: 'var(--primary)',
        dark: 'var(--primary-dark)',
      },
      secondary: {
        light: 'var(--secondary-light)',
        DEFAULT: 'var(--secondary)',
        dark: 'var(--secondary-dark)',
      },
      white: 'var(--white)',
      black: 'var(--black)',
    },
    spacing: {
      sm: 'var(--spacing-sm)',
      md: 'var(--spacing-md)',
      lg: 'var(--spacing-lg)',
      xl: 'var(--spacing-xl)',
    },
  },
  plugins: [],
};
```

Next, we update the `apps/app2/tailwind.config.js` file to remove the explicit theme configuration and add the preset instead:

```javascript {% fileName="tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
const { join } = require('path');
const sharedTailwindConfig = require('../../libs/tailwind-preset/tailwind.config');

module.exports = {
  presets: [sharedTailwindConfig],
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
};
```

Since our preset no longer has any literal values for the theme properties, we need to set the values for the CSS variables in the application. Edit the `apps/app2/src/styles.css` file with the values for the theme variables:

```css {% fileName="styles.css" %}
... :root {
  /* Colors */
  --primary-light: #a5b4fc;
  --primary: #6366f1;
  --primary-dark: #4338ca;
  --secondary-light: #e9d5ff;
  --secondary: #a855f7;
  --secondary-dark: #7e22ce;
  --white: #ffffff;
  --black: #000000;

  /* Spacing */
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
}
```

We need to do the same for `app1`. Edit the `apps/app1/src/styles.css` file with the values for the theme variables:

```css {% fileName="styles.css" %}
... :root {
  /* Colors */
  --primary-light: #5eead4;
  --primary: #14b8a6;
  --primary-dark: #0f766e;
  --secondary-light: #bae6fd;
  --secondary: #0ea5e9;
  --secondary-dark: #0369a1;
  --white: #ffffff;
  --black: #000000;

  /* Spacing */
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

Let’s serve again `app2` and navigate to it to check the results of our changes:

![](/blog/images/2022-01-28/1*TwcAfPTrKRm1D9ydEFwWWA.avif)
_Application 2 screenshot_

Now we are talking!

This is what we wanted to see. Also `app1` is still working as expected with its different theme. We are successfully styling two different applications with different themes while sharing some UI components and using the same **Tailwind CSS** base configuration.

## Extracting the button into a publishable library

Now that both our applications are looking great, we want to share our awesome buttons with the community. So we are going to create a button component in a publishable library to be able to distribute it.

First, we create the publishable library with **Tailwind CSS** support:

```shell
npx nx generate @nrwl/angular:lib lib3 --publishable --importPath=@angular-tailwind-nx/lib3 --addTailwind
```

Then, we update the `libs/lib3/tailwind.config.js` to use the shared preset:

```javascript {% fileName="tailwind.config.js" %}
const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
const { join } = require('path');
const sharedTailwindConfig = require('../../libs/tailwind-preset/tailwind.config');

module.exports = {
  presets: [sharedTailwindConfig],
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
};
```

Then, we create the button component:

```shell
npx nx generate @nrwl/angular:component button --project=lib3 --export
```

We add the component to the library entry point located in `libs/lib3/src/index.ts`:

```typescript {% fileName="index.ts" %}

...
export * from './lib/button/button.component';
```

Then, we update the button component files to provide the desired functionality:

```typescript {% fileName="button.component.ts" %}
import { Component, Input } from '@angular/core';

@Component({
  selector: 'angular-tailwind-nx-button',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.css'],
})
export class ButtonComponent {
  @Input() href?: string;
}
```

```angular2html {% fileName="button.component.html" %}
<a
  class="py-sm px-md bg-primary-dark hover:bg-primary text-white"
  href="{{ href }}"
  target="_blank"
  rel="noopener noreferrer"
>
  <ng-content></ng-content>
</a>
```

Next, we need to update the card component in `lib2` to use the button component. Import `Lib3Module` into `Lib2Module` :

```typescript {% fileName="lib2.module.ts" %}

...
import { Lib3Module } from '@angular-tailwind-nx/lib3';

@NgModule({
  imports: [CommonModule, Lib3Module],
  ...
})
export class Lib2Module {}
```

And finally, we replace the existing markup for the button in the `libs/lib2/src/lib/card/card.component.html` file with the new button component:

```angular2html {% fileName="card.component.html" %}

<div class="card">
  <div class="card-title">{{ title }}</div>
  <p class="card-content">
    <ng-content></ng-content>
  </p>
  <angular-tailwind-nx-button class="flex self-end" [href]="url">Show me!</angular-tailwind-nx-button>
</div>
```

Once more, we can check both applications and make sure everything is still working and nothing was affected by the changes made.

## Distributing the publishable library styles

The recently created publishable library is already being used successfully by both applications, but it’s still not ready for distribution. If we were to share it now, external consumers will need to provide their own CSS for it because the library itself is not bundling any CSS with the styling for the button. We only used some **Tailwind CSS** utility classes and as we have seen throughout this blog post, the CSS for them is generated in files containing `@tailwind` directives (normally in application style entry points).

> Within the workspace, it works as expected because the applications consuming it use the same shared **Tailwind CSS** preset and their dependencies are included in the `content` of their configuration.

The library needs to contain everything that’s needed for it to work and to achieve this, we are going to do something we already did with our buildable library: create our own classes using the `@apply` directive.

As we learned in a previous section, the `@apply` directive will be transformed into the CSS corresponding to the **Tailwind CSS** classes being applied. Thanks to this, our button component will contain the CSS needed to style it.

Go ahead and update the button component files with a new CSS class for the button:

```css {% fileName="button.component.css" %}
.atn-button {
  @apply py-sm px-md bg-primary-dark hover:bg-primary text-white;
}
```

```angular2html {% fileName="button.component.html" %}
<a class="atn-button" href="{{ href }}" target="_blank" rel="noopener noreferrer">
  <ng-content></ng-content>
</a>
```

I used the prefix `atn` (initials of **A**ngular, **T**ailwind CSS, and **N**x) for the CSS class name to prevent potential name collisions with the consumers' applications CSS.

Also, let’s update the `libs/lib3/src/lib/button/button.component.ts` file to set the component’s `encapsulation` to `ViewEncapsulation.None` to allow consumers to overwrite its styles more easily:

```typescript {% fileName="button.component.ts" %}

import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  ...
  encapsulation: ViewEncapsulation.None,
})
export class ButtonComponent {
  ...
}
```

If we build our library now, the styles for the button component will be correctly generated, but because we are using CSS variables for our theme, consumers would still need to provide their own values for them before they can use it.

We need to provide an initial theme that sets those CSS variables so the library components can be consumed without any additional setup. Actually, we are going to generate a couple of theme options so we can see how multiple themes can be provided.

Let’s start by creating a `libs/lib3/src/styles/teal.css` theme file where we are going to import the **Tailwind CSS** `components` and `utilities` layers and define the values for the CSS variables of our theme:

```css {% fileName="teal.css" %}
@tailwind components;
@tailwind utilities;

:root {
  /* Colors */
  --primary-light: #5eead4;
  --primary: #14b8a6;
  --primary-dark: #0f766e;
  --secondary-light: #bae6fd;
  --secondary: #0ea5e9;
  --secondary-dark: #0369a1;
  --white: #ffffff;
  --black: #000000;

  /* Spacing */
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

Notice that we didn’t include the `base` layer like we have done so far in the applications style entry points. This is because this is a component library and the `base` layer generates a set of application-wide base styles and that’s not what we want to generate here.

Next, we generate our second theme by creating the `libs/lib3/src/styles/indigo.css` theme file with different values for the CSS variables:

```css {% fileName="indigo.css" %}
@tailwind components;
@tailwind utilities;

:root {
  /* Colors */
  --primary-light: #a5b4fc;
  --primary: #6366f1;
  --primary-dark: #4338ca;
  --secondary-light: #e9d5ff;
  --secondary: #a855f7;
  --secondary-dark: #7e22ce;
  --white: #ffffff;
  --black: #000000;

  /* Spacing */
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

With that in place, we now need to make sure those theme files are processed when we build the library. The `@nrwl/angular:package` executor is powered by the [**ng-packagr**](https://github.com/ng-packagr/ng-packagr) package to build the library. This is a tool recommended by **Angular** to ensure libraries are distributed using the [Angular Package Format](https://angular.io/guide/angular-package-format). Unfortunately, it doesn’t have native support for building standalone stylesheets that are not referenced by a component, so we need to configure it ourselves.

To do so, we are going to use the **Tailwind CSS** CLI to process our stylesheets when the library is built and we’ll do it in parallel since they don’t depend on each other. One aspect to consider is that the `@nrwl/angular:package` executor will delete the destination folder before building. When running both processes in parallel, the styles might be generated first and then the directory containing them is deleted by the `@nrwl/angular:package` executor. Therefore, we are going to disable that behavior and we are going to control when to delete the destination folder to avoid any issues.

Another thing to consider is that the **Tailwind CSS** CLI only supports processing one file at a time, it doesn’t accept glob patterns or directories. We’ll need to run a command per theme in our library.

To orchestrate this, we are going to make the following changes to the `lib3` project configuration:

- Rename the existing `build` target to `build-angular`
- Create a `build-themes` target that runs, in parallel, the **Tailwind CSS** CLI for every theme in our library
- Create a `build-lib` target that runs, in parallel, the `build-angular` and `build-themes` targets
- Create a `build` target that first, deletes the destination folder, and then runs the `build-lib` target

Edit the project configuration for the `lib3` project located in the `libs/lib3/project.json` file with the changes described above and shown below:

```json5 {% fileName="project.json" %}
{
  ...
  "targets": {
    "build-angular": {
      "executor": "@nrwl/angular:package",
      ...
    },
    "build-themes": {
      "executor": "@nrwl/workspace:run-commands",
      "outputs": ["dist/libs/lib3/themes"],
      "configurations": {
        "production": {
          "commands": [
            "tailwindcss -c libs/lib3/tailwind.config.js -i ./libs/lib3/src/styles/teal.css -o ./dist/libs/lib3/themes/teal.css -m",
            "tailwindcss -c libs/lib3/tailwind.config.js -i ./libs/lib3/src/styles/indigo.css -o ./dist/libs/lib3/themes/indigo.css -m"
          ]
        },
        "development": {
          "commands": [
            "tailwindcss -c libs/lib3/tailwind.config.js -i ./libs/lib3/src/styles/teal.css -o ./dist/libs/lib3/themes/teal.css",
            "tailwindcss -c libs/lib3/tailwind.config.js -i ./libs/lib3/src/styles/indigo.css -o ./dist/libs/lib3/themes/indigo.css"
          ]
        }
      },
      "defaultConfiguration": "production"
    },
    "build-lib": {
      "executor": "@nrwl/workspace:run-commands",
      "outputs": ["dist/libs/lib3"],
      "configurations": {
        "production": {
          "commands": [
            "nx run lib3:build-angular:production",
            "nx run lib3:build-themes:production"
          ]
        },
        "development": {
          "commands": [
            "nx run lib3:build-angular:development",
            "nx run lib3:build-themes:development"
          ]
        }
      },
      "defaultConfiguration": "production"
    },
    "build": {
      "executor": "@nrwl/workspace:run-commands",
      "outputs": ["dist/libs/lib3"],
      "configurations": {
        "production": {
          "commands": [
            "rm -rf dist/libs/lib3",
            "nx run lib3:build-lib:production"
          ],
          "parallel": false
        },
        "development": {
          "commands": [
            "rm -rf dist/libs/lib3",
            "nx run lib3:build-lib:development"
          ],
          "parallel": false
        }
      },
      "defaultConfiguration": "production"
    },
    ...
  },
  ...
}
```

The only thing remaining is to update the `libs/lib3/ng-package.json` to prevent the **Angular** build to delete the destination folder. We do that by setting the `deleteDestPath` option to `false`:

```json5 {% fileName="ng-package.json" %}
{
  ...
  "deleteDestPath": false
}
```

We can now build the library by running:

```shell
npx nx run lib3:build
```

If we check the output folder `dist/libs/lib3`, we’ll see there’s a `themes` folder in it with a couple of files `indigo.css` and `teal.css`:

![](/blog/images/2022-01-28/1*vcHqTWEppPbVtGRlVIqEPg.avif)
_Publishable library with the produced theme files highlighted_

These theme files can now be used by the consumers of our library to properly style the components exposed by it. All they would need to do is to import one of those themes into their application styles entry point or `index.html` file.

They can also customize the included themes by overwriting any of the CSS variables of the theme or the specific styles of the `atn-button` CSS class.

## Conclusion

We covered a lot in this article and hopefully, it gave a good walkthrough over the different scenarios we might find ourselves when using **Angular** and **Tailwind CSS** in an **Nx** workspace.

Doing a quick recap, we learned:

- How to add support for **Tailwind CSS** in existing **Angular** projects using an **Nx** generator
- How to create **Angular** projects with **Tailwind CSS** already configured using an **Nx** generator
- How to share **Tailwind CSS** configuration among an application and its dependencies using presets
- How to share **Tailwind CSS** configuration among multiple applications and their dependencies while still being able to have different styles
- How to create and distribute multiple themes in an **Angular** publishable library using **Tailwind CSS**
