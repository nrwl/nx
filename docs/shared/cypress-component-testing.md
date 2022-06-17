# Cypress Component Testing

> Component testing is in a early preview and requires Cypress v10 and above.
> See our [guide for more information](/cypress/cypress-v10-migration) to migrate to Cypress v10.

Unlike [E2E testing](/packages/cypress), component testing does not create a new project. Instead, Cypress component testing is added
directly to a project.

```bash
nx g @nrwl/react:cypress-component-configuration --project=your-react-lib
```

You can optionally pass in `--generate-tests` to create component tests for all components within the library.

## Testing Projects

Run `nx component-test your-lib` to execute the component tests with Cypress.

By default, Cypress will run in headless mode. You will have the result of all the tests and errors (if any) in your
terminal. Screenshots and videos will be accessible in `dist/libs/your-lib/screenshots` and `dist/libs/your-lib/videos`.

## Watching for Changes (Headed Mode)

With, `nx component-test your-lib --watch` Cypress will start in headed mode. Where you can see your component being tested.

Running Cypress with `--watch` is a great way to iterate on your components since cypress will rerun your tests as you make those changes validating the new behavior.

## More Information

You can read more on component testing in the [Cypress documentation](https://docs.cypress.io/guides/component-testing/writing-your-first-component-test).
