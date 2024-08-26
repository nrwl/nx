---
title: 'React Microfrontends and Monorepos: A Perfect Match'
slug: 'monorepos-and-react-microfrontends-a-perfect-match'
authors: ['Jason Jean']
cover_image: '/blog/images/2019-08-22/1*JlGbowKyaPj2PGeCa_qM3Q.png'
tags: [nx]
---

In this article, we will use a monorepo when implementing a microfrontend architecture. We will explore how this approach mitigates problems typically associated with microfrontends.

## What is a Microfrontend?

This article assumes knowledge of microfrontends, so this section will be brief.

For this article, we will define a **microfrontend** as one of multiple parts of a complex application which fulfill the following criteria:

- Is composed with other microfrontends to make up a user experience
- Is dedicated to a unique concern of the user experience
- Can be built and deployed in isolation

> Note that it is not necessary that a microfrontend is stored in a separate repository!

### Pros and Cons

Dividing a single complex application into multiple microfrontends comes with many advantages:

- Operating a single simple microfrontend without the overhead of operating a complex application
- Deploying new features at different rates for different parts of the application
- Providing a way for different teams to own different parts of the application
- Providing a way for teams to choose a set of technologies that suit the purpose of a microfrontend and the expertise of the team

Operating a collection of microfrontends has some disadvantages as well.

- Making a change across the entire application involves making changes to many microfrontends done by multiple teams
- Switching between teams and projects is difficult due to inconsistencies in dependencies, tooling, and standards between microfrontends
- Adding new microfrontends requires setting up a build process, testing, and deployment
- Sharing common functionality between different microfrontends requires a non-trivial solution

## Monorepos

