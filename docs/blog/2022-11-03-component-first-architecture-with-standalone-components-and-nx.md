---
title: 'Component-First Architecture with Standalone Components and Nx'
slug: 'component-first-architecture-with-standalone-components-and-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-11-03/1*qD9Wz2o4WIbhKfw9VZvb6g.png'
tags: [nx]
---

When [Angular](https://angular.io/) 2 released its first pre-release versions, it had no concept of `NgModule`. We attached `Components` as `Directives` to Components that needed them.

But it all changed in Angular 2-rc.5. This version saw the introduction of `NgModules`. The additional metadata was required for the compiler and to help accurately create injection hierarchies for the dependency injection system. This completely changed how Angular apps were architectured and designed. It also added a level of complexity to building Angular apps and another concept new Angular developers had to learn and understand.. optional `NgModules` soon became the top feature request on the Angular repository.

## Introducing Standalone Components

In the past year, the Angular Team tackled this and the solution is Standalone Components. Released under the `Developer Preview` label during the last few iterations of Angular 14, they’ll be officially marked stable now in Angular 15.

Standalone Components offer a much simpler approach to application development and better fit the current trend of frontend development that focuses on the composition of components.

Let’s take a look at some of the differences now that we have Standalone Components.

## Creating Components

Creating components in Angular originally required that we create a Component and declare it in an existing or new NgModule. With Standalone Components, we now just set the `standalone: true` property in the Component Decorator metadata and we no longer need to declare it in an NgModule. If the Standalone Component requires Components, Pipes or Directives that are exported from an existing NgModule or Standalone Component, Pipe or Directive, then we just need to use the new `imports: []` property on the Component Decorator metadata to import them. You can see an example of the changes below:

![](/blog/images/2022-11-03/0*0s9lcyC_6ZjrV71m.avif)

## Using Standalone Components

As mentioned above, Standalone Components can directly import other Standalone Components to allow using them in your template. If you need to maintain some level of interoperability between NgModules and Standalone Components, Standalone Components can also be imported to NgModules.

![](/blog/images/2022-11-03/0*IXxb0U0J89uicHUA.avif)

## Routing

With NgModules becoming optional, there needed to be a new method to route through our applications without having to make use of `RouterModule.forRoot()` and `RouterModule.forChild()`.  
The Angular Team has created some Standalone APIs that provide this functionality without having to use the `NgModule` equivalents. The `provideRouter` API replaces the `RouterModule.forRoot()`. They have also enabled lazy-loading of routes constants, meaning we can directly reference other exported route declarations, rather than only NgModules.

![](/blog/images/2022-11-03/0*85z8p_jG1GmCL-By.avif)

## Testing

Testing with Standalone Components becomes much easier. We no longer need to configure TestBed to include all the NgModules that our component requires to function because the Component itself already imports them. The only additional configuration you may find yourself doing with TestBed will be to set up Mocks and Spies.

![](/blog/images/2022-11-03/0*oUGxidbC_4AeydTs.avif)

## Bootstrapping an Application

Previously, bootstrapping an application involved two distinct efforts:  
Telling Angular which NgModule to bootstrap  
Stating which Component the NgModule should bootstrap

The NgModule used to bootstrap (usually `AppModule`) would also include all root-level providers and NgModules that implemented `.forRoot`.

With Standalone Components, there is a new function, `bootstrapApplication`, which replicates this functionality, but allows you to tell it the Standalone Component to bootstrap, along with all root-level providers. For example, this is where we would add `provideRouter`.

![](/blog/images/2022-11-03/0*vilVrbKyEzqsXrIe.avif)

It’s already becoming obvious that building our Angular applications solely with the Standalone Components, Pipes, Directives and APIs is much much simpler and more straightforward than working with NgModules. However, NgModules provided a clear concept of how to architect our applications with patterns such as CoreModules, SharedModules and FeatureModules.

This leaves a gap for similar patterns to be utilized when using Standalone Components.

## What is Component-First Architecture?

Component-First Architecture is a pattern for architecting our applications to fill the void left by the patterns that sprung up around NgModules. It also has a core concept.

> The concept that your application is entirely controlled by your components

Component-First architecture is composed of four main pillars.  
1\. Standalone Components and declarables  
2\. Reduced Provider Indirection  
3\. Dedicated Routes File / Component  
4\. Component-led State Management

![](/blog/images/2022-11-03/0*KK0qXbFB0q4NJkxO.avif)

## Standalone Components and Declarables

> Applications should be a composition of Standalone Components, Pipes and Directives

Standalone Declarables import exactly what they need to operate. From this, the reasoning of how they work becomes much more straightforward. Testing becomes easier as there is less setup to do on the testing side. Debugging becomes much easier and we can see everything impacting the Component, Pipe or Directive just by looking at its decorator metadata.

I also believe dev tools in general could become much smarter. All our files will have direct TS Imports to the other files they depend on. With this information, we could build an architecture graph that could help find circular dependencies as well as enabling Nx affected-like incremental building of our applications.

![](/blog/images/2022-11-03/0*LZHXdS-ZABK4GHke.avif)

## Reduced Provider Indirection

> Services that can be used globally should use \`providedIn: ‘root’ while component-specific services should be provided directly in that component’s decorator metadata.

This again feeds into the idea that we can see instantly just from looking at the decorator metadata exactly what is required, which makes it much easier to reason about our application as a whole and can help prevent issues relating to the dependency injection hierarchy that could cause multiple instances of services that we expect to be singletons.

![](/blog/images/2022-11-03/1*p5FzYictV6M7XbyKK0QYnQ.avif)

## Dedicated Routes File

> There should be a dedicated \*.routes.ts file for each feature / domain as the entrypoint

By having a dedicated routes file as the entry point to our features, we can reimplement the FeatureModule pattern we’ve grown accustomed to with NgModules while having the added benefit of being able to easily identify where our routing configuration is throughout our application. We can use this to also build a map of routing throughout our application.

![](/blog/images/2022-11-03/0*73IM4tqsd_rpwIzE.avif)

## Component-led State Management

> Our components should lead how we manage the state within our application. Use global stores for shared state, otherwise offload component and feature-related state to our components.

Using a tool like [NgRx Component Store](https://ngrx.io/guide/component-store), each component can then manage its own state using reactive methods. This leads to less indirection about where state is managed for the Component. It is provided to the Component directly and therefore continues to fill the philosophy that we should know everything about our component simply by looking at its decorator metadata. All children of the component can access it and therefore allows a `child -> parent -> child` data flow.

Even with NgRx Component Store, global state management can still be achieved, allowing us to set up dedicated stores for shared state within our application. All we have to do is add `providedIn: ‘root’` to the service for the store and then we can inject it into any Component or Service / Component Store that requires it.

Finally, feature-level stores can also be created. As Component Stores are provided as a service, if we create a Component Store for a full feature and inject it to the entry component of a feature, all children of that feature can access the store and interact with it.

![](/blog/images/2022-11-03/0*6lER7wnyvc2wtt2t.avif)

## Example Directory Structure

Following this pattern we would end up with a folder structure where it’s easy to identify features, routing configuration and where state is managed throughout our application.

![](/blog/images/2022-11-03/0*5hjmbNmrNt2d802k.avif)

## How can Nx help?

Nx offers three core elements that can greatly aid in following this architecture pattern.

- Generators — to help us easily scaffold code following the guidelines.
- Standalone Component Support — at a much higher level than is currently offered by the Angular CLI.
- Workspace Libraries — to help us split features by domain into separate libraries that offer a public API exporting only our entry points.

The generators offered by Nx allow us to not only generate applications and libraries that are setup to use Standalone Components, they also allow us to automatically attach routing configurations for new libraries to existing Routes Files.

Below is a list of commands that will scaffold our architecture and automatically wire up our routing configurations.

![](/blog/images/2022-11-03/0*9dSwBpI1WfOexwuV.avif)

You can see a video of some of this in action here:

{% youtube src="https://www.youtube.com/watch?v=e-BpE9d3NIw" /%}

## Conclusion

Standalone Components offer a much better DX than `NgModule` applications but there was initially a gap in how we should architect our applications with just Standalone Components. This article has talked through one approach that should make it easy and straightforward to continue building Angular applications in a way that we are familiar with and which builds on the greater DX of Standalone Components.

## Learn More

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/nrwl_io)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
- 🧐 [Need help with Angular, React, Monorepos, Lerna or Nx? Talk to us 😃](https://nrwl.io/contact-us)
