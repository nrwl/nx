---
title: 'Storybook Interaction Tests in Nx'
slug: 'storybook-interaction-tests-in-nx'
authors: ['Katerina Skroumpelou']
cover_image: '/blog/images/2023-08-03/1*NfJA7VBZvDwyyZHmV8qsiw.png'
tags: [nx, release]
---

In Nx 16.6 we are introducing our new generators for [Storybook interaction tests](https://storybook.js.org/docs/react/writing-tests/interaction-testing)! These new generators replace the default Cypress tests we used to generate along with a project’s Storybook configuration, particularly for those already using Storybook. The intention is that if a user chooses to use Storybook and generate Storybook configuration, to integrate in that experience Storybook Interaction testing, and skip generating Cypress tests, to keep everything in one place, in an integrated experience.

**Prefer a video walkthrough? We’ve got you covered**

## Understanding Storybook Interaction Tests

Interaction tests allow users to verify the functional aspects of UIs. This is done by supplying the initial state of a component, simulating user behavior such as clicks and form entries, and finally checking if the UI and component state update correctly​. Very much like e2e tests are doing.

In Storybook, this workflow occurs in your browser, which makes it easier to debug failures since you’re running tests in the same environment you develop components.

## How it works

You write a story to set up the component’s initial state, simulate user behavior using the [play function](https://storybook.js.org/docs/react/writing-stories/play-function), and then use the [test runner](https://storybook.js.org/docs/react/writing-tests/test-runner) to confirm that the component renders correctly and that your interaction tests with the play function pass​. [Storybook’s Test runner](https://storybook.js.org/docs/react/writing-tests/test-runner) is a standalone utility — powered by Jest and Playwright — that executes all of your interaction tests, and runs parallel to your Storybook.

## Setting Up Storybook Interaction Tests on Nx

You can read our detailed guide on how to set up Storybook interaction tests on Nx, here: [https://nx.dev/packages/storybook/documents/storybook-interaction-tests](https://nx.dev/packages/storybook/documents/storybook-interaction-tests).

## Writing Interaction Tests in Storybook

An interaction test is defined inside a play function connected to a story. The story simulates the user’s behavior once it loads in the UI and verifies the underlying logic​.

Under the hood, Storybook’s [@storybook/addon-interactions](https://storybook.js.org/addons/@storybook/addon-interactions) mirrors [Testing Library](https://testing-library.com/)’s user-events API. So, you can use the same queries and assertions that you would use for Testing Library, like we already do with our unit tests.

For complex flows, it can be worthwhile to group sets of related interactions using the step function. This allows you to provide a custom label that describes a set of interactions.

## Debugging and Reproducing Errors

Storybook provides an interactive debugger that displays the step-by-step flow of your interactions, and provides UI controls to pause, resume, rewind, and step through each interaction​.

![[object HTMLElement]](/blog/images/2023-08-03/0*ZhrFxCwtYkO3gLaU.avif)
_Interaction test for the click of a button._

If an error occurs during a story’s play function, it’ll be shown in the interaction addon panel to help with debugging. And since Storybook is a web app, anyone with the URL can reproduce the error with the same detailed information without any additional environment configuration or tooling required​.

## Executing and Automating Tests

Storybook only runs the interaction test when you’re viewing a story. Therefore, as a Storybook grows, it becomes unrealistic to review each change manually. The Storybook test-runner automates the process by running all tests for you. This can be executed via the command line or on CI environment​.

## What should I choose? Interaction tests or E2E tests?

Setting up interaction tests with Nx and Storybook provides an extra layer of confidence in the functionality of your components. It ensures that they not only look right but also behave correctly in response to user interactions.

Storybook interaction tests provide a unique advantage over traditional e2e tests, especially when considering the development setup. With Storybook already in place, you essentially have a controlled environment set up for each of your components. This allows you to write interaction tests almost immediately, without the overhead of setting up and navigating through a full application environment, as is the case with e2e tests.

Moreover, since Storybook isolates each component, you can ensure that the tests are solely focused on individual component behavior rather than application-level concerns. This results in faster test execution, easier debugging, and more granular feedback during the development process. In essence, with Storybook’s interaction tests, you get many of the benefits of e2e tests but with a setup that’s quicker, more focused, and integrated right into your component development workflow.

## Screenshare

> > > GO GET VIDEO FROM https://blog.nrwl.io/storybook-interaction-tests-in-nx-135fdaabc944

## Useful Links

- [https://storybook.js.org/docs/react/writing-tests/interaction-testing](https://storybook.js.org/docs/react/writing-tests/interaction-testing)
- [https://nx.dev/packages/storybook/documents/storybook-interaction-tests](https://nx.dev/packages/storybook/documents/storybook-interaction-tests)

## Learn more

\- 🧠 [Nx Docs](https://nx.dev/)  
\- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)  
\- 💬 [Nx Community Slack](https://go.nrwl.io/join-slack)  
\- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)  
\- 🚀 [Speed up your CI](https://nx.app/)

Also, if you liked this, click the 👏and make sure to follow [Katerina](https://twitter.com/psybercity) and [Nx](https://twitter.com/nxdevtools) on Twitter for more!