A **monorepo** is a repository that stores multiple projects. This approach has been used _for years_ by many large technology companies such as [Facebook](https://www.facebook.com/), [Google](https://www.google.com/), [Microsoft](https://www.microsoft.com/), [Twitter](https://www.twitter.com/), [Uber](https://www.uber.com/), and more.

While it may seem that storing multiple projects in a single repository requires that repository to be a monolith, we will see that this is not true. Like a microfrontend, each project within a monorepo is independent and can be operated in isolation. In this article, we will explore how utilizing a monorepo mitigates the disadvantages of microfrontends without compromising the advantages.

### Nx

{% youtube src="https://www.youtube.com/embed/E188J7E_MDU?si=ZZt807HV_9MkI8uB" /%}

In this article, we will use Nx to demonstrate how to implement a microfrontend architecture within a monorepo. [Nx](/nx-api/react) is a set of extensible dev tools for monorepos. It has first-class support for many frontend and backend technologies such as React, Angular, Express, and Nest.

## Microfrontends with Monorepos

In this section we will explore a [shopping cart application](https://github.com/nrwl/nx-examples) built using microfrontends using Nx. The repository has several microfrontends developed by separate teams. We will look at the cart microfrontend built with [React](https://reactjs.org).

### Operating a Microfrontend Within a Monorepo

As we said above, microfrontends are great because they can be built and deployed in isolation. Let us see how we can do that in a monorepo. First, let us pull down the [example monorepo](https://github.com/nrwl/nx-examples) and install the dependencies via [yarn](https://yarnpkg.com/).

```shell
git clone [https://github.com/nrwl/nx-examples.git](https://github.com/nrwl/nx-examples.git) nx-store
cd nx-store
yarn install
```

With all of our dependencies installed, we can now run `yarn start cart` to start our cart microfrontend. The project will be built and served so we can view it at [localhost:4200/cart](http://localhost:4200/cart).

Next, let us make a simple change to our cart frontend to go through what working on such a team would feel like. The team would like to display “Cart” as the title in the header. We can do this by setting the `title` attribute on our `<nx-example-header />` element in [`apps/cart/src/app/app.tsx`](https://github.com/nrwl/nx-examples/blob/c4a5f8d9550f036b3b51f40ce320f4993adba020/apps/cart/src/app/app.tsx#L11), and we will see the change in our browser after saving.

![](/blog/images/2019-08-22/1*F8qHwmSjeXXO1tpOGkMyRw.avif)
_Running application with changes_

Now that we have made our change, let us write a unit test for it. We can add the following test to [`apps/cart/src/app/app.spec.tsx`](https://github.com/nrwl/nx-examples/blob/c4a5f8d9550f036b3b51f40ce320f4993adba020/apps/cart/src/app/app.spec.tsx#L20):

![](/blog/images/2019-08-22/1*uQXSFBSmVcgGQHarXJDjIg.avif)
_Code for added unit test_

We can run the test by running `yarn test cart`. Our new test and the other tests in our cart frontend succeed.

Next, let us verify that our change works end-to-end by adding a Cypress test. Add the following to [`apps/cart-e2e/src/integration/app.spec.ts`](https://github.com/nrwl/nx-examples/blob/c4a5f8d9550f036b3b51f40ce320f4993adba020/apps/cart-e2e/src/integration/app.spec.ts#L8):

![](/blog/images/2019-08-22/1*IZAhlD7YFQCwVlmnHAmLWg.avif)
_Code for added e2e test_

Then we can run `yarn e2e cart-e2e` to run the e2e tests. Our new test and the other tests for our cart frontend succeed. Congratulations, we have successfully implemented our feature!

Lastly, let us deploy our new feature. If we run `yarn nx run cart:deploy` our cart application will be deployed to [Netlify](https://www.netlify.com/)! [See the latest version running here](https://nrwl-nx-examples-cart.netlify.com/cart).

![](/blog/images/2019-08-22/0*HG31a-HQ9tO6Rt3P.avif)
_Application being deployed_

Throughout the implementation and deployment of this feature, we were able to work on the cart frontend in total isolation from other parts of the repository. Working with the cart frontend is just as easy as if it resided in its own dedicated repository. Therefore, we have our fully compliant microfrontend within a monorepo!

## Mitigating Common Problems of Microfrontends

Most of the common problems of microfrontends are exacerbated by splitting the application into separate repos. Using a monorepo makes many of the problems of microfrontends more manageable.

### Sharing Common Functionality

Sharing libraries between multiple repos is difficult. It usually involves publishing artifacts to a package registry which repositories can specify a dependency on a certain version range. Even worse, the shared code usually has its own repository which needs setup such as build tools, unit testing, and CI. Inheriting changes to the shared code requires updating the dependency on that package which is a chore in itself.

In a monorepo, creating a shared library can be as easy as creating a new file and importing it into other projects. More importantly, these imports can be statically analyzable and dependencies can be inferred by looking at the source code. Tracing code through imports is much easier for IDEs because they are able to find the actual source code instead of a compiled build output of a dependency.

### Inconsistencies Between Microfrontends

Working on microfrontends in separate repositories can introduce inconsistencies between projects. Even with tools like code formatters and linters, which enforce code consistency, different repositories will inevitably start to use different configurations.

Not only does having code in the same repository make inconsistencies less likely in general, but consistency can be enforced with automation as well. The whole repository can be subject to the same formatting tool and configuration to ensure the code style remains consistent across different microfrontends. Linting rules can also be shared which ensures that the best practices are being used throughout the repository.

Making microfrontends more consistent with one another allows developers to more easily move between projects and provide value where the organization needs it at a given time.

### Application-wide Changes

When microfrontends are split up into individual repositories, making a change across multiple microfrontends requires changing multiple repositories. This means that a commit has to land in each repository and multiple teams may have to synchronize their releases. Even in the case where the code of the change is contained within a shared package, every repository still needs to update the version of the dependency.

In a monorepo, it is possible to make all of the changes in a single atomic commit. This can either be done by a single team which specializes in making application-wide changes or by squashing commits by multiple teams into a single commit.

## Advantages of Using a Monorepo

Now that we have established how some disadvantages can be mitigated, let us take a look at some of the advantages we have gained by using a monorepo.

### Tangible Dependencies

Previously, we discussed how sharing code between microfrontends is much simpler in a monorepo. This simplicity allows tools like Nx to intelligently calculate how projects depend on other projects with static code analysis of imports.

If we revisit our example project, we see that [app.tsx imports @nx-example/shared/header](https://github.com/nrwl/nx-examples/blob/c4a5f8d9550f036b3b51f40ce320f4993adba020/apps/cart/src/app/app.tsx#L4). Nx uses these imports to deduce that the `cart` microfrontend depends on the `shared-header` library. The relationships between projects can be expressed in a graph which can be shown by running `nx dep-graph`:

![](/blog/images/2019-08-22/0*rfALX-pczwX2e3he.avif)

Previously, an architect would sketch something similar manually and it would be time consuming and quickly invalidated by changes to the code. This graph is extremely valuable to study how projects are linked within the architecture.

> Note that the `cart` and `cart-e2e` projects are highlighted in red, we will come back to this graph in the next section.

### Intelligent Builds

As discussed, each microfrontend can be operated in isolation. When it comes time to verify that the entire application is functional when a change is being made, a naive solution would be to run tests for every microfrontend. However, this naive solution would not scale when we have dozens of microfrontends and yet large tech companies such as Facebook and Google are able to operate their company-wide monorepos with _thousands_ of changes each day. Let us take a look at how this is possible.

Not every microfrontend is affected by every single change and running tests and builds for those microfrontends for changes which do not affect them is wasteful. In fact, most changes likely only affect a single microfrontend and it would be much quicker to only run tests for that single microfrontend. Because each microfrontend can be operated in isolation, doing this manually is no problem and what we would do during development. In CI, we can automate doing this by having an intelligent build tool such as Nx.

Nx is able to use the dependency graph we discussed in the previous section to determine which projects are affected by a change to the code. In fact, let us revisit the change we made earlier to the header on the cart page. As a developer who is cognizant of the impact of our change, we know that we only affected the cart project. If we look closely at the graph in the previous section, Nx analyzed our changes, the graph, and highlighted projects which are affected by our change, `cart` and `cart-e2e`, which is exactly as we expect.

![](/blog/images/2019-08-22/0*GElsflaoL78CZv3q.avif)
_Affected tests being run_

Our change does not concern anything outside of this subset and validating this subset of projects is sufficient for validating our changes. We can run tests for this subset of projects by running `nx affected:test`. We can do the same for linting, building, and even deploying our changes.

![](/blog/images/2019-08-22/0*2xe_TNOg_6yXgcuN.avif)
_Affected applications being deployed_

## Recap

In this article we showed that, contrary to what may have seemed paradoxical, monorepos and microfrontends are a great match.

- We learned that developing microfrontends in a monorepo does not compromise any advantages of microfrontend architecture
- We saw how a monorepo mitigates some common disadvantages associated with using microfrontends
- We discussed how using a monorepo brings its own set of advantages

Using a monorepo can benefit your team in ways outside of the realm of microfrontends as well.

**Jason Jean is a Senior Angular Engineer at Nx**
