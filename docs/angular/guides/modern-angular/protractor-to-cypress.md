# Migrating from Protractor to Cypress

Nx helps configure your e2e tests for you. When running the Nx generator to create a new app, you can choose Protractor as an option, but the default is Cypress. If you have an existing set of e2e tests using Protractor and would like to switch to using Cypress, you can follow these steps.

Let's say your existing app is named _`my-awesome-app`_ and the e2e Protractor tests are located in _`my-awesome-app-e2e`_.

0. Before you start, make sure you have a clean git working tree (by committing or stashing any in progress changes)

1. Create a throw away app named _`delete-this-app`_ using `Cypress` for the e2e setting.

```bash
nx g @nrwl/angular:application --name=delete-this-app --e2eTestRunner=cypress
```

2. Rename _`apps/my-awesome-app-e2e/src`_ to _`apps/my-awesome-app-e2e/src-protractor`_.

```bash
mv apps/my-awesome-app-e2e/src apps/my-awesome-app-e2e/src-protractor
```

3. Move the contents of _`apps/delete-this-app-e2e`_ to `apps/my-awesome-app-e2e`.

```bash
mv apps/delete-this-app-e2e/* apps/my-awesome-app-e2e
```

4. In the _`angular.json`_ (or `workspace.json`) file copy the `e2e` target configuration for _`delete-this-app-e2e`_ and use that to replace the `e2e` target configuration for _`my-awesome-app-e2e`_. In the new configuration section, replace any instance of _`delete-this-app`_ with _`my-awesome-app`_.

5. Delete _`delete-this-app`_ and _`delete-this-app-e2e`_.

```bash
nx g rm delete-this-app-e2e
nx g rm delete-this-app
```

6. Edit `apps/my-awesome-app-e2e/cypress.json` and replace any instance of `delete-this-app` with `my-awesome-app`.

7. Delete `apps/my-awesome-app-e2e/protractor.conf.js`

```bash
rm apps/my-awesome-app-e2e/protractor.conf.js
```

8. The most arduous part of this migration is replacing all Protractor API instances with the Cypress API. For more specifics, please refer to the before and after examples below.

9. Run your Cypress tests with the same command that launched your Protractor tests.

```bash
nx e2e my-awesome-app-e2e
```

---

## How to Get DOM Elements

### Getting a single element on the page

When it comes to e2e tests, one of the most common things you'll need to do is get one or more HTML elements on a page. Rather than split element fetching into multiple methods that you need to memorize, everything in Cypress can be accomplished with _[**`cy.get`**](https://on.cypress.io/get)_ while using CSS selectors or the preferred [**data attribute**](https://on.cypress.io/selecting-elements).

**Before: Protractor**

```js
// Get an element
element(by.tagName('h1'))

// Get an element using a CSS selector.
element(by.css('.my-class'))

// Get an element with the given id.
element(by.id('my-id'))

// Get an element using an input name selector.
element(by.name('field-name'))

// Get an element by the text it contains within a certain CSS selector
element(by.cssContainingText('.my-class', 'text'))

// Get the first element containing a specific text (only for link elements)
element(by.linkText('text')
```

**After: Cypress**

```js
// Get an element
cy.get('h1');

// Get an element using a CSS selector.
cy.get('.my-class');

// Get an element with the given id.
cy.get('#my-id');

// Get an element using an input name selector.
cy.get('input[name="field-name"]');

// Get an element by the text it contains within a certain CSS selector
cy.get('.my-class').contains('text');

// Get the first element containing a specific text (available for any element)
cy.contains('text');

// Get an element by the preferred [data-cy] attribute
cy.get('[data-cy]="my-id"]');
```

