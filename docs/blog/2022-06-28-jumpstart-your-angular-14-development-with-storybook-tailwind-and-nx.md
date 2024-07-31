---
title: 'Jumpstart your Angular 14 development with Storybook, Tailwind and Nx'
slug: 'jumpstart-your-angular-14-development-with-storybook-tailwind-and-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-06-28/1*AqGzDU7J__u99mwZbcO8GA.png'
tags: [nx, tutorial]
---

With Angular 14 having just been released recently, let us discuss how you can take advantage of some of the most popular tools in the JavaScript ecosystem to increase your efficiency and productivity when building Angular applications.

In this article, we will set up an Nx workspace that is preconfigured for [Angular](https://angular.io/) development and integrates [Storybook](https://storybook.js.org/) and [Tailwind](https://tailwindcss.com/) using generators provided by Nx. We will then build a simple Button component using only Storybook and Tailwind.

## Workspace Setup

First, let’s start by creating a new Nx Workspace that contains the official Angular plugin. It’s as simple as running a single command:

`npx create-nx-workspace@latest demo --preset=angular`

We will then be prompted to answer questions about what we’re creating.  
Give the application a name of `myapp` and then select the default answers for the rest of the prompts.

This will create our workspace and install the dependencies required to build Angular applications! Ensure you’re at the root of the new workspace by running `cd demo`.

We want to build a component that will be shared among many applications, so let’s create a Shared Components library to store it. This allows us to add more components in the future and keep them scoped to a shared domain. Run the following command

`npx nx g @nrwl/angular:lib shared/components`

This will create a workspace library with the name of `shared-components` but with a directory structure of `shared/components`.

This can be beneficial for domain-driven development and is a good architectural pattern to follow when working within an Nx Workspace.

## Add Storybook

Now, let’s add Storybook to our workspace, and more importantly, to our `shared-components` library. This is as simple as running the following command:

`npx nx g storybook-configuration shared-components`

Say No to all the prompts that are asked in the terminal.

This will install Storybook, create the necessary Storybook configuration files, and add two targets to the `shared-components` `project.json` file, enabling us to run Storybook for the library.

## Add Tailwind

Next, we want to add Tailwind support to our workspace. Again, Nx offers a command to do this for us! Just run:

`npx nx g setup-tailwind myapp`

This will add the Tailwind directives to our `styles.css` file in `apps/myapp/src/style.css` and create a `tailwind.config.js` file for our application.

However, Storybook will not be aware of Tailwind for our `shared-components` library. To allow this, we need to do the following:

1.  Add `apps/myapp/src/styles.css` to `styles` array of `build-storybook`
2.  Copy and Paste `tailwind.config.js` from `myapp` to `libs/shared/components`.

> Note: We need to copy and paste the tailwind.config.js file from the application for our UI Library to allow Storybook to find the Tailwind classes correctly.  
> This is not the most scalable solution to this problem as there will be a duplication of configuration across all the libraries in the workspace. Changing the root configuration will not edit all the other libraries’ configurations.  
> You can find a better approach to solving this problem in Leosvel’s blog post: [https://leosvel.dev/blog/set-up-tailwind-css-with-angular-in-an-nx-workspace/#sharing-the-tailwind-css-configuration-between-the-application-and-the-buildable-library](https://leosvel.dev/blog/set-up-tailwind-css-with-angular-in-an-nx-workspace/#sharing-the-tailwind-css-configuration-between-the-application-and-the-buildable-library)

And that’s it! We’re now ready to start building components independently of our application using Storybook!

## Let’s build a Button component

The first thing we want to do is generate a component to store our button. We’ll take advantage of the [SCAM](https://dev.to/this-is-angular/angular-revisited-tree-shakable-components-and-optional-ngmodules-36d2) pattern and use Nx’s SCAM generator. Run the following command:

```shell
npx nx g @nrwl/angular:scam button --inlineTemplate --inlineStyle --export --project=shared-components
```

This will generate an `NgModule`, a `Component` and use an inline template and inline styles (also following the Single File Component pattern) within our `shared-components` library and export it to be consumed by other libraries or applications.

A new file should be generated at `libs/shared/components/src/lib/button/button.component.ts` with the following contents:

It’s a pretty straightforward component! Let’s edit the template slightly to:

- Use Tailwind for styling
- Allow content projection

Replace the contents of `template:` with:

Now, we can automatically generate a Storybook story for this component, allowing us to see and design this component independently from consuming applications. We can do this by running the following command:

```shell
npx nx g @nrwl/angular:stories shared-components --generateCypressSpecs=false
```

This will create a new file `libs/shared/components/src/lib/button/button.component.stories.ts` with a Storybook story automatically created!

Next, if you run `npx nx storybook shared-components`, you can see in the terminal that Storybook will run and create an instance on [http://localhost:4400/](http://localhost:4400/). If you navigate to that URL, you will see Storybook is running correctly!

![](/blog/images/2022-06-28/0*QKCMwWYbHqvtJQ54.avif)

Our button doesn’t have any text because it uses content projection. We can solve this by making a few quick edits to our story.

We’ll set up a “Harness” component, that will be scoped to just the story and is used to host and render our actual `ButtonComponent`. This pattern allows us to set up a Storybook Control that will allow us to easily change the text that is rendered within the button!

Replace the contents of `libs/shared/components/src/lib/button/button.component.stories.ts` with

You should then see the following in Storybook:

![](/blog/images/2022-06-28/0*hOU3RTNOkL0b9cFR.avif)

And that’s it! How easy is that!?

Nx truly helps you to hit the ground running with Angular development thanks to all of its one-command integrations!

## Recap

1.  With Nx, we were able to create a workspace with a structure that allows for a better separation of domains.  
    `npx create-nx-workspace@latest demo --preset=angular`
2.  Nx also offered us commands to easily integrate modern tooling allowing us to develop rapidly.  
     `npx nx g storybook-configuration  
npx nx g setup-tailwind`
3.  Nx offered some commands to help us scaffold out code making us even more productive, while sticking to consistent structures and patterns.  
     `npx nx g @nrwl/angular:lib  
npx nx g @nrwl/angular:scam`
4.  Finally, Nx reuses a CLI API we are familiar with to interact with our app and libraries  
    `npx nx storybook shared-components`

## Migrating to Nx

Do you already have an Angular application using the Angular CLI and want to take advantage of all the cool tooling that Nx offers? Don’t worry! The Nx CLI offers a single command that will automatically migrate most Angular workspaces to use Nx.

It has been recently refactored to support multi-project workspaces as well as some known standard deviations from Angular’s opinionated workspace scaffolding.

You can use the command below in your Angular Workspace to kick off the migration.

```
ng add @nrwl/angular
```

_Note: You need to ensure you use the correct command based on the version of Angular your workspace is using. The easiest way would be to ensure your Angular workspace is at the latest Angular version and then run the command!_

Otherwise, you can read more about migrating to Nx here, including the command to run based on your version of Angular: [/recipes/angular/migration/angular](/recipes/angular/migration/angular)

## Conclusion

Hopefully, you can see just how easy it can be to integrate tooling and build out applications and component libraries using modern tooling such as Storybook and Tailwind with Nx!  
We would love for you to try it out and let us know what you think!

Also, make sure you don’t miss anything by

- Following us [on Twitter](https://twitter.com/NxDevTools), and
- Subscribe to the [YouTube Channel](https://youtube.com/nrwl_io?sub_confirmation=1) for more information on [Angular](https://angular.io/), [React](https://reactjs.org/), Nx, and more!
- Subscribing to [our newsletter](https://go.nrwl.io/nx-newsletter)!

As always, if you are looking for enterprise consulting, training and support, you can find out more about how we work with our clients [here](https://nrwl.io/services).
