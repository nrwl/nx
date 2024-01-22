This is a framework-agnostic generator for adding component testing to a project.

```bash
nx g cypress-component-configuration --project=my-cool-project
```

Running this generator, adds the required files to the specified project without any configurations for Cypress. It's best to use the framework specific generator, instead `cypress-component-configuration` directly

- [React component testing](/packages/react/generators/cypress-component-configuration)
- [Angular component testing](/packages/angular/generators/cypress-component-configuration)

A new `component-test` target will be added to the specified project.

```bash
nx g component-test my-cool-project
```

Read more about [Cypress Component Testing](/cypress/cypress-component-testing)
