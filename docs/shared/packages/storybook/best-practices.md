---
title: Storybook best practices for making the most out of Nx
description: The purpose of this guide is to help you set up Storybook in your Nx workspace so that you can get the most out of Nx and its powerful capabilities.
---

# Storybook best practices for making the most out of Nx

## Purpose of this guide

The purpose of this guide is to help you [set up Storybook in your Nx workspace](/nx-api/storybook) so that you can get the most out of Nx and its powerful capabilities.

## When to use Storybook

Usually, Storybook is mainly used for two reasons. Testing and documentation. You can read more on when and why to use Storybook in the [Why Storybook in 2022?](https://storybook.js.org/blog/why-storybook-in-2022/) article and also in the [Introduction to Storybook](https://storybook.js.org/docs/react/get-started/introduction) documentation page.

### Testing

Storybook helps you test your UIs. You can read more about testing with Storybook in the [How to test your UIs with Storybook](https://storybook.js.org/docs/react/writing-tests/introduction) documentation page. Essentially, Storybook uses the stories as a starting point for testing.

### Documentation

Storybook helps you document your UI elements, or your design system, effectively and in an interactive way. You can read more in the [How to document components](https://storybook.js.org/docs/react/writing-docs/introduction) documentation page. Essentially, you can use Storybook to publish a catalog of your components. A catalog that you can share with the design team, the developer team, the product team, anyone else in the product development process, or even the client. The components are isolated, interactive, and can be represented in all possible forms that they can take (e.g. for a button: enabled, disabled, active, etc). You can read more about publishing your Storybook in the [Publish Storybook](https://storybook.js.org/docs/react/sharing/publish-storybook) documentation page.

## Nx and Storybook

Now let’s see how Nx can be used to accommodate both of these pillars of Storybook. Nx takes lots of the burden off your arms when setting up Storybook initially. It essentially provides you with all that you need to start using Storybook’s capabilities (testing and documentation) right away, without having to write a single line of code.

### Development tools

First, let’s see what Nx offers, when you are in the process of developing a project with Storybook.

#### Configuration generation

You can generate the Storybook configuration files and settings using the Nx [`@nx/storybook:configuration` generator](/nx-api/storybook/generators/configuration). You can read more about configuring Storybook with Nx in our [`@nx/storybook` package overview page](/nx-api/storybook#generating-storybook-configuration). With Nx, you configure Storybook for each individual project.

#### Stories generation

If you are on a project using Angular, React or React Native, you can also generate stories for your components. You can do so either by using each package's `storybook-configuration` generators or by using the `stories` generator, if you already have Storybook configured for your project.

If your project is not configured yet, check out one of these guides:

- [Set up Storybook for React (and Next.js) Projects](/recipes/storybook/overview-react)

- [Set up Storybook for Angular Projects](/recipes/storybook/overview-angular)

- [Set up Storybook for Vue Projects](/recipes/storybook/overview-vue)

If your project is [already configured](/nx-api/storybook), you can use the `stories` generator:

- [React (and Next.js) stories generator](/nx-api/react/generators/stories)

- [Angular stories generator](/nx-api/angular/generators/stories)

- [Vue stories generator](/nx-api/vue/generators/stories)

- [React Native stories generator](/nx-api/react-native/generators/stories)

The stories generator will read your inputs (if you’re using Angular), or your props (if you're using React), and will generate stories with the corresponding arguments/controls already prefilled.

#### Storybook interaction tests

[Storybook interaction tests](https://storybook.js.org/docs/react/writing-tests/interaction-testing) allow you to test user interactions within your Storybook stories. It enhances your [Storybook](https://storybook.js.org/) setup, ensuring that not only do your components look right, but they also work correctly when interacted with.

Nx will generate interaction tests for your stories. You can read more in our [Setting up Storybook Interaction Tests with Nx guide](/recipes/storybook/storybook-interaction-tests).

### CI/CD tools

Now let’s see how Nx helps in the CI/CD journey, as well.

#### Interaction tests in your CI

You can set up your interaction tests to run as part of your CI. You can read more in the [Storybook docs](https://storybook.js.org/docs/react/writing-tests/test-runner#set-up-ci-to-run-**tests**).

#### Serve

When you are configuring Storybook, Nx [adds a serve and a build target for Storybook](/nx-api/storybook#generating-storybook-configuration) in your `project.json`, as we explained above. You can use these targets to [serve](/nx-api/storybook/executors/storybook) and [build](/nx-api/storybook/executors/build) storybook locally, and also in production. Cypress will also use these targets when firing up the e2e tests. While developing, you can serve your Storybooks locally to see if your components work and look as expected. This can help you and speed up the development and debugging process (no need to fire up a complex dev stack).

#### Build and deploy

The build and deploy step usually comes in handy when you are ready to use Storybook for documentation, and you want to publish it. The [building](/nx-api/storybook/executors/build) step of Storybook is integrated in the Nx ecosystem, as explained above, and you can trigger your Storybook builds as you would trigger any other build inside your workspace.

When you publish your organization’s Storybook, as a result, ideally, you would want to have one shareable Storybook page/application living under one URL, that you can share. With Nx, you can build your Storybook and it will be ready for deployment. **However**, at this point, you have one Storybook per project in your workspace, and you could end up with far too many Storybooks that are built and ready for deployment. This is not ideal, and does not accomplish the ultimate goal of “one shareable documentation page”.

In the following section, we are going to see how to set up Storybook in these cases, to get the most out of Nx.

## How to set up Storybook to get the most out of Nx

### Philosophy

Setting up Storybook on Nx reflects - and takes advantage of - the [mental model](/concepts/mental-model) of Nx. What that means, in essence, is that you still maintain the individual Storybook instances (per project) which you use for testing and local development, but you also keep one extra “container” for publishing, that serves as a single entry point. Let’s see this in more detail.

#### Local development and testing

##### Development and debugging

In the process of setting up Storybook in your Nx workspace that we described above, you end up with one Storybook instance per project. That way, you can use your project’s Storybook targets to serve, test and build Storybook:

```shell
nx storybook my-project
```

and

```shell
nx build-storybook my-project
```

and

```shell
nx test-storybook my-project
```

This feature is extremely useful when developing locally. The containerized stories in your Storybook are the only ones that are built/served/tested when you want to debug just one component, or just one library. You don’t have to wait for a huge Storybook containing all your stories in your repository to fire up. You just need to wait for the Storybook of a single project to start. This speeds up the process.

##### Caching, affected, dependency management

Since each Storybook, in this case, is attached to a project, so is the serving of Storybook and the building of Storybook and the e2e tests for that project. That means that Nx is aware of these tasks, so it caches them, it knows when to fetch them from the cache or re-run them according to the affected status of that project. It also knows that project’s dependencies and knows which things to rebuild before each task.

#### Publishing

When you are publishing your Storybook, you can follow the principles described in the [project size](/concepts/decisions/project-size) decision page. The general idea is to have one central Storybook container, into which you are going to gather your stories from multiple libraries.

You can think of the central Storybook container as a grouping of similar-concept or same-scope UI parts of your workspace. In the same way you are scoping libraries, you can group your stories as well.

Then, according to your use-case, you can have one central Storybook for your whole workspace, importing all the stories from all the projects. Alternatively, you can have one Storybook per "scope", which imports all the stories from projects the same scope. Or even one Storybook per application, importing all the stories of all the libraries that it is depending on. As you can see, there are many options, and you can choose the one that best suits your needs.

{% callout type="note" title="Storybook Composition" %}
In order to achieve some things mentioned above, you may use [Storybook Composition](/recipes/storybook/storybook-composition-setup). However, in this case, you would still need to build each project’s Storybook individually, and also deploy it individually. So in the cases where you have multiple projects, Storybook Composition would not be very efficient.
{% /callout %}

Before moving on to the examples section, it could be useful to read the [Library Types](/concepts/decisions/project-dependency-rules) documentation page and the [Grouping libraries](/concepts/decisions/folder-structure) documentation page. These could help you decide which way fits your use case better.

## Examples / Use cases

You can check out the following examples (recipes) to see publishing strategies for Storybook in Nx:

- [One main Storybook instance for all projects](/recipes/storybook/one-storybook-for-all)
- [One Storybook instance per scope](/recipes/storybook/one-storybook-per-scope)
- [One main Storybook instance using Storybook Composition](/recipes/storybook/one-storybook-with-composition)

## Conclusion

In this guide, we have given a direction towards the most efficient way to use Storybook in a Nx workspace, in a way that takes advantage of the all that Nx has to offer.
We have covered the different ways to set up Storybook, and publish it, too. We have also covered the different use cases that apply to each of the solutions.

If you have any questions or suggestions, please feel free to reach out to us on [GitHub](https://github.com/nrwl/nx), and don't hesitate to ask your questions or share your stories in the [Official Nx Discord Server](https://go.nx.dev/community).

### Nx & Storybook documentation

You can find all Storybook-related Nx documentation in the [packages page](/nx-api/storybook).
