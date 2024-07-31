---
title: 'Generating Standalone Component-based Angular Applications and Libraries with Nx'
slug: 'generating-standalone-component-based-angular-applications-and-libraries-with-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-09-30/1*h0pmKq38FJKyUSIZp14OCA.png'
tags: [nx, release]
---

[Angular](https://angular.io/) recently released [Standalone Components](https://angular.io/guide/standalone-components) in an effort to address one of their highest voted community issues; to make `NgModule` optional.  
This was of course met with great excitement from the community, and it offers a much simpler approach to the development of Angular applications.

> Prefer a video version? We’ve got you covered! Check out our video on this:

Originally with Angular, we would bootstrap an `AppModule` that declared an `AppComponent` and this would be seen to be the root of our application. This was achieved by calling the `bootstrapModule` function in the `src/main.ts` file. However, as the goal was to make `NgModule` optional, Angular needed to create a method of bootstrapping a Standalone Component. Therefore, they created the `bootstrapApplication` function that allows for a Standalone Component to be bootstrapped, as well as allowing top-level providers such as Routing to be initialized from the `src/main.ts` file.
