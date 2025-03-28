---
title: 'The virtuous cycle of workspace structure'
slug: virtuous-cycle-of-workspace-structure
authors: [Philip Fulcher]
tags: ['nx']
cover_image: /blog/images/2025-02-03/virtuous-cycle.avif
description: 'Learn more about organizing your workspace like a modulith. We focus on workspaces with applications and breaking those applications down into libraries.'
---

We work with a [lot of companies](/customers) as part of our [Nx Enterprise](/enterprise) program, and the question we get from many customers is:

> How can I organize my workspace the right way?

Reader, I’ll tell you: “the right way” carries a lot of weight here. I hate to break it to you, but there’s no one right way. The “right” organization for your workspace will depend on you and your organization.

But don’t despair: we’re going to walk through a process for organizing your workspace, review some questions, and help you make some decisions. We will focus on workspaces that contain applications and the best way to break those applications down into libraries.

## Our primary recommendation for applications: the “modulith”

The common way we recommend organizing an Nx workspace is by following a “modulith” architecture. Modulith architecture is especially popular in the [Spring community](https://spring.io/blog/2022/10/21/introducing-spring-modulith), and it’s somewhere in between a monolith and microservices/microfrontends. We like the term so much that we’re going to steal it.

With a monolith, you have a single deployable, and all of the code is one big unit. With microservices or microfrontends, you have many deployables, and each application is separate and distinct. In a modulith, you maintain a single deployable but break the code down into separate parts that are then built up together. You get the benefit of only maintaining a single deployable, but you also get the benefit of having distinct pieces of code that you can maintain separately. The best of both worlds!

{% callout type="note" title="Further enhancements" %}

The modulith architecture can be further enhanced by Domain Driven Design, Hexagonal Architecture, or other architectural approaches. One of our [Nx Champions](/community), [Younes Jaaidi](https://bsky.app/profile/younes.marmico.de), has put together a [fantastic resource on using Nx](https://cookbook.marmicode.io/nx/intro/). It includes its own page on [organizing libraries](https://cookbook.marmicode.io/nx/organize-libs), including how to apply these other architectural practices to the approach described here.

{% /callout %}

## Why is this so important?

You might think you can figure out your workspace structure as you go along, but we’ve seen this approach fail over time. **Making a plan that can evolve is different from figuring it out as you go.** Here’s what happens if you don’t have a plan for your workspace structure.

### Lack of organization slows down engineers

To do their work, engineers need to:

1. Figure out where to apply changes
2. Apply those changes
3. See the effect of the changes

This is a reductionist view of the software development cycle, but it works. When a workspace is poorly organized, it makes it difficult to know where to apply changes. Those changes may need to be applied in multiple places, and finding each new place slows things down. Not only does it slow engineers down, but it adds to the mental load of development. Engineers need to keep a more complex system of organization in their heads rather than having a tightly defined system of organization in front of them. In the worst case, you’re introducing conflict between engineers who disagree on where to place a particular feature.

Seeing the effect of the changes can be even slower, because engineers aren't sure if the changes are in the right place. They may need to test multiple different changes in multiple different places just to see where what is affected. Have you ever started placing console logs in places just to see if you’re in the right place? This is the slow development process we’re addressing.

### Lack of organization slows down CI

Workspace disorganization doesn’t just slow down engineers, it slows down CI. CI needs to run tasks and disorganized workspaces result in more tasks to run.

In a disorganized workspace, changes will have less predictable sets of tasks to run. If a change has to be applied in multiple places, then more projects are touched, which results in more affected tasks being run.

Disorganized workspaces also tend to have what we call “dump projects”: the project where you stick code when you can’t figure out where it goes. Raise your hand if you’ve got a project named `util` or `components` that’s bigger than you’d like. These “dump projects” accumulate tech debt that eventually results in more and more projects being affected by a change there.

[Read more about a real world example of the CI improvement you could see with a well-organized modulith](/blog/improve-architecture-and-ci-times-with-projects)

## Set your goals

So, how do we create a good workspace structure? You might jump to thinking of directory structures or technical implementations, but we need to start with what’s important: **your workspace structure should be designed to meet your organizational goals.**

To be clear: your goal should not be “to do things the Nx way.” We offer general recommendations based on years of experience with Fortune 500 companies. But for each company we’ve worked with, we applied these general recommendations to their specific context to find what works for them.

Here are the goals we like to start with for a workspace structure:

- Projects should have a well-defined purpose
- Engineers should be able to locate code quickly
- Code that is often updated together should be located close together

Your workspace will likely have more goals than this! And you should be prepared to re-evaluate those goals to make sure they still align with your organization over time. Your goals will change over time as you introduce new teams, new products, or new tools. **Be ready to evolve with these changes.** You should always start with a clear picture of where you want to go, but don’t mistake that for a picture that never changes.

Remember how we said you can’t just figure it out as you go? You should plan for your structure to evolve according to the business domain areas which will then reflect team structure. Teams tend to be responsible for a particular domain of the business, so code should be organized to keep that team’s work close together. This helps:

- **Discoverability** - Teams are most often modifying code in the same places and know where to find where changes should be applied.
- **Avoid excessive merge conflicts** - Separate teams are less likely to be making changes in the same areas, leading to fewer merge conflicts along the way.
- **Avoiding cross-team dependencies** - Teams will know how to work within their own domain, rather than importing from other places in the workspace. When a cross-team dependency is needed, it will be apparent because of the import from a different area in the workspace.

## Define your rules

Rules will determine how your workspace structure meets your goals. Let’s think about what rules we need to meet each of our stated goals.

### Projects should have a well-defined purpose

This is our most important goal, and meeting it supports the other two goals. A well-defined purpose defines what should or should not exist inside of a project. Giving engineers confidence of where code should be helps them to locate it faster.

**Project types**

To aid in this, we like to think of different types of projects. By having a limited set of types of projects, we can better categorize them and think about their purpose.

- **Feature libraries**
  Developers should consider feature libraries as libraries that implement container components (with access to data sources) for specific business use cases or pages in an application.
- **UI libraries**
  A UI library contains only presentational components.
- **Data-access libraries**
  A data-access library contains code for interacting with a back-end system.
- **Utility libraries**
  A utility library contains low-level utilities used by many libraries and applications.

These are a great starting point because they encourage **good engineering practices**. Having the concept of a UI library encourages engineers to think of presentational components in terms of structure, inputs, and outputs. Data-access libraries encourage engineers to separate the API interactions into their own logic. Feature libraries take those two UI and data-access projects and plug them together to implement a single feature with container components. A different feature library may plug different UI and data-access projects together to implement a different feature. It’s the beginning of an structure that emphasizes separation of concerns and DRY code.

This is a **starting point** but not an ending point. We find that these are the most common types of projects that we can specify, but your organization may find the need for more. We commonly find these other examples:

- **Model** projects for sharing interfaces between backend and frontend
- Projects may have a specified **platform** such as frontend, backend, or mobile
- State management may need its own library type, or it may be incorporated into data-access libraries

Our naming convention also encourages separating projects by scope. What your scopes are is a big question that only you can answer. Scopes may be separate apps, different lines of business, or different parts of your org. In general, projects should only depend on projects within their own scope (or the `shared` scope). There are lots of materials out there on defining scope within your architecture, so be sure to check out our list of resources at the end of the article.

Sharing code between these two scopes is often done through a `shared` scope. This is an easy model to follow for code that can be used by multiple scopes.

### Engineers should be able to locate code quickly

Engineers first navigate a workspace via the directory tree. So we should **make sure that each directory has a meaningful name that follows a standard convention**. This naming convention should be standard across the workspace so that all contributors to a workspace can recognize what a project does based on its name and location. For our naming convention, we want to make sure that the directory path includes the **type** and **scope** of the project.

We find that navigating through deeply-nested structures is slow, so **projects should not be nested more than 2 or 3 layers deep**. This is a loose rule, but it gives us an important decision making ability: if we’re adding to our monorepo, we should favor placing it in an existing level of structure, rather than nesting it.

### Code that is often updated together should be located close together

When you’re making changes to a part of the application, it is faster to navigate the code if it’s one general area rather than being spread across the repo. This also makes it easier to assign code ownership for PR reviews. To accomplish this, we will **use scope as a grouping directory** for projects.

## The virtuous cycle

These goals and rules lead to a **virtuous cycle** (or positive feedback loop) for your workspace structure. Because projects have a well-defined purpose, it’s easy to scope and name them. Because they’re scoped and named well, engineers can locate code easily. Because engineers can locate code easily, they made the changes in the right places. And because changes are made in the right places, the projects continue to have a well-defined purpose. Round and round we go, with the workspace structure itself enforcing the workspace structure.

![A diagram showing the virtuous cycle of workspace structure: Projects have a well-defined purpose, Projects are easy to scope and name, engineers can locate code quickly, and changes are made in the right place.](/blog/images/2025-02-03/cycle-diagram.avif)

## Define your project names

Once you have goals and rules defined, we can begin to implement our structure. Let’s start from the bottom and work our way up. First: your projects need to have good names. Because the project is the smallest unit of your workspace, engineers will be looking for specific proejcts to apply changes. Having a consistent naming convention across your projects means that engineers should be able to tell what a project does based on its name and its location.

Our naming convention combines the scope along with the type of projects, ending with the identifier for the project. This pattern of `scope-type-`identifier gives us project names like:

- `products-feature-details`
- `checkout-feature-cart`
- `checkout-data-access-taxes`
- `shared-ui-forms`
- `shared-util-dates`

The import paths for these example projects look like:

- `@org/products/feature-details`
- `@org/checkout/feature-cart`
- `@org/checkout/data-access-taxes`
- `@org/shared/ui-forms`
- `@org/shared/util-dates`

{% callout type="warning" title="The new TypeScript experience" %}

We recently announced a [new experience for TypeScript monorepos](/blog/new-nx-experience-for-typescript-monorepos). All of the workspace structure approach will still be valid in this new experience with one small exception: project names defined in `package.json` files can only have one `/` in the name. So the import paths showne here would need to look like:

- `@org/products-feature-details`
- `@org/checkout-feature-cart`
- `@org/checkout-data-access-taxes`
- `@org/shared-ui-forms`
- `@org/shared-util-dates`

{% /callout %}

## Define your structure

Our structure comes very quickly from the project naming convention because we’ve already incorporated the scope in the project name. Our structure is defined by projects grouped by their scope.

This results in a workspace structure that looks like this:

```text
libs/
  products/               <---- grouped by scope
    feature-details/      <---- project prefixed with type

  check-out/              <---- grouped by scope
    feature-cart/         <---- project prefixed with type
    data-access-taxes/    <---- project prefixed with type

  shared/                 <---- grouped by scope
    ui-forms/             <---- project prefixed with type
		util-dates            <---- project prefixed with type
```

## Maintaining your structure

With Nx, we’ve always emphasized that a monorepo approach to development requires a specialized toolset. Part of that toolset includes tools to maintain your workspace structure going forward. A good structure reinforces itself with automated tools that make sure teams don’t drift from the intended patterns.

### Define tags

Now that we have our structure together, [tags](/features/enforce-module-boundaries#tags) can be used to further enforce that our structure stays consistent. We recommend using as small a set of tags as possible. Each project should have two tags: its scope and its type. We have boiled our own down to the types of projects we defined previously: feature, ui, data-access, and util. You may need other ones, but developing too many tags can make them frustrating to use.

### Define module boundary rules

These rules allow us to enforce good boundaries between projects:

1. Projects within a scope may only depend on scopes within that scope or within the `shared` scope
2. `feature` libraries may depend on any type of project
3. `ui` libraries may depend on utility projects
4. `data-access` libraries may depend on data-access and utility libraries
5. `util` libraries may only depend on other utility libraries

Why do we want this? Because we’ve defined exactly what responsibilities each type of library should have. Based on just the name of the project and the directory it’s in, the dev can quickly find what they’re looking for without needing to inspect the actual code. Being able to find the right code the first time makes them fast and efficient. Ensuring that libraries have a well-defined responsibility makes it easier to reason about the functionality and which makes us fast and efficient.

[Read more about enforcing module boundaries](/blog/mastering-the-project-boundaries-in-nx)

### Provide tools to make structure and tagging easy

Once you have your structure set, your ongoing challenge will be enforcing this structure so that it continues to work. Your module boundaries will mostly be maintained by the tags. But how do you make sure that projects are named with their scope, type, and project name? And make sure you include the right tags. Make it easy to get these right the first time by creating workspace generators that do this work for you.

[Read more about creating tools to maintain your workspace](/blog/tailoring-nx-for-your-organization)

## Where do we go from here?

Hopefully, your workspace structure is now in the virtuous cycle of self-reinforcement. Good workspace structure leads to more good workspace structure. However, **be ready to evolve based on changes to your organization.** By continuing to set good goals and rules, the rest of your workspace structure will follow.

If you want more insight into this topic, here are other resources we recommend:

- [Nx Cookbook](https://cookbook.marmicode.io/nx/organize-libs) by [Younes Jaaidi](https://bsky.app/profile/younes.marmico.de)
- [Enterprise Angular](https://www.angulararchitects.io/en/ebooks/micro-frontends-and-moduliths-with-angular/) by [Manfred Steyer](https://bsky.app/profile/manfredsteyer.bsky.social)
- [Nx for Scalable Architecture workshop](https://push-based.io/workshop/nx-for-scalable-architecture-february25) by [Push-Based](https://push-based.io/)

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
