---
title: 'Experiments with Angular Renderers'
slug: 'experiments-with-angular-renderers'
authors: ['Victor Savkin']
cover_image: '/blog/images/2016-12-23/1*xPcwZa8goiiPDZGGwrefbA.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/v4nh0p)_, providing Angular consulting to enterprise teams. He was previously on the Angular core team at Google, and built the dependency injection, change detection, forms, and router modules._

One of the design goals we had in mind when starting on Angular v2 was to make it browser and DOM independent. The DOM is complicated, so having components decoupled from it makes them easier to understand, test, and refactor; which is good in itself. But there is more: because of this decoupling we can run Angular applications on other platforms (e.g., Node.js, WebWorkers, NativeScript) without rewriting them. In this article I will show how easy it is to build your own Angular renderer and your own Angular platform.

## Source Code

You can find the source code of the renderer here: [https://github.com/vsavkin/custom-renderer](https://github.com/vsavkin/custom-renderer)

## What is a Platform?

**A platform is an environment where applications run. It is a collection of services providing access to the native capabilities to your applications and to the Angular framework itself.** Since Angular is primarily a UI-framework, one of the most important capabilities the platform provides, and the one we will delve into in this article, is rendering.

## Platform and Bootstrap

Before we jump into building a custom renderer, let’s look at where the platform is specified, and how it is done.

As you can see, t**he bootstrap process consists of two parts: creating a platform and bootstrapping a module.** In this example, the module imports BrowserModule, which is part of the browser platform. **There can be only one platform active on the page, but we can use it to bootstrap multiple modules**, as follows:

Since there is only one platform on the page, only singletons should be registered there. For instance, the browser has only one location bar. That’s why the object providing access to it has to be a singleton registered in the platform itself. But there are many ways to render components which can coexist on the same page, and that is why the renderer is defined in BrowserModule.

So what is the renderer?

## Rendering in Angular

This is the interface the renderer implements.

It might look a bit overwhelming, but as we see later, it’s actually not difficult to implement.

### How does it work?

When instantiating a component, Angular invokes \`renderComponent\` and associates the renderer it gets with that component instance. Everything Angular will do regarding rendering the component (creating elements, setting attributes, subscribing to events, …) will go through that renderer object.

## Using Renderer Imperatively

You can also inject the renderer object into a component’s constructor to interact with the native platform imperatively.

## Building a Custom Renderer

We have learned how the renderer looks like and how we can use it. Now, it’s time to build our own. This renderer will write into an in-memory data structure. And on every browser event, instead of sending changes to the screen, it will print the data structure in the console.

For instance, if our application looks like this:

The renderer will print the following in the console:

### Defining Data Structure

Let’s start with defining the data structure.

### Defining Renderer

Next, let’s define the renderer.

Since we can bootstrap more than one component, the root renderer has an array of roots instead of a single root. The implementation of InMemoryRenderer is self-explanatory.

### Create Custom Browser Platform

Next, we need create a custom browser platform that uses the newly created renderer.

We can use this platform to bootstrap our application.

### Using NgZone

The application is running using the new renderer, but nothing appears in the console. To fix it we need do what the browser does — flush the change on every browser event. There are a few ways to do it, one of which is to subscribe to the onStable observable provided by NgZone.

Here we use APP_INITIALIZER to plug into the Angular bootstrap process. When bootstrapping an application, Angular will invoke all initializers, which will set up the render flushing.

## Summary

One of the design goals of Angular is to be decoupled from the DOM. This results in many wonderful things, one of which is that we can run applications using WebWorkers, NativeScript, ReactNative, etc. That’s why Angular separates platform-specific capabilities from the ones provided by your application. One of these capabilities is rendering.

In this article, by implementing an in-memory renderer, I showed how easy it is to build your own renderer and your own platform.

I encourage you to experiment: build renderers using canvas and WebGL, and share your thoughts in the comments below.

### Victor Savkin is a co-founder of [Nrwl — Enterprise Angular Consulting.](http://nrwl.io)

![](/blog/images/2016-12-23/1*s76h75v7CB7g4EuxVNaGkg.avif)

_If you liked this, click the💚 below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about Angular._
