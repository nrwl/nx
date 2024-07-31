---
title: 'Essential Angular: Change Detection'
slug: 'essential-angular-change-detection'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-01-03/1*4vRt7euWTTHxX6FHxtheJA.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/IAi7JWß)_. He was previously on the Angular core team at Google, and built the dependency injection, change detection, forms, and router modules_

\_.\_This is the fourth post in the Essential Angular series, which aims to be a short, but at the same time, fairly complete overview of the key aspects of Angular. In this post I’ll cover change detection and data flow.

## Read the Series

Even though it’s not required, I recommend to read the first four posts in the series before starting on this one.

- [Essential Angular. Part 1: Compilation](https://medium.com/essential-angular-2-compilation-cfbebf9bb6e4#.y9s7pc41m)
- [Essential Angular. Part 2: NgModules](https://medium.com/essential-angular-ngmodules-16474ea99713#.5y73lcqde)
- [Essential Angular. Part 3: Components and Directives](https://medium.com/essential-angular-components-and-directives-ab65172ba60#.47zn86pdl)
- [Essential Angular. Part 4: Dependency Injection](https://medium.com/essential-angular-dependency-injection-a6b9dcca1761#.opd2cg9wk)

**You can also check out** [**the Essential Angular book**](https://gumroad.com/l/essential_angular)**, which has extra content not available on this blog.**

## Example App

Throughout this series I use the same application in the examples. This application is a list of tech talks that you can filter, watch, and rate.

![](/blog/images/2017-01-03/1*Vjih_NbJCX6bzORavaL8qg.avif)

You can find the source code of the application [here](https://github.com/vsavkin/essential-angular-book-app).

## Two Phases

**Angular separates updating the application model and reflecting the state of the model in the view into two distinct phases.** The developer is responsible for updating the application model. Angular via bindings, by means of change detection, is responsible for reflecting the state of the model in the view. The framework does it automatically on every VM turn.

**Event bindings,** which can be added using the () syntax, can be used to capture a browser event or component output to execute some function on a component or a directive. So they often trigger the first phase.

**Property bindings,** which can be added using the \[\] syntax, should be used only for reflecting the state of the model in the view.

As we have learned, an Angular application consists of nested components, so it will always have a component tree. Let’s say for this app it looks as follows:

![](/blog/images/2017-01-03/1*pdZ2L_w3GsIHkeqJ7t16vA.avif)

Next, define the application model that will store the state of our application.

Now, imagine an event changing the model. Let’s say I watched the talk “Are we there yet”, I really liked it, and I decided to give it 9.9.

The code snippet below shows one way to do it. The \`handleRate\` function is called, via an event binding, when the user rates a talk.

In this example, we do not mutate the talk, and instead create a new array of new talks every time a change happens, which results in a few good properties. But it is worth noting that Angular doesn’t require us to use immutable objects, and we could just as easily write something like \`talk.rating = newRating\`.

All right, after \`rateTalk\` executes, the updated model will look like this:

At this point nothing has changed in the view. Only the model has been updated.

Next, at the end of the VM turn, change detection kicks in to propagate changes in the view.

**First, change detection goes through every component in the component tree to check if the model it depends on changed. And if it did, it will update the component.** In this example, the first talk component gets updated:

![](/blog/images/2017-01-03/1*saesnokbuK71ctHaHz_BBA.avif)

Then, the framework updates the DOM. In our example, the rate button gets disabled because we cannot rate the same talk twice.

Note, the framework has used **change detection** and **property bindings** to execute this phase.

In our example we are using shared state and immutable data. But even if we used local state and mutable data, it would not change the property that the application model update and the view state propagation are separated.

## Why?

Now, when we have understood how we had separated the two phases, let’s talk about why we did it.

### Predictability

First, using change detection only for updating the view state limits the number of places where the application model can be changed. In this example it can happen only in the \`rateTalk\` function. A watcher cannot “automagically” update it. This makes ensuring invariants easier, which makes code easier to troubleshoot and refactor.

Second, it helps us understand the view state propagation. Consider what we can say about the talk component just by looking at it in isolation. Since we use immutable data, we know that as long as we do not do talk= in the Talk component, the only way to change what the component displays is by updating the input. These are strong guarantees that allow us to think about this component in isolation.

Finally, by explicitly stating what the application and the framework are responsible for, we can set different constraints on each part. For instance, it is natural to have cycles in the application model. So the framework should support it. On the other hand, html forces components to form a tree structure. We can take advantage of this and make the system more predictable.

**Starting with Angular 2.x it gets easier to think about components because the framework limits the number of ways it can modify the components, and those modifications are predictable.**

### Performance

The major benefit of the separation is that it allows us to constrain the view state propagation. This makes the system more predictable, but it also makes it a lot more performant. For example, the fact that the change detection graph in Angular can be modeled as a tree allowed us to get rid of digest TTL (multiple digest runs until no changes occur). Now the system gets stable after a single pass.

## How Does Angular Enforce It?

What happens if I try to break the separation? What if I try to change the application model inside a setter that is invoked by the change detection system?

Angular tries to make sure that the setter we define for our component only updates the view state of this component or its children, and not the application model. To do that Angular will check all bindings twice in the developer mode. First time to propagate changes, and second time to make sure there are no changes. If it finds a change during the second pass, it means that one of our setters updated the application model, the framework will throw an exception, pointing at the place where the violation happened.

## Content and View Children

Earlier I said “change detection goes through every component in the component tree to check if the model it depends on changed” without saying much about how the framework does it. In what order does it do it? Understanding this is crucial, and that’s what I’m going to cover in this section.

There are two types of children a component can have: content children and view children. To understand the difference between them, let’s look at the following example:

The content children of the tabs component are the three tab components. The user of the tabs component provided those. The previous and next buttons are the view children of the tabs component. The author of the tabs component provided those.

This is the order in which Angular will check the bindings:

- It will check the bindings of the tabs component first, of which there are none.
- It will check the three tab component, the content children of the tabs component.
- It will check the template of the tabs component.

## ChangeDetectionStrategy.OnPush

If we use mutable objects that are shared among multiple components, Angular cannot know about when those components can be affected. A component can affect any other components in the system. That is why, by default, Angular does not make any assumptions about what a component depends upon. So it has be conservative and check every template of every component on every browser event. Since the framework has to do it for every component, it might become a performance problem even though the change detection in the new versions of Angular got way faster.

If our model application state uses immutable objects, like in the example above, we can tell a lot more about when the talk component can change. The component can change if and only if any of its inputs changes. And we can communicate it to Angular by setting the change detection strategy to OnPush.

Using this change-detection strategy restricts when Angular has to check for updates from “any time something might change” to “only when this component’s inputs have changed”. As a result, the framework can be a lot more efficient about detecting changes in TalkCmp. If no inputs change, no need to check the component’s template. In addition to depending on immutable inputs OnPush components can also have local mutable state.

## Let’s Recap

- Angular separates updating the application model and updating the view.
- Event bindings are used to update the application model.
- Change detection uses property bindings to update the view. Updating the view is unidirectional and top-down. This makes the system more predictable and performant.
- We make the system more efficient by using the OnPush change detection strategy for the components that depend on immutable input and only have local mutable state.

## Essential Angular Book

This article is based on the Essential Angular book, which you can find here [https://leanpub.com/essential_angular](https://leanpub.com/essential_angular). If you enjoy the article, check out the book!

### Victor Savkin is a co-founder of [Nrwl](https://nrwl.io). We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-01-03/0*4HpWdaQEPIQr1EDw.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
