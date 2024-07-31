---
title: 'Modern Angular Tooling for the New Year'
slug: 'modern-angular-tooling-for-the-new-year'
authors: ['Colum Ferry']
cover_image: '/blog/images/2021-11-23/1*hFhTG4Ap4bGftUkSOKIXIw.png'
tags: [nx, release]
---

## What is Modern Angular Tooling?

With the Angular CLI no longer including a complete out-of-the-box development solution, it is more important than ever to understand the tools at our disposal to improve the developer experience when building Angular applications.

Modern Angular Tooling is the term used to describe modern tools that will enable you and your team to build a comprehensive development environment. This development environment takes advantage of the latest improvements in the JavaScript ecosystem to improve productivity, consistency, reliability, scalability and developer experience when building Angular applications and libraries.

## What are the Modern Angular Tools?

We consider Modern Tools to be additional tools that can and should be used when building Angular applications and Angular libraries. These tools tend to focus on a more architectural side of software development.

[**Cypress**](https://www.cypress.io/) **— E2E Testing**

The Angular CLI no longer includes an e2e solution when it generates an Angular application. That means no more Protractor out of the box with Angular applications. Therefore, this leaves a considerable gap in the out-of-the-box experience with Angular. Cypress has one of the best developer experiences and can be used for more than just testing Angular applications. It’s straightforward to write, run and debug tests with Cypress, and it supports cross-browser testing, supporting Chrome-family browsers (including Electron and Edge) and Firefox. There is also an open proposal to support [Safari](https://github.com/cypress-io/cypress/issues/6422).

[**Jest**](https://jestjs.io/) **— Unit Testing**

Jest is the best-in-class unit testing tool in the JavaScript ecosystem right now. The Angular CLI includes Karma when generating an application, another unit testing tool; however, Karma is noticeably much slower, reducing feedback cycle time.

Jest is much faster, runs without launching a browser and can use JSDom to allow for unit testing of component templates. It can also run in parallel, allowing for a much faster feedback cycle.

[**ESLint**](https://eslint.org/) **— Linting**

ESLint has become the defacto linting tool in the JavaScript world, even replacing TSLint in TypeScript projects. The Angular CLI included TSLint in the past for linting Angular applications, but when TSLint support ended in December 2020, the Angular CLI stopped including with TSLint. In fact, the Angular CLI no longer includes any linting tool out of the box.

ESLint is a pluggable linting tool used across the JavaScript ecosystem that allows you to quickly enforce best practices and even implement automatic fixing of problems within your workspace. It makes enforcing team-wide consistency easier and helps avoid common causes of bugs within JavaScript. And it’s fast!

[**Storybook**](https://storybook.js.org/) **— Component Design**

Frontend frameworks and libraries have converged to a single core design paradigm centred around components. Building these components in the context of your application is fine, but it can become cumbersome. It can lead to inconsistencies in design and a drop in productivity as you have to launch your application every time you want to check your changes while trying to match the design across multiple areas within your application.

Storybook aims to streamline the process of designing and developing components by allowing you to build components in isolation, increasing productivity as you no longer have to launch your application, as well as increasing consistency as it becomes your source of truth for component documentation. You can easily see all the components (with stories) in your workspace from the Storybook application. Storybook also supports addons that can help you test things like the Accessibility of your components (with the [A11y Addon](https://storybook.js.org/addons/@storybook/addon-a11y)).

[**Prettier**](https://prettier.io/) **— Formatting**

When working with multiple developers, consistent code style and formatting is key to rapid development. Time spent figuring out how to read code is time wasted actually reading code. Prettier is an automated, opinionated, formatting tool that removes human emotion from code styling while producing a consistent code style for all developers in the team. Prettier reduces the need for a style guide for your development, removes the question of code style from code reviews, and lets developers focus on writing code. All of this results in improving the team’s overall productivity and the readability of the codebase!

## Why should we care about it?

There are many reasons why we should strive to use Modern Tools with Angular. Many of these reasons were mentioned above in association with each of the tools that we would define as necessary for Modern Angular Development. When we combine them all into one development workspace, we get:

**Better productivity**

- Storybook can help build components without running your application.
- Developers spend less time formatting and more time writing code.

**Faster feedback (errors, tests, builds)**

- Faster testing tools leads to faster feedback on errors, tests and potential bugs that will have been introduced to the application.
- ESLint provides fast feedback on any code that breaks the rules and can even automatically fix that code for you.

**Better debugging**

- Using Modern Tools, it becomes much easier to find and squash bugs and defects.
- They’ve all been built to work with the JavaScript ecosystem, which already contains excellent debugging tools, such as the Debug features in [VSCode](https://code.visualstudio.com/) or the Chrome DevTools.

**Better guardrails for teams**

- This may seem contradictory. Why would you want to add restrictions to your team? There’s a [Power in putting Constraints](https://www.youtube.com/watch?v=X-Dn5ZBUZH0) on your team.
- It takes the guesswork out of what is allowed and what is not and helps them focus on writing code consistently.

**Consistency across teams**

- Maintaining consistency across all development teams working on the application is vital.
- It allows the company to easily onboard and offboard new developers and help to enable any developer to jump into any part of the codebase and understand the structure and patterns used to create the application, improving knowledge reuse.

**Comprehensive Testing**

- By writing both unit and e2e tests for our application, we create a comprehensive testing environment.
- This allows us to ensure that the happy paths through our application are guaranteed to work as we add more features and functionality to our applications.
- It also helps us improve our user experience by ensuring exception paths also provide our users with feedback to state that something has gone wrong.
- It helps provide confidence to developers making changes, ensuring that they haven’t introduced any regressions to the codebase.
- It helps bring junior developers up to speed as they can get a comprehensive overview of how the application is expected to function, and they can make changes knowing that they will be informed _(quickly)_ if they break something.

## How can Nx help?

Nx provides a complete and comprehensive development workspace for building applications. It supports Angular _(and other libraries and frameworks!)._ It seamlessly integrates all the Modern Tooling mentioned above, instantly improving your developer experience, your team’s productivity, and the scalability and reliability of your applications.  
You can get up and running with an Angular application containing the tools above (while still getting all the benefits of Angular) by running:

```shell
npx create-nx-workspace — preset=angular
```

If you prefer Yarn, you can use

```shell
yarn create nx-workspace — preset=angular
```

This command will create your workspace and integrate the tools above automatically. The only tool that will not be integrated automatically is Storybook. However, Nx makes it easy to integrate that too! After creating your workspace, all you need to do is run the following command at the root of your workspace:

```
npm run ng g @nrwl/angular:storybook-configuration
```

Or, using Yarn

```shell
yarn ng g @nrwl/angular:storybook-configuration
```

To read more about Nx and how it can help your development see our docs on [Angular](/nx-api/angular).
