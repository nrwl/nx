---
title: 'Component-First Architecture with Standalone Components and Nx'
slug: 'component-first-architecture-with-standalone-components-and-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-11-03/1*qD9Wz2o4WIbhKfw9VZvb6g.png'
tags: [nx, release]
---

When [Angular](https://angular.io/) 2 released its first pre-release versions, it had no concept of `NgModule`. We attached `Components` as `Directives` to Components that needed them.

But it all changed in Angular 2-rc.5. This version saw the introduction of `NgModules`. The additional metadata was required for the compiler and to help accurately create injection hierarchies for the dependency injection system. This completely changed how Angular apps were architectured and designed. It also added a level of complexity to building Angular apps and another concept new Angular developers had to learn and understand.. optional `NgModules` soon became the top feature request on the Angular repository.

## Introducing Standalone Components

In the past year, the Angular Team tackled this and the solution is Standalone Components. Released under the `Developer Preview` label during the last few iterations of Angular 14, they’ll be officially marked stable now in Angular 15.