> You can learn more about [**best practices for selecting DOM elements in the Cypress official documentation**](https://on.cypress.io/selecting-elements).

### Getting multiple elements on a page

With Protractor when you want to get access to more than one element on the page, you would need to chain the _*`.all()`*_ method. However, in Cypress, no syntax change is necessary!

**Before: Protractor**

```js
// Get all list-item elements on the page
element.all(by.tagName('li'));

// Get all elements by using a CSS selector.
element.all(by.css('.list-item'));

// Find an element using an input name selector.
element.all(by.name('field-name'));
```

**After: Cypress**

```js
// Get all list-item elements on the page
cy.get('li');

// Get all elements by using a CSS selector.
cy.get('.list-item');

// Find an element using an input name selector.
cy.get('input[name="field-name"]');
```

> You can learn more about **[**how to get DOM elements in the Cypress official documentation**](https://on.cypress.io/get)**.

## Assertions

Similar to Protractor, Cypress enables use of human readable assertions. Here are some common DOM element assertions with Cypress and equivalent assertions with Protractor.

### Length

**Before: Protractor**

```js
const list = element.all(by.css('li.selected'));

expect(list.count()).toBe(3);
```

**After: Cypress**

```js
// retry until we find 3 matching <li.selected>
cy.get('li.selected').should('have.length', 3);
```

### Class

**Before: Protractor**

```js
expect(
  element(by.tagName('form')).element(by.tagName('input')).getAttribute('class')
).not.toContain('disabled');
```

**After: Cypress**

```js
// retry until this input does not have class disabled
cy.get('form').find('input').should('not.have.class', 'disabled');
```

### Value

**Before: Protractor**

```js
expect(element(by.tagName('textarea'))).getAttribute('value')).toBe('foo bar baz')
```

**After: Cypress**

```js
// retry until this textarea has the correct value
cy.get('textarea').should('have.value', 'foo bar baz');
```

### Text Content

**Before: Protractor**

```js
// assert the element's text content is exactly the given text
expect(element(by.id('user-name')).getText()).toBe('Joe Smith');

// assert the element's text includes the given substring
expect(element(by.id('address')).getText()).toContain('Atlanta');

// assert the span does not contain 'click me'
const child = element(by.tagName('a')).getWebElement();
const parent = child.getDriver().findElement(by.css('span.help'));
expect(parent.getText()).not.toContain('click me');

// assert that the greeting starts with "Hello"
element(by.id('greeting').getText()).toMatch(/^Hello/);
```

**After: Cypress**

```js
// assert the element's text content is exactly the given text
cy.get('#user-name').should('have.text', 'Joe Smith');

// assert the element's text includes the given substring
cy.get('#address').should('include.text', 'Atlanta');

// retry until this span does not contain 'click me'
cy.get('a').parent('span.help').should('not.contain', 'click me');

// the element's text should start with "Hello"
cy.get('#greeting')
  .invoke('text')
  .should('match', /^Hello/);

// tip: use cy.contains to find element with its text
// matching the given regular expression
cy.contains('#a-greeting', /^Hello/);
```

### Visibility

**Before: Protractor**

```js
// assert button is visible
expect(element(by.tagName('button')).isDisplayed()).toBe(true);
```

**After: Cypress**

```js
// retry until this button is visible
cy.get('button').should('be.visible');
```

### Existence

**Before: Protractor**

```js
// assert the spinner no longer exists
expect(element(by.id('loading')).isPresent()).toBe(false);
```

**After: Cypress**

```js
// retry until loading spinner no longer exists
cy.get('#loading').should('not.exist');
```

### State

**Before: Protractor**

```js
expect(element('input[type="radio"]').isSelected()).toBeTruthy();
```

**After: Cypress**

```js
// retry until our radio is checked
cy.get(':radio').should('be.checked');
```

### CSS

**Before: Protractor**

```js
// assert .completed has css style "line-through" for "text-decoration" property
expect(element(by.css('.completed')).getCssValue('text-decoration')).toBe(
  'line-through'
);

// assert the accordion does not have a "display: none"
expect(element(by.id('accordion')).getCssValue('display')).not.toBe('none');
```

**After: Cypress**

```js
// retry until .completed has matching css
cy.get('.completed').should('have.css', 'text-decoration', 'line-through');

// retry while .accordion css has the "display: none" property
cy.get('#accordion').should('not.have.css', 'display', 'none');
```

### Disabled property

```html
<input type="text" id="example-input" disabled />
```

**Before: Protractor**

```js
// assert the input is disabled
expect(element(by.id('example-input')).isEnabled()).toBe(false);
```

**After: Cypress**

```js
cy.get('#example-input')
  .should('be.disabled')
  // let's enable this element from the test
  .invoke('prop', 'disabled', false);

cy.get('#example-input')
  // we can use "enabled" assertion
  .should('be.enabled')
  // or negate the "disabled" assertion
  .and('not.be.disabled');
```

Cypress has one additional feature that can make a critical difference in the reliability of your tests' assertions: **[**retry-ability**](https://on.cypress.io/retryability)**. When your test fails an assertion or command, Cypress will mimic a real user with build-in wait times and multiple attempts at asserting your tests in order to minimize the amount of false negatives / positives.

**Before: Protractor**

```js
describe('verify elements on a page', () => {
  it('verifies that a link is visible', () => {
    expect($('a.submit-link').isDisplayed()).toBe(true);
  });
});
```

**After: Cypress**

```js
describe('verify elements on a page', () => {
  it('verifies that a link is visible', () => {
    cy.get('a.submit-link').should('be.visible');
  });
});
```

In the example above, if the submit link does not appear on the page at the exact moment when Protractor runs the test (which can be due to any number of factors including API calls, slow browser rendering, etc.), your test will fail. However, Cypress factors these conditions into its assertions and will only fail if the time goes beyond a reasonable amount.

### Negative assertions

There are positive and negative assertions. Negative assertions have the "not" chainer prefixed to the assertion. Examples of negative assertions in both Protractor and Cypress:

**Before: Protractor**

```js
expect(
  element(by.css('.todo'))
    .getAttribute('class')
    .then((classes) => {
      return classes.split(' ').indexOf('completed') !== -1;
    })
).not.toBe(true);
expect(element(by.id('loading')).isDisplayed()).not.toBe(true);
```

**After: Cypress**

```js
cy.get('.todo').should('not.have.class', 'completed');
cy.get('#loading').should('not.be.visible');
```

> Learn more about how Cypress handles **[**assertions**](https://on.cypress.io/guides/making-assertions)**.

## Network Handling

### Network Spying

Protractor doesn't offer a built-in solution for network spying. With Cypress, you can leverage the **[**intercept API**](https://on.cypress.io/route2)** to spy on and manage the behavior of any network request. Cypress will automatically wait for any request to complete before continuing your test.

### Network Stubbing

Cypress's **[**intercept API**](https://on.cypress.io/route2)** also allows you to stub any network request for your app under test. You can use the **[**intercept API**](https://on.cypress.io/route2)** to make assertions based on different simulated responses for your network requests. You can also use the intercept API to stub a custom response for specific network requests.

> For more information, check out the **[**intercept API documentation**](https://on.cypress.io/route2)**.

## Navigating Websites

When you want to visit a page, you can do so with the following code:

**Before: Protractor**

```js
it('visits a page', () => {
  browser.get('/about');
  browser.navigate().forward();
  browser.navigate().back();
});
```

**After: Cypress**

```js
it('visits a page', () => {
  cy.visit('/about');
  cy.go('forward');
  cy.go('back');
});
```

> For more information, check out the Cypress **[**official documentation on navigation**](https://on.cypress.io/navigation)**!

## Automatic Retrying and Waiting

Web applications are almost never synchronous. With Protractor, you may be accustomed to adding arbitrary timeouts or using the **[**waitForAngular**](https://www.protractortest.org/#/api?view=ProtractorBrowser.prototype.waitForAngular)** API to wait for Angular to finish rendering before attempting to interact with an element. With Cypress, commands that query the DOM are **[**automatically retried**](https://on.cypress.io/retryability)**. Cypress will automatically wait and retry most commands until an element appears in the DOM. If an element is not **[**actionable**](https://on.cypress.io/interacting-with-elements)** within the _[**`defaultCommandTimeout`**](https://on.cypress.io/timeouts)_ setting, the command will fail. This enables you to write tests without the need for arbitrary timeouts, enabling you to write more predictable tests.

> For more information, check out the Cypress **[**official documentation on timeouts**](https://on.cypress.io/timeouts)**!

## Cypress vs WebDriver Control Flow

Cypress commands are similar to Protractor code at first glance. Cypress commands are **[**not invoked immediately**](https://on.cypress.io/commands-are-asyncronous)** and are enqueued to run serially at a later time. Cypress commands might look like promises, but the **[**Cypress API is not an exact implementation of Promises**](https://on.cypress.io/commands-are-not-promises)**. The modern web is asychronous, therefore you need to interact with modern web apps in an asynchronous fashion. This is why the Cypress API is asynchronous. This allows you to write deterministic tests since all of your commands are executed serially, enabling your tests to run predictably each time. In comparison, Protractor's WebDriverJS API is based on promises, which is managed by a control flow. This **[**Control Flow**](https://www.protractortest.org/#/control-flow)** enables you to write asynchronous Protractor tests in a synchronous style.

> For more information, check out the Cypress **[**official documentation on asyncronous**](https://on.cypress.io/commands-are-asyncronous)**!

## Using Page Objects

A common pattern when writing end-to-end tests, especially with Protractor, is **[**Page Objects**](https://github.com/SeleniumHQ/selenium/wiki/PageObjects)**. Page Objects can simplify your test code by creating reusable methods if you find yourself writing the same test code across multiple test cases. You can use the same Page Object pattern within your Cypress tests: Cypress also provides a **[**Custom Command**](https://on.cypress.io/api/commands)** API to enable you to add methods to the _*`cy`*_ global directly:

> For more information, check out the Cypress **[**official documentation on custom commands**](https://on.cypress.io/commands-are-not-promises)**!

## Continuous Integration

Cypress makes it easy to **[run your tests in all Continuous Integration environments](https://on.cypress.io/continuous-integration)**. Check out the Cypress in-depth guides to run your Cypress tests in **[GitHub Actions](https://on.cypress.io/setup-ci-github-actions)**, **[CircleCI](https://on.cypress.io/setup-ci-circleci)**, **[GitLab CI](https://on.cypress.io/setup-ci-gitlab)**, **[Bitbucket Pipeline](https://on.cypress.io/setup-ci-bitbucket-pipelines)**, or **[AWS CodeBuild](https://on.cypress.io/setup-ci-aws-codebuild)**.

Cypress also has code samples to get Cypress up and running in [many of the other popular CI environments](https://on.cypress.io/setup-ci). Even if your CI provider isn't listed, you can still run Cypress in your CI environment.

## Other Resources

- [Official Migration Guide from Cypress](https://docs.cypress.io/guides/migrating-to-cypress/protractor)
