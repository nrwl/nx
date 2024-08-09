---
title: 'Building Angular and React Applications Together With Nx'
slug: 'building-angular-and-react-applications-together-with-nx'
authors: ['Victor Savkin']
cover_image: '/blog/images/2019-03-13/1*9kX7IkPrZfkrm7nrh59hQA.png'
tags: [nx, release]
---

This blog post is the first about **how Nx works with React**. You can also read a more detailed blog post by Jack Hsu here: “[**Powering up React Development with Nx**](https://medium.com/powering-up-react-development-with-nx-cf0a9385dbec)**.**”

Large companies often use multiple frontend frameworks to build their products. One product can be built with Angular, another one with React. These products, even though are built by different teams using different stacks, often share components and utilities.

Setting this up traditionally is challenging. Companies put a lot of effort in making sure teams can collaborate and use each other’s work. Nx drastically simplifies this.

**To show how Nx does it, let’s build two applications (one in Angular, and one in React) that will use a library of shared web components.**

## What is Nx

Nx is a set of extensible dev tools for monorepos. With Nx, you can:

- Use modern tools like Cypress and Jest
- Build full-stack applications and share code between the backend and the frontend
- Use effective development practices pioneered at Google

Let’s see how we can use Nx to facilitate developing with multiple frameworks.

## Creating a New Nx Workspace

Let’s start by creating a new Nx workspace. The easiest way to do this is to use npx.

```shell
npx --ignore-existing create-nx-workspace happynrwl --preset=empty
```

## Creating an Angular Application

An empty workspace has no application or libraries: nothing to run and nothing to test. Let’s add an Angular application into it by running `ng g app angularapp --framework=angular.`

The result should look like this:

![](/blog/images/2019-03-13/1*kURAPaChnRyzyVHwMKKoiA.avif)

Everything should look familiar to anyone who have used the Angular CLI. The only difference is that Nx uses Jest and Cypress by default, but we can use Karma and Protractor if we want to.

The generated `main.ts`, will look as follows:

And the template of the generated component will look as follows:

## Creating a React Application

Generating a React application is just as easy.

`ng g app reactapp --framework=react` and this is what we will see:

![](/blog/images/2019-03-13/1*DDJeYaSAmPm3-reMO3mflA.avif)

Where `main.ts` looks like this:

and `app.tsx` contains the following component:

**Nx has first-class React support, so all the commands we use to develop Angular applications work for React as well:**

- `ng serve reactapp` serves the React app
- `ng build reactapp` builds the React app
- `ng test reactapp` tests the React app using Jest
- ng `e2e reactapp-e2e` tests the React app using Cypress

TypeScript support, Jest, Cypress, source maps, watch mode — all work with React out of the box. If we `run ng serve reactapp`, we will see the following:

![](/blog/images/2019-03-13/1*SzQ77cmus-xD2hROI72zTg.avif)

## Creating Shared Components

Nx makes sharing code between applications easy. What used to take days or even weeks, with Nx takes minutes. **Say we want to create a ui library of shared components that we will use in both the React and Angular applications.**

`ng g lib ui --framework=none` and this is what we will see:

![](/blog/images/2019-03-13/1*rgbbGtPTq3glL0mRT43Xrg.avif)

Let’s create greeting.element.ts in the lib folder:

and reexport it in the `index.ts` file:

The updated library should look like this

![](/blog/images/2019-03-13/1*lRA2X0trOJ3dd3sCdqnwmQ.avif)

## Using the Greeting Element in our Angular App

### Setting Target to ES2015

To use the `Greeting` component in the Angular app, let’s start with changing the output target to es2015 in `tsconfig.json` because Custom Elements requires ES2015 Classes.

If we need to support older browsers, we can include the required polyfill instead.

### Importing the Library

Next, let’s include the new library.

### Registering CUSTOM_ELEMENTS_SCHEMA

Next, let’s register the `CUSTOM_ELEMENTS_SCHEMA` schema, which will tell the Angular compiler not to error when seeing non-standard element tags in components’ templates.

### Using the Greeting Element

Finally, we can update app.component.html to use our shared web component.

## Using the Greeting Element in our React App

Using Greeting in the react app requires similar steps.

### Setting Target to ES2015

Let’s change the target to es2015.

### Importing Library

Next, let’s include the new library in `main.tsx`.

### Adding Intrinsic Types

Instead of registering `CUSTOM_ELEMENTS_SCHEMA`, let’s add intrinsic.d.ts file, which serves a similar purpose to `CUSTOM_ELEMENTS_SCHEMA`, next to `main.tsx`.

### Using the Greeting Element

Finally, we can update `app.tsx` to use our shared web component.

## Nx Intelligence

What we have shown is already quite remarkable. **We built two applications with two different frameworks using a shared library of web components. We can use same commands to serve, build, test the applications.**

But Nx can do a lot more than that.

If we run `yarn dep-graph`, we will see the following:

![](/blog/images/2019-03-13/1*VwWw_l_elhGfhyLc-bR6ZQ.avif)

Nx understands how our applications and libraries depend on each other. This is extremely important! To really improve the collaboration between teams and make sure that they can use each other’s work, the following two things **must** be true:

- If the Angular team makes a change to the Angular app itself. Only the Angular app has to be rebuilt and retested. The same is true for the React team. Any tool that requires us to rebuild and retest everything on every PR will not scale beyond a small repository.
- If any of the teams changes the ui library, both the Angular and the React applications should be rebuilt and retested before the PR gets merged into master. This is the only way to guarantee that the PR is safe to merge.

To see how Nx helps with this, let’s commit the changes we have made so far.

```
git add .
git commit -am "great commit"
```

Next, let’s create a new branch `git checkout -b angularchange`. In this branch, let’s introduce any change to `app.component.html` and run `yarn affected:dep-graph --base=master`.

![](/blog/images/2019-03-13/1*HSFp-L1so19v8O3wFel8sg.avif)

As you can see, Nx knows that this change only affects the angularapp and nothing else. Nx can use this information to rebuild and retest only the angularapp:

```shell
yarn affected:test --base=master # only tests angularapp
yarn affected:build --base=master # only builds angularapp
```

Now, let’s introduce a change to `greeting.element.ts` and run `yarn affected:dep-graph --base=master`.

![](/blog/images/2019-03-13/1*1-xW6mi8D-DcVhYU-Qgvlg.avif)

Both angularapp and reactapp are affected by this change because they both depend on the greeting component.

```shell
yarn affected:test --base=master # tests ui, angularapp, reactapp
yarn affected:build --base=master # only builds angularapp, reactapp
```

This is what we got:

- If we only touch our code, we only have to retest and rebuild our code.
- If we touch something that affects other folks, we’ll have to rebuild and retest their applications as well.

Because this is a simple example, the impact is easily deducible. But a real workspace can have a dozen applications and hundred of libraries. Ad-hoc solutions do not work at such scale — we need tools like Nx, that can help us manage those workspaces.

## Bonus: Using Angular Elements for Building Shared Components

Angular has always been a great framework for building applications, but traditionally it was not easy to use small bits of Angular on the page. Angular Elements changed that. With Angular Elements we can package our Angular code into a collection of web components that we can then use in our Angular, React, or AngularJS applications.

Let’s change the example above to do that.

Start with rewriting the Greeting component in Angular:

We then need to create `UiModule` and register the component in:

After a few changes in `angular.json`, we can run `ng serve reactapp` to see a React application containing a web component implemented with Angular!

![](/blog/images/2019-03-13/1*SzQ77cmus-xD2hROI72zTg.avif)

### Ivy

The current version of Angular already makes this scenario a great option for many organization, but Ivy (the new Angular renderer) will make it more practical and truly a fantastic option for everyone.

You can see the whole example using Angular Elements [here](https://github.com/nrwl/nx-angular-and-react/tree/angular-elements).

## Summary

**With Nx, we can build multiple applications using different frontend frameworks in the same workspace. These applications can share components, services, utilities.**

In this example we looked at a library of web components that we used in Angular and React applications. But we could go further: we could build the shared component using Angular Elements and then use it in the React application. **Nx also allows us to build the backend next to our frontend and share code between them.**

**Nx analyses the code base to figure out how libraries and applications depend on each other. This analysis happens across frameworks and across client-server boundaries.**

## Learn More

- Learn more about Nx at [nx.dev](https://nx.dev)
- You can find the example application [here](https://github.com/nrwl/nx-angular-and-react).
- Learn how to build full-stack applications using Angular and NestJS [here](https://medium.com/robust-backends-with-nx-7-3-and-nestjs-8fe1611375e6).
- [Check out Angular Console VS Code plugin](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console)—UI for the Angular CLI — that works well for Nx and supports both Angular and React.

### Victor Savkin is a co-founder of Nrwl. We help companies develop like Google, Facebook, and Microsoft since 2016. We provide consulting, engineering and tools.

![](/blog/images/2019-03-13/0*w_6huKCzIoB9lW5v.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
