---
title: 'Using NgRx Standalone APIs with Nx'
slug: 'using-ngrx-standalone-apis-with-nx'
authors: ['Colum Ferry']
cover_image: '/blog/images/2023-02-21/1*pJHhA04d6jIjOb5vpCDjyw.png'
tags: [nx, release]
---

Version 15 of [NgRx](https://ngrx.io/) introduced Standalone APIs to the package, enabling usage of the NgRx with Standalone Component-based [Angular](https://angular.io/) applications. This allows for a simpler integration of NgRx to your application.

[Nx](https://nx.dev/) has added support for using these Standalone APIs from NgRx when generating NgRx stores with our `@nrwl/angular:ngrx` generator when you give it a path to a `Routes` definition file. _(Usually denoted by_ `_*.routes.ts_`_)_

In this article, we’ll walk through using Nx to create a new Standalone Component-based Angular application and add NgRx to it, using _ONLY_ Nx Generators!

**Prefer a video version? We’ve got you covered!**

## Create a new Nx Workspace

`npx create-nx-workspace myorg`

Select:

- Standalone Angular app
- Yes to using Standalone Components
- Yes to add routing
- Any option for the stylesheet format
- Yes to Nx Cloud
