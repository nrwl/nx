---
title: 'Reactive Programming in Angular'
slug: 'reactive-programming-in-angular'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-04-25/1*mF3ulz7qZCuJPD0PATCSng.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools._

## Reactive Programming in the Core Framework

An Angular application is a reactive system. The user clicks on a button, the application reacts to this event and updates the model. The model gets updated, the application propagates the changes through the component tree.

![](/blog/images/2017-04-25/1*4gPLTEovBkmzphrvepAamA.avif)

Angular implements these two arrows very differently. Let’s explore why.

## Read the Series

This is the seventh post in the Essential Angular series, which aims to be a short, but at the same time, fairly complete overview of the key aspects of Angular.

- [Essential Angular. Part 1: Compilation](https://medium.com/essential-angular-2-compilation-cfbebf9bb6e4#.y9s7pc41m)
- [Essential Angular. Part 2: NgModules](https://medium.com/essential-angular-ngmodules-16474ea99713#.5y73lcqde)
- [Essential Angular. Part 3: Components and Directives](https://medium.com/essential-angular-components-and-directives-ab65172ba60#.47zn86pdl)
- [Essential Angular. Part 4: Dependency Injection](https://medium.com/essential-angular-dependency-injection-a6b9dcca1761#.opd2cg9wk)
- [Essential Angular. Part 5: Change Detection](https://medium.com/essential-angular-change-detection-fe0e868dcc00#.isq09mg9b)
- [Essential Angular. Part 6: Testing](https://medium.com/essential-angular-testing-192315f8be9b#.gdzmcppoh)
- [Essential Angular. Part 7: Forms](https://medium.com/angular-forms-in-depth-ecb7c58166b5)

**You can also check out** [**the Essential Angular book**](https://gumroad.com/l/essential_angular)**, which has extra content not available on this blog.**

## Example App

Throughout this series I use the same application in the examples. This application is a list of tech talks that you can filter, watch, and rate.

![](/blog/images/2017-04-25/1*Vjih_NbJCX6bzORavaL8qg.avif)

You can find the source code of the application [here](https://github.com/vsavkin/essential-angular-book-app).

## Events and State

To understand why Angular uses two very different ways of reactive programming, we need to look at the differences between events and the state.

We often talk about events or event streams when discussing reactivity. Event streams are an important category of reactive objects, but so is state. So let’s compare their properties.

_Events are discrete and cannot be skipped. Every single event matters, including the order in which the events are emitted. The “most recent event” is not a special thing we care about. Finally, very rarely are events directly displayed to the user._

_The state, on the other hand, is continuous, i.e., it is defined at any point in time. We usually do not care about how many times it gets updated — only the most recent value matters. The state is often displayed or has a meaningful serialization form._

Say the conference application we use in this series has a “Load More” button, clicking on which loads more items and adds them to the list. Using this button and mouse click events we can change the content of the list. Clicking on the button increases the number of items. The number of clicks matters. And we cannot skip any of them, as it would change the content of the list. Finally, we will never have to examine the last click event or display it to the user.

The list itself, on the other hand, is the state. We only care about its latest value, not about how many times it was updated.

### Definition

_Event streams are sequences of values produced over a period of time. And the state is a single value that varies over time._

In this example, the _talk_ input of _TalkCmp_ is the state, which is derived from the _talks_ property of the _app_ object.

Note that we only care about the most recent value of _talk_, i.e., skipping an intermediate value of _talk_ won’t affect anything. Contrast it with the _selected_ event sequence, where every single emitted value matters, including the order in which they are emitted.

## Time

Another thing that is different in regards to the state and events is their relation to time.

Using time when deriving the state is rarely practical, i.e., time is always implicit. Using time when dealing with events is common (e.g., debouncing), i.e., time is often explicit.

To make dealing with time easier, Angular has support for reified reactive programming.

What is it?

## Reified and Transparent

Let’s look at this example one more time.

Or to be more specific, let’s look at the _{{talk.title}}_ binding. Angular does not provide any object representing it — we only get the current value. We can call this type of reactive programming transparent because the developer only interacts with the most recent value, and the act of observation is hidden in the framework.

When propagating state we only care about the latest value, and we don’t usually need to worry about time. And that’s why Angular uses this type of reactive programming here. It is simpler and a lot more performant. Plus we can use ‘plain’ JavaScript to composes different values changing over time, like this:

Now, let’s look at the _selected_ event. Angular gives us a EventEmitter object to represent it. We can call this type of reactive programming reified because we have access to a concrete object representing the act of observation. And having these concrete objects is powerful because we can manipulate them, pass them around, and compose them. In particular, we can use them to explicitly handle time.

This type of reactive programming is more powerful, but it is also more complicated: we have to use special operators to do composition. For instance, the example above will have to be rewritten like this:

When handling events we often care about the time aspect, and that’s why Angular uses this type of reactive programming for managing events.

### Observables

There are many ways to implement event streams or reified reactive programming. Angular embraced RxJS, and the _EventEmitter_ class is just an implementation of _RxJS/Observable_.

### RxJS and Reactive Programming

When saying “reactive programming”, many are referring to programming using RxJS. Most of what you do in Angular is reactive even if you don’t use RxJS. Reified reactive programming is a better way to refer to programming using observable-based APIs.

### What About Event Callbacks?

Since reified reactive programming is more complicated than transparent reactive programming, Angular supports handling events in a more traditional way by supplying callbacks (e.g., the click handler in the example above). In other words, we can use both transparent and reified programming to handle events. We will see the same being true in other parts of the framework and the ecosystem: we can use transparent reactive programming for simple use cases, and the reified one for advanced ones.

> _Unfortunately, at the moment Angular’s support for reified reactive programming in the core framework is a bit inconsistent (e.g., all the DOM events are handled in the transparent way, but there is a proposal to make it complete_ [_https://github.com/angular/angular/issues/13248_](https://github.com/angular/angular/issues/13248)_)._

## Reactive Programming in the Angular Ecosystem

We have looked at how the Angular core framework itself supports reactive programming. Now let’s look at the Angular ecosystem.

## @angular/forms

Angular has always had strong support for building dynamic forms. It’s one of the main reasons the framework got so successful.

Now the framework comes with a module that adds support for handling input using reified reactive programming.

Look at how elegant this solution is. We simply define a form with two controls, which we bind to the two input elements in the DOM.

Then we use the _valueChanges_ observable to wait for the form to get stable before firing a request. We use the _switchMap_ operator to ignore all the requests but the last one, so the filters form and the data will never get out of sync. We then bind the created observable using the async pipe to display the list of talks.

Implementing this without _ReactiveFormsModule_ requires a lot of manual state management, correlation IDs, and is not easy to get right.

That’s why _ReactiveFormsModule_ is one of the most useful additions to the framework. It enables us to solve many input-handling problems in an elegant way, with just a few lines of code.

For simple cases, however, we can still grab the current value, which is transparently kept in sync with the UI, like this:

## @angular/router

The Angular router is built around the same ideas. It gives us a simple API to get the current value of params to use in simple use cases, and an observable-based API for more interesting situations.

It also exposes all router events via an observable that can be used as follows:

## Summary

An Angular application is a reactive system. And that’s why we need to understand reactive programming to be productive with Angular.

Reactive programming works with event streams and the state. And it can be divided into transparent and reified.

Since the very beginning the framework has had excellent support for transparent reactive programming. It was used both to propagate the state and to handle events. It is simple and fast. And the new versions of the framework still support it.

But it can also be limiting at times and make solving certain problems difficult. That’s why Angular now comes with support for reified reactive programming, using observables.

The Angular ecosystem embraced these ideas as well. The reactive forms module, the router, and other libraries like NgRx, all provide observable-based APIs.

## Essential Angular Book

This article is based on the Essential Angular book, which you can find here [https://leanpub.com/essential_angular](https://leanpub.com/essential_angular). If you enjoy the article, check out the book!

### Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-04-25/0*AT7i_fgGVQcAP4rM.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
