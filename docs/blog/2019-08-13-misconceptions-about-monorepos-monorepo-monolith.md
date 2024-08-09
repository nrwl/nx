---
title: 'Misconceptions about Monorepos: Monorepo != Monolith'
slug: 'misconceptions-about-monorepos-monorepo-monolith'
authors: ['Victor Savkin']
cover_image: '/blog/images/2019-08-13/1*0QO5Z5J40-KlXRLkhli9-Q.png'
tags: [nx, release]
---

I’ve been building dev tools for monorepos and helping companies use them for years. **And I’ve been hearing similar objections to the monorepo idea from many teams:**

- It forces us to release together. Monoliths are bad.
- It lets other teams will change my code without my knowing.
- It creates a big ball of mud. It makes applications hard to understand and maintain.
- It doesn’t scale.

Many of them arise from the confusion caused by folks trying tools like Lerna, seeing a bunch of problems with them, and concluding that it is not a viable approach for multi-project-multi-team scenarios.

In this article, **I will show the difference between code-collocation tools (e.g., Lerna) and Google/Facebook-style monorepo tools. Then I’ll talk about common misconceptions related to monorepos.**

Monorepos are not a silver bullet. Nothing is. But hopefully **at the end of this article,** **you will have a clear understanding of the benefits a monorepo brings, what _actual_ challenges you will face, and if it is the right approach for your organization.**

