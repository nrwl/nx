---
title: 'Essential Angular: Testing'
slug: 'essential-angular-testing'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-01-11/1*4vRt7euWTTHxX6FHxtheJA.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of_ [_nrwl.io_](https://goo.gl/v4nh0p)_, providing Angular consulting to enterprise teams. He was previously on the Angular core team at Google, and built the dependency injection, change detection, forms, and router modules._

One of the design goals of Angular is to make testing easy. That’s why the framework relies on dependency injection, separates the user code from the framework code, and comes with a set of tools for writing and running tests. In this article I will look at four ways to test Angular components: isolated tests, shallow tests, integration tests, and protractor tests.

## Read the Series

This is the sixth post in the Essential Angular series, which aims to be a short, but at the same time, fairly complete overview of the key aspects of Angular. Even though it’s not required, I recommend to read the first five posts in the series before starting on this one.

- [Essential Angular. Part 1: Compilation](https://medium.com/essential-angular-2-compilation-cfbebf9bb6e4#.y9s7pc41m)
- [Essential Angular. Part 2: NgModules](https://medium.com/essential-angular-ngmodules-16474ea99713#.5y73lcqde)
- [Essential Angular. Part 3: Components and Directives](https://medium.com/essential-angular-components-and-directives-ab65172ba60#.47zn86pdl)
- [Essential Angular. Part 4: Dependency Injection](https://medium.com/essential-angular-dependency-injection-a6b9dcca1761#.opd2cg9wk)
- [Essential Angular. Part 5: Change Detection](https://medium.com/essential-angular-change-detection-fe0e868dcc00#.isq09mg9b)

**You can also check out** [**the Essential Angular book**](https://gumroad.com/l/essential_angular)**, which has extra content not available on this blog.**

## Example App

Throughout this series I use the same application in the examples. This application is a list of tech talks that you can filter, watch, and rate.

![](/blog/images/2017-01-11/1*Vjih_NbJCX6bzORavaL8qg.avif)

You can find the source code of the application [here](https://github.com/vsavkin/essential-angular-book-app).

## Isolated Tests

It is often useful to test complex components without rendering them. To see how it can be done, let’s write a test for the following component:

filters.component.html:

There a few things in this example worth noting:

- We are using reactive forms in the template of this component. This require us to manually create a form object in the component class, which has a nice consequence: we can test input handling without rendering the template.
- We listen to all the form changes, debounce them using the RxJS debounceTime operator, and then emit a change event.
- Finally, we inject a function to create a filters object out of the form.

Now, let’s look at the test.

**As you can see, testing Angular components in isolation is no different from testing any other JavaScript object. We do not use any Angular UI-specific utilities.** We, however, use fakeAsync. This is a utility provided by zone.js and using it we can control time, which is handy for testing the debouncing. Also, this test does not exercise the template of this component. The template might as well be empty — the test will still pass.

## Shallow Testing

Testing component classes without rendering their templates works in certain scenarios, but not in all of them. **Sometimes we can write a meaningful test only if we render a component’s template. We can do that and still keep the test isolated. We just need to render the template without rendering the component’s children. This is what is colloquially known as shallow testing.**

Let’s see this approach in action.

This component simply renders a collection of TalkCmp.

Now let’s look at its test.

First, look at how we configured our testing module. We only declared TalksCmp, nothing else. This means that all the elements in the template will be treated as simple DOM nodes, and only common directives (e.g., ngIf and ngFor) will be applied. This is exactly what we want. Second, passing NO*ERRORS_SCHEMA tells the compiler not to error on unknown elements and attributes, which is what we need for shallow tests. The result will create a list of \_talk-cmp* DOM elements, which we inspected in the test. No instances of TalkCmp were created.

## Integration Testing

We can also write an integration test that will exercise the whole application.

Note here we are importing AppModule, which means that Angular will create all the registered provides and will compile all the registered components. The test itself is self explanatory.

**Even though both the shallow and integration tests render components, these tests are very different in nature.** In the shallow test we mock up every single dependency of a component, and we do not render any of the component’s children. The goal is to exercise one slice of the component tree in isolation. In the integration tests we mock up only platform dependencies (e.g, location), and we use production code for the rest. Shallow tests are isolated, and, as a result, can be used to drive the design of our components. Integration tests are only used to check the correctness.

## Protractor Tests

Finally, we can always write a protractor test exercising the whole application.

First, we created a page object, which is a good practice for making tests more domain-centric, so they talk more about user stories and not the DOM. Second, we wrote a protractor test verifying that filtering by title works.

Both protractor tests and integration tests (as defined above), solve the same problem — they verify correctness, i.e., they verify that a particular use case have been implemented. Which ones should we use? I tend to test most of the behavior using integration tests, and use protractor only for a few smoke tests, but it is highly dependent on the culture of the team.

## Let’s Recap

In this article we looked at four ways to test Angular components: isolated tests, shallow tests, integration tests, and protractor tests. Each of them have their time and place: isolated tests are a great way to test drive your components and test complex logic. Shallow tests are isolated tests on steroids, and they should be used when writing a meaningful test requires to render a component’s template. Finally, integration and protractor tests verify that a group of components and services (i.e., the application) work together.

## Essential Angular Book

This article is based on the Essential Angular book, which you can find here [https://leanpub.com/essential_angular](https://leanpub.com/essential_angular). If you enjoy the article, check out the book!

### Victor Savkin is a co-founder of [Nrwl](https://nrwl.io). We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-01-11/0*4HpWdaQEPIQr1EDw.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
