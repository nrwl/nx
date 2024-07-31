---
title: '5 Reasons to Use Angular Elements'
slug: '5-reasons-to-use-angular-elements'
authors: ['Victor Savkin']
cover_image: '/blog/images/2018-11-05/1*5bxmfkHU6iEBjFk7_ml0-w.png'
tags: [nx]
---

![](/blog/images/2018-11-05/1*3KcN8XEiOGRurVItKG2Eiw.avif)

**From Day 1 the Angular team at Google had the goal of building the world’s preeminent next-generation framework on top of web standards.** As a corollary to that larger mission, we had countless meetings with the folks from the Chrome team to figure out how to handle custom elements in the best possible way.

Not many realize it, but a lot of Angular features that we built at Google were designed to handle custom elements. For instance, the famous square-bracket-binding syntax allows the framework to distinguish between properties and attributes.

```
<nrwl-hello [someProp]="value" someAttr="some value"></nrwl-hello>
```

Prior to custom elements, frameworks could whitelist known elements and attributes, but it was realized that this solution is not scalable. Custom elements, after all, are custom, so frameworks cannot tell what is an attribute and what is a property. The user has to choose.

**That’s why Angular components can so easily consume custom elements. Going in the other direction was historically a lot trickier. But not any more.**

## Meet Angular Elements?

![](/blog/images/2018-11-05/1*1Dx9Yl54R7EZ0Cr4w6TxlA.avif)

The `@angular/elements` package makes it possible. With it, you can publish angular components as custom elements. This is how you do it.

As you can see, we added our component to the `entryComponents` array and then use `createCustomElement` function to create the element out of it. You’ll also note that we did not include the `bootstrap` array within our `NgModule` configuration, and we overrode the `ngDoBootstrap` lifecycle hook with an empty method.

Once we have the custom element, we add it to the custom elements registry by using the `define` method. We can then include the app on the page and instantiate the element by adding this to the DOM:

```
<nrwl-hello></nrwl-hello>
```

The browser will see the element and will instantiate the Angular component.

Right, so it’s easy. Why would we do it?

## Why Angular Elements?

There are five main reasons to use Angular elements.

### Reason 1: Embedding Angular Components Into Non-Angular Applications

All framework speak “custom elements”, at least to some degree. So if you want to embed an Angular component into your React, Vue, or Ember app, just wrap it into a custom element. Having said that, we at Nrwl recommend you to avoid mixing frameworks unless you have a very good reason to.

### Reason 2: Embedding Angular Components Into Content Sites

If you have a server-side (e.g. ASP.net) application you want to sprinkle with some Angular magic, Angular Elements are the easiest way to do it.

### Reason 3: Implementing Dynamic Angular Applications (“Dashboard”/CMS)

Seemingly every other application we look at contains a requirement for some kind of dynamic dashboard. Usually such a dashboard has to be assembled from a fixed set of Angular components using some metadata. This has to happen at runtime, so we cannot precompile an assembled dashboard.

If your requirements allow you to configure the dashboard using JSON, you could write an interpreter component that will assemble the dashboard at runtime using `DynamicComponentLoader`.

This, however, doesn’t work for more advanced scenarios. If you have a CMS allowing agents to author custom HTML containing Angular elements, the above approach will break down. **In AngularJS we could use** `**$compile**` **for that, with Angular elements, we can use the browser itself by simply injecting some HTML:**

### Reason 4: Upgrading from AngularJS to Angular

Using the `@angular/upgrade` package you can mix and match AngularJS and Angular components and services, but that’s only one of the challenges we face when upgrading apps.

**Say you bundle your AngularJS app using RequireJS and your angular code using Webpack? The resulting formats are different, the lazy loading mechanisms are different. How do you marry the two? How do you make sure there are no race conditions when lazy loading code? What about zone.js? It’s hard.**

**An upgrade strategy built around Angular elements doesn’t suffer from any of these issues. You could bundle Angular Elements into UMD bundles and load them using RequireJS.**

In our experience, using elements is a viable approach that works well for the situations where the complexity of mixing and matching components is overshadowed by the complexity of marrying the two tech stacks.

Many teams at Google are also using this approach to upgrade their AngularJS apps. The Angular team has privately endorsed upgrading as a valid use case for Angular Elements.

### Reason 5: Independent Deployment

If your organization wants to develop and publish parts of an application independently, elements are a great way to achieve that.

## It’s Nuanced…

### Bundling Together or Separately

There are three main ways to build Angular elements.

- You can build them as part of you Angular app. In this case they will be loaded with the rest of the application.
- You can build every element (or group of elements) separately. This approach is conceptually simple but may result in your bundles containing duplicate code, both first and third party. Making sure the Angular framework itself doesn’t get duplicated isn’t very difficult, but providing the same guarantee for first-party code is a lot harder.
- You can register every element as a separate entry in the webpack config and build them together. As a result, you will get separate bundles (as in Approach 2) with no code duplication (as in Approach 1). Unfortunately, the default Angular CLI builder doesn’t support this use case, so you will have to extend it.

### Tree-shaking and Dynamic Binding

The browser doesn’t know what Angular elements are used and what aren’t, which hinders webpack’s ability to remove unused code. This is usually not a problem for first-party custom elements — you will use all of them. But it’s something to watch out for when using third-party elements.

### Elements Communicating

The beauty of using Angular elements instead of, say, Polymer is that all the elements on the page can be part of the same dependency injector tree. **This means that even though they are instantiated by the browser, all the elements on the page will effectively form a single Angular application. They can communicate with each other, share the router, using the same NgRx store.** No workarounds are required.

## Is It Stable?

### It’s Stable and Used at Google

Angular Elements is no longer an Angular labs project. It’s stable and can be used without fear. The elements package follow the same process of deprecating APIs — so you will have at least a year to patch your projects if any changes are needed.

### Additional APIs are Coming to Make it Better

The Ivy renderer, which should become available soon, benefits custom elements in two ways. First, it will make elements a lot smaller, which is great for the CMS/public site scenario. Second, it will make Angular compilation more flexible, which would make the API of creating an Angular element a lot simpler to use. Stay tuned — The unofficial plan is that Ivy renderer will become the default renderer in a minor release of Angular 7!

![](/blog/images/2018-11-05/1*3KcN8XEiOGRurVItKG2Eiw.avif)

### Victor Savkin is a co-founder of Nx. We help companies develop like Google since 2016.

![](/blog/images/2018-11-05/0*4HpWdaQEPIQr1EDw.avif)

_If you liked this, follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