_For example in this post, I will use a set of extensible dev tools for monorepos called_ [_Nx_](https://nx.dev/)_. But the post is not about Nx. Almost everything applies to any monorepo tool._

## Lerna and Monorepos

Lerna is a useful tool. I love it. But it is not what Google, Facebook, Microsoft, or Uber mean when they talk about their monorepos. So what do they mean?

**Monorepo-style development is a software development approach where**:

- You develop multiple projects in the same repository.
- The projects can depend on each other, so they can share code.
- When you make a change, you do not rebuild or retest every project in the monorepo. Instead, you only rebuild and retest the projects that can be affected by your change.

The last point is crucial for two reasons:

- It makes the CI faster. On a large scale, it can be 1000 times faster.
- It gives teams working in the monorepo independence. If two projects A and B, do not depend on each other, they cannot affect each other — _ever_. Team A will be able to develop their project, test it, build it, merge PRs into master without ever having to run any code written by Team B. Team B can have flaky tests, poorly typed code, broken code, broken tests. None of it matters to Team A.

## Misconceptions

### Monorepo !== Monolith

_Will we have to release all on the same day? I don’t like monoliths!_

It’s a common misconception, which comes from a strong association of a repository with a deployment artifact.

But it is not hard to see that **where you develop your code and what/when you deploy are actually orthogonal concerns**. Google, for instance, has thousands of applications in its monorepo, but obviously, all of them are not released together.

Moreover, it’s actually a good CI/CD practice to build and store artifacts when doing CI, and deploy the stored artifacts to different environments during the deployment phase. In other words, **deploying an application should not require access to any repository**, one or many.

**So monorepo !== monolith. Quite the contrary, because monorepos simplify code sharing and cross-project refactorings, they significantly lower the cost of creating libs, microservices and microfrontends. So adopting a monorepo often enables more deployment flexibility.**

### It lets other teams change my code without my knowing

_Another team can break my app, without my knowing, right before the release!_

This misconception originates from folks only using repository settings to control access and permissions. Not many know that **many tools let you configure ownership on the folder basis**.

For instance, GitHub has a feature called [CODEOWNERS](https://help.github.com/en/articles/about-code-owners). You can provision a file that looks like this:

```
apps/app-a/\* @susanapps/app-b/\* @bob
```

With this configuration, if you have a PR updating App A, Susan will have to approve it. If the PR touches only App B, Bob will have to approve it. And if the PR touches A and B, both Susan and Bob will have to approve it.

You actually get more control over code ownership. Look here:

![](/blog/images/2019-08-13/0*5E-n2_HiQ2IUB6Rt.avif)

We have two teams in the org. Team B want to share code between their applications, so they created a library shared-b. This library is private, so they don’t want Team A to depend on it _Why?_ Because if it happens, the teams will get coupled to each other, and Team B will have to account for Team A when changing the shared library.

In a multi-repo setup, nothing prevents Team A from adding shared-b to their `package.json`. It is hard for Team B to know about it because it is done in a repository they do not control. Most monorepo tools (including Nx) allow you to define the visibility of library in a precise way. So when trying to import shared-b, you see this:

![](/blog/images/2019-08-13/0*kw1-bZ5uBPMBsSM4.avif)

### It creates a big ball of mud

_Even one of our applications is barely manageable. If we put five of them in the same repo, no one will be able to understand anything at all!_

This misconception comes from the fact that in most repositories any file can import any other file. Folks try to impose some structure during code reviews, but things do not stay well-defined for long, and the dependency graph gets muddled.

Everyone knows this. Open a mid-sized project (maybe 50k lines of code), and draw a dependency diagram of its main components and how they depend on each other. Now check it against the repository. You will find a lot of “unexpected” edges in the graph.

With Nx, you can create libraries that have well-defined public APIs. And because creating libraries take just a few seconds, folks tend to create more libraries. So a typical application will be partitioned into dozens of libraries, which can depend on each other only through their public APIs.

![](/blog/images/2019-08-13/1*EXH_owC0P-BxSrZJNQ1NyQ.avif)

Nx also auomates the generation of the dependency graph which you can view by running `nx dep-graph`.

![](/blog/images/2019-08-13/0*F8Qh9knmm4Q5Lbpm.avif)

In opposite to the diagram created by some architect you can find in your wiki, which became outdated the day after it was created, this graph is correct and up to date.

Moreover, you can add metadata to the libraries in your repo and define constraints based on it. For instance, you can statically guarantee that presentation components cannot depend on state management code.

![](/blog/images/2019-08-13/0*siq0-iXmF7LNL3iJ.avif)

Funny enough, this is another case where using monorepos results in the opposite of what a lot of folks think.

### It does not scale

_Am I to expect 5 hour CI time?_

Rebuilding and retesting everything on every commit is slow. It does not scale beyond a handful of projects. But as I mentioned above, when using monorepo tools, you only rebuild and retest what is affected.

This does not mean that it will scale indefinitely without your doing anything on the CI side. If you have a dozen of large apps in the repo, the average CI run can be fast. But if you change something everyone depends on, you will have to wait. Even though such PRs are infrequent, at certain scales you have to look at using multiple machines to run the CI.

_Is git going to break?_

This concern is not truly unjustified. If your repo has millions of files, many tools you know and love, including plain Git, will stop working. However, most monorepos do not have thousands of apps. They have a dozen apps built by a single org. Thousands of files, millions of lines of code. All the tools you use can handle this without any problems.

_Microsoft released GVFS, a scalable version of Git that works with enormous repos. Azure Pipelines, BitBucket support it already. GitHub support is coming soon._

## Real Challenges

The things listed above are misconceptions. It does not mean that monorepos are perfect. They come with their own challenges.

### Trunk-based development

Monorepos and long-lived feature branches do not play together nicely. Chances are you will have to adopt some form of trunk-based development. Transitioning to this style of development can be challenging for some teams, partially because they have to adopt new practices such as feature toggles.

I believe that trunk-based development results in better quality code and higher velocity, regardless of the size of the repo, but it is still something you must take into account.

### Not all services work with it

Since monorepos are not mainstream yet, some services do not work well with them. They might expect a single deployment artifact or a coverage report per repo. Having said that, you can work around most issues.

### CI

Moving to a monorepo requires you to rethink how you do continuous integration. After all, you are no longer building a single app. You are only building the things that are affected by your change.

Even though popular CI solutions (e.g., Azure, Circle, and Jenkins) are flexible enough to be used with say Nx, it is still something you might need some time to figure out.

### Large-scale changes

Monorepos make some large-scale changes a lot simpler: you can refactor ten apps made out of a hundred libs, verify that they all work before committing the change.

But they force you to think through large-scale changes more and make some of them more difficult. For instance, if you change a shared library, you will affect all the applications that depend on it. If it is a breaking change, and it cannot be automated, you will have to make the change in a backward-compatible way. You will have to create two versions of the parameter/method/class/package and help folks move from the old version to the new one.

## Let’s Recap

**Monorepos are known for the following benefits:**

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are “workspace” aware
- Consistent developer experience

**In spite of what folks say, they also:**

- Give you more deployment flexibility
- Allow you to set up precise ownership policies
- Provide more structure to your source code
- Scale well using familiar tools

**But they come with some challenges:**

- Trunk-based development is a lot more important
- Not all services work well with monorepos
- Require more sophisticated CI setup
- Require you to think about large-scale changes

## Learn More

Nx is an open-source extensible set of dev tools for monorepos. It works well with any JavaScript or TypeScript technology but has first-class support for Web Components, Angular, React, Express, Nest.

Check out [nx.dev](https://nx.dev/), or watch this video to learn more:

You can find a Japanese translation of this blog post [here](https://www.graat.co.jp/blogs/ck1099bcoeud60830rf0ej0ix).

### Victor Savkin is a co-founder of [Nrwl](https://nrwl.io/). We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2019-08-13/1*Rl36Rix26pUCwGXYWYRCQg.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._

![](/blog/images/2019-08-13/1*pbElIZt9YeORNw8m142z6w.avif)
