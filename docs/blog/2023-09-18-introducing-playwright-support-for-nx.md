---
title: 'Introducing Playwright Support for Nx'
slug: 'introducing-playwright-support-for-nx'
authors: ['Emily Xiong']
cover_image: '/blog/images/2023-09-18/1*_589bVpPTJ4D4IACBePXWQ.png'
tags: [nx, release, tutorial]
---

We are very excited to announce our support for Playwright with our new plugin `@nx/playwright`.

This blog will show you:

- What is Playwright
- How to create a new Nx workspace with Playwright support
- How to add Playwright to an existing Nx workspace

{% youtube src="https://youtu.be/k1U3PuBrZFQ?si=AVyXfyMJz4q6OJ70" /%}

## What is Playwright?

Before we start, let’s answer this question: what is Playwright and why should we use it?

From [playwright.dev](https://playwright.dev/), it says: “Playwright is end-to-end testing for modern web apps”. It sounds good, what does it do for us developers? What developer experience does it provide?

### Multiple Browsers

It is easy to run e2e test suites across multiple browsers. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. It also supports branded browsers and mobile viewports. For example, we can simply add the below code to the playwright configuration file to run the same test across these browsers:

```
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    /* Test against desktop browsers */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    /* Test against branded browsers. */
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' }, // or 'chrome-beta'
    },
  ],
});
```

### Auto Waiting

Playwright automatically waits for the relevant checks to pass, then performs the request action. What does it mean? For example, let’s say we have a sign-up form where:

- while the app checks that the user name is unique, the submit button is disabled.
- after checking with the server, the submit button becomes enabled.

How do we write tests in the Playwright? Playwright performs a range of actionability checks on the elements before making actions to ensure these actions behave as expected. So we don’t need to wait for the button to be enabled. Playwright will check it. We can simply write:

```
await page.getByTestId('submit-button').click();
```

### HTML Test Report

Playwright creates a nice HTML test report that allows filtering tests by browsers, passed tests, failed tests, skipped tests, and flaky tests.

![](/blog/images/2023-09-18/1*28KM1laCSbq9OwLYFaq8BQ.avif)
_HTML Test Report_

Clicking on the individual test shows more detailed errors along with each step of the test:

![](/blog/images/2023-09-18/1*slGx_vh9CQAD3er6XaNsjw.avif)
_Test error_

It also has other features like recording [screenshots](https://playwright.dev/docs/screenshots) and [videos](https://playwright.dev/docs/videos), [test generation](https://playwright.dev/docs/codegen), and [visual comparisons](https://playwright.dev/docs/test-snapshots). Read more about Playwright at [https://playwright.dev](https://playwright.dev/)

Next, let’s write and run some Playwright tests.

## Create a new Nx Workspace with Playwright

In this example, we will create a React app using Playwright as its end-to-end testing framework. In the terminal, run the below command:

```shell
npx create-nx-workspace

✔ Where would you like to create your workspace? · nx-react-playwright
✔ Which stack do you want to use? · react
✔ What framework would you like to use? · none
✔ Integrated monorepo, or standalone project? · standalone
✔ Which bundler would you like to use? · vite
✔ Test runner to use for end to end (E2E) tests · playwright
✔ Default stylesheet format · css
✔ Enable distributed caching to make your CI faster · No
```

We get a standalone Nx React app named `nx-react-playwright`:

![](/blog/images/2023-09-18/1*-czlvgB1lLaIHb9uuRj9Ig.avif)
_nx repo created_

What is a [standalone application](/concepts/integrated-vs-package-based#standalone-applications)? It is like an integrated monorepo setup but with just a single, root-level application. The repo has the same file structure as an app created from Create-React-App, but we can still leverage all the generators and executors and structure your application into libraries or submodules.

### Run E2E

The default e2e test is located in `e2e/src/example.spec.ts`:

```
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  // Expect h1 to contain a substring.
  expect(await page.locator('h1').innerText()).toContain('Welcome');
});
```

The test verifies the `h1` header contains the text `Welcome`:

![](/blog/images/2023-09-18/1*ehJZTRfHfFF6hmSh3eJ-qA.avif)
_Page served up_

To run the e2e tests, run the below command:

```shell
npx nx e2e e2e
```

In the terminal, it shows the following log:

```shell
nx run nx-react-playwright:serve:development
  ➜  Local:   http://localhost:4200/
  3 passed (11.8s)
To open last HTML report run:

  npx playwright show-report dist/.playwright/e2e/playwright-report
```

So the test passed and it also generated a report at `dist/.playwright/e2e/playwright-report/index.html`:

![](/blog/images/2023-09-18/1*xWKkHUozvDtk0Q9ihjDZbw.avif)

### Add Another Test

Let's add another test to check the Documentation button works:

![](/blog/images/2023-09-18/1*yTeWAR-3vE6Vdb6Cc6C5RA.avif)
_Documentation_

In `src/app/nx-welcome.tsx`, we need to add a test id to the link:

```
<a
  href="/getting-started/intro?utm_source=nx-project"
  target="_blank"
  rel="noreferrer"
  className="list-item-link"
  data-testid="documentation-link"
>
```

Then in `e2e/src/example.spec.ts`, the test file will become:

```
import { test, expect } from '@playwright/test';

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto('/');
  });

  test('has title', async ({ page }) => {
    // Expect h1 to contain a substring.
    expect(await page.locator('h1').innerText()).toContain('Welcome');
  });

  test('should go to documentation site', async ({ page, context }) => {
    await page.getByTestId('documentation-link').click();
    // Opening a new tab and waiting for the page to render
    const pagePromise = context.waitForEvent('page');
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    expect(await newPage.title()).toContain('Intro to Nx');
  });
});
```

Now run `npx nx e2e e2e`, the test would still pass:

```shell
nx run nx-react-playwright:serve:development
  ➜  Local:   http://localhost:4200/
  6 passed (3.1s)
To open last HTML report run:

  npx playwright show-report dist/.playwright/e2e/playwright-report
```

Now we have created a new Nx workspace with Playwright. However, if you already have an Nx repo, how do you add Playwright E2E configuration to an existing app?

## How to add Playwright to an existing Nx workspace

For this example, I am going to add Playwright e2e tests to this repo: [nrwl/nx-examples](https://github.com/nrwl/nx-examples)

We are going to focus on the cart app in this example. In the terminal, run `npx nx serve cart` and it should serve up the app at [http://localhost:4200/cart](http://localhost:4200/cart).

![](/blog/images/2023-09-18/1*F8KLtNUJvKtsZtUSU13vgQ.avif)
_Cart App_

### Install @nx/playwright

To install, run:

```shell
#npm
npm install @nx/playwright --save-dev

#yarn
yarn add @nx/playwright --dev

#pnpm
pnpm i -D @nx/playwright
```

### Apply Playwright Configuration

There are 2 ways to apply the E2E Playwright configuration.

1.  **Apply directly on the cart app**

We can set up Playwright directly on the cart app:

```shell
npx nx generate @nx/playwright:configuration --project=cart ---webServerCommand="npx nx serve cart"  --webServerAddress="http://localhost:4200"
```

It adds:

- an e2e target in `apps/cart/project.json`
- an e2e folder at `apps/cart/e2e` containing e2e tests
- `playwright.config.ts` containing Playwright configuration

![](/blog/images/2023-09-18/1*IEwONcILNaIYHmjTyhF3Bw.avif)
_new cart folder_

Let's update the default test `apps/cart/e2e/example.spec.ts` to check whether the header exists:

```
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/cart');

  await expect(page.locator('nx-example-header')).toBeVisible()
});
```

Now we can run `npx nx e2e cart` and it should pass.

**2\. Add a separate E2E Project**

The second way is to create a separate E2E project folder and apply configuration there.

Create a folder e2e at the workspace root and a project.json file inside it:

![](/blog/images/2023-09-18/1*nF2bZhQb1CZ4Kc8btsxzRw.avif)

Add name in `e2e/project.json`:

```json
{
  "name": "e2e"
}
```

Now apply the Playwright configuration to the e2e project:

```shell
npx nx generate @nx/playwright:configuration --project=e2e ---webServerCommand="npx nx serve cart"  --webServerAddress="http://localhost:4200"
```

Now I created an e2e folder at the workspace root:

![](/blog/images/2023-09-18/1*nZXrAKzg4krYx6fouDefpw.avif)
_e2e folder_

Now we can run `npx nx e2e e2e` to run the Playwright e2e tests.

## Summary

In this blog, we have:

- Created a new Nx react repo with Playwright
- Written our own Playwright tests
- Used Nx to run Playwright tests
- Set up a Playwright configuration for an existing Nx app

Hopefully, this gives you good insight into how to get started with Playwright. The Playwright configuration in this example is pretty simple, to learn more about `@nx/playwright` plugin, check out the Nx documentation: [/nx-api/playwright](/nx-api/playwright).

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🚀 [Speed up your CI](/nx-cloud)
