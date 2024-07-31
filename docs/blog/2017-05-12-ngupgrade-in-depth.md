---
title: 'NgUpgrade in Depth'
slug: 'ngupgrade-in-depth'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-05-12/1*aW8snyXZEw1fM6rfozXY2Q.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools._

NgUpgrade is a library put together by the Angular team, which we can use in our applications to mix and match AngularJS and Angular components and bridge the AngularJS and Angular dependency injection systems. In this article we will look at what it is and how it works.

## How to Use it Best

This article only talks about the mechanics of of the library, and not how to use it in the best way. That’s covered in the rest of the series.

- [Upgrading Angular Applications: Upgrade Shell](https://medium.com/upgrading-angular-applications-upgrade-shell-4d4f4a7e7f7b)
- [Two Approaches to Upgrading Angular Applications](https://medium.com/two-approaches-to-upgrading-angular-apps-6350b33384e3)

## How it Works

An Angular application is a tree of components, with each of them having an injector. Plus there is an injector for the NgModule of the application. When trying to resolve a dependency for a particular component, the framework will first try to get it from the component tree. And if the dependency cannot be found, Angular will get it from the NgModule’s injector.

![](/blog/images/2017-05-12/0*gygteyn_ydNOOhOl.avif)

If the application uses lazy loading, the diagram will look more complex, but we will cover this use case in the article about lazy loading and NgUpgrade.

Using NgUpgrade we can bootstrap an existing AngularJS application from an Angular application. And we do it in such a way that we can mix-and-match components written in the two frameworks and bridge the two DI systems. We can consider such an application a “hybrid application”.

![](/blog/images/2017-05-12/0*jWsvFG6BHVcqwxNl.avif)

## Bootstrapping

The easiest way to bootstrap such a hybrid application is to have an NgModule without any bootstrap components. Instead it defines _ngDoBootstrap_ where we use the injected _UpgradeModule_ to bootstrap the AngularJS application.

This is a good default because components upgraded from AngularJS to Angular require an AngularJS ancestor component, and this way of bootstrapping guarantees that. This, however, does not work in certain situations. For instance, it won’t work if we load and bootstrap the AngularJS application lazily, only when the user navigates to a certain route. In this case we need to bootstrap our hybrid differently, by doing it in a lazy-loaded component.

### UpgradeModule.bootstrap

_UpgradeModule.bootstrap_ has the same signature as _angular.bootstrap_. And if we look at the implementation, we will see that it actually calls _angular.bootstrap_ under the hood, but it does it with a few tweaks:

- It makes sure _angular.bootstrap_ runs in the right zone.
- It adds an extra module that sets up AngularJS to be visible in Angular and vice versa.
- It adapts the testability APIs to make Protractor work with hybrid apps.

### Capturing AngularJS and Lazy Loading

One thing that may not be obvious is that importing _“@angular/upgrade/static”_ captures _window.angular_. And that’s why we have to import the AngularJS framework before we import _“@angular/upgrade/static”_.

Otherwise we’ll see the _“AngularJS v1.x is not loaded”_ error.

This works well for simple applications, but is problematic for complex enterprise applications, where, for instance, AngularJS can be loaded lazily via _requirejs_. To make it work there, we can manually reset AngularJS, as follows:

### Using “‘@angular/upgrade/static” or “@angular/upgrade”?

For historical reasons NgUpgrade has two entry points: _“@angular/upgrade”_ and _“@angular/upgrade/static”_. Use _“@angular/upgrade/static”_. It provides better error reporting and works in the AOT mode.

### Fixing Module Resolution

Depending on our application’s build setup, we may need to point the bundler to the right UMD bundle. For instance, this is how you do it for webpack:

We have learned how to bootstrap a hybrid application. Now let’s see how we can bridge the AngularJS and Angular dependency injection systems.

## Dependency Injection

An important part of the upgrade process is moving services (or to use a better word, “injectables”) from AngularJS to Angular. Usually we don’t have to make any of the changes to the injectables themselves — we just need to make sure they are properly wired up in the DI system. This often requires us to either access AngularJS injectables in Angular or access Angular injectables in AngularJS.

### Accessing AngularJS Injectables in Angular

Say our AngularJS application has the following injectable:

We can access it in the Angular part of the application via _$injector_, like this:

_UpgradeModule_ brings in _$injector_ (the injector of our AngularJS application), and that’s why we can access it in _AppModule_ or any of its children.

Note that _$injector_ gets defined by the _upgrade.bootstrap_ call. If we try to get it before calling _bootstrap_, we will see the “Cannot read property ‘get’ of undefined” error.

### Accessing Angular Injectables in AngularJS

We can also make Angular injectables available in the AngularJS part of our application, like this:

There is more going on here. This is because the Angular DI system allows us to use any token (e.g., types) to express dependencies between injectables. But in AngularJS we can only use strings for that. By doing this _m.factory(‘angularInjectable’, downgradeInjectable(AngularInjectable))_ we map _AngularInjectable_ to the ’_angularInjectable_’ string. We then use it to instantiate _needsAngularInjectable_.

## Component Integration

Another important capability provided by NgUpgrade is being able to mix-and-match AngularJS and Angular components.To demonstrate how it works, we’ll look at the following example.

![](/blog/images/2017-05-12/0*1Px3J8bxXKedXoSq.avif)

There are three components in this example: _AppComponent > angularJSComponent > AngularComponent._

- _AppComponent_ is written in Angular and is downgraded to AngularJS.
- _angularJSComponent_ is written in AngularJS and is upgraded to Angular.
- _AngularComponent_ is written in Angular and is downgraded to AngularJS.

Let’s start with a simple case where the components do not pass any data and do not re-project any nodes.

Let’s look at this example in detail.

First, to use an Angular component in an AngularJS context we need register it using the _downgradeComponent_ function, like this:

This creates an AngularJS directive with the _appRoot_ selector. This directive will use _AppComponent_ to render its template. Because of this indirection, we need to register _AppComponent_ as an entry component.

So the _<app-root>_ element itself is owned by AngularJS, which means that we can apply other AngularJS directives to it. Its template, however, is rendered using Angular.

The _downgradeComponent_ function sets everything up in such a way that the AngularJS bindings will be hooked up with the inputs and outputs of AppComponent.

Extending _UpgradeComponent_ allows to upgrade an AngularJS component.

To ensure the necessary guarantees, NgUpgrade allows only for certain directives to be upgraded. So if we have a directive defining _compile_, _terminal_, _replace_, or _link.post_, we will have to wrap it into an AngularJS component.

### Inputs and Outputs

Now, let’s make components interact via inputs and outputs.

Let’s go through the changes.

Adding inputs and outputs to a downgraded component does not require any extra configuration — we just need to add the properties themselves.

And we can bind to them in the AngularJS context.

Note that as with Angular templates, we use square brackets and parenthesis. But in opposite to Angular, we have to hyphenize property names.

When upgrading components we have to to list the inputs and outputs in two places.

First in the Angular directive extending _UpgradeComponent_.

And then in the AngularJS component itself.

### Two-Way Bindings

AngularJS and Angular implement two-way binding behavior differently. AngularJS has a special two-way binding capability, whereas Angular simply uses an Input/Output pair. NgUpgrade bridges the two.

### Bindings and Change Detection

Change detection works differently in AngularJS and Angular. In _AngularJS $scope.apply_ triggers a change detection run, also known as a digest cycle. In Angular, we no longer have _$scope.apply_. Instead, the framework relies on Zone.js, which will trigger a change detection run on every browser event.

Since a hybrid application is an Angular application, it uses Zone.js, and we don’t need to worry about _$scope.apply_.

Angular also provides strict guarantees to make the order of checks predictable. A hybrid application preserves these guarantees.

### Transclusion/Reprojection

Both AngularJS and Angular provide ways to project nodes from the content DOM into the view DOM. In AngularJS it is called transclusion. In Angular is is called reprojection.

For simple cases like this, everything works the way you would expect. You use _<ng-transclude></ng-transclude>_ in AngularJS and _<ng-content></ng-content>_ in Angular. Multi-slot reprojection still has some issue, which hopefully will be ironed out soon.

## Code Samples

- [The code samples illustrating the bridging of the two dependency injection systems.](https://github.com/vsavkin/upgrade-book-examples/tree/master/ngupgrade/mixing-di)
- [The code samples illustrating the component integration.](https://github.com/vsavkin/upgrade-book-examples/tree/master/ngupgrade/mixing-components)

## Summary

NgUpgrade is a library we can use to mix and match AngularJS and Angular components and bridge the AngularJS and Angular dependency injection systems. In this article we looked at how it works and how we can use it.

## Upgrading Angular Applications Book

This article is based on the Upgrading Angular Applications book, which you can find here [https://leanpub.com/ngupgrade](https://leanpub.com/ngupgrade). If you enjoy the article, check out the book!

## Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-05-12/0*KdwqYwr3GbqHinYx.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
