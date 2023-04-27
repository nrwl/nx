{% callout type="caution" title="Can I use component testing?" %}
Angular component testing with Nx requires **Cypress version 10.7.0** and up.

You can migrate with to v10 via the [migrate-to-cypress-10 generator](/packages/cypress/generators/migrate-to-cypress-10).

This generator is for Cypress based component testing.

If you're wanting to create Cypress tests for a Storybook story, then check out the [component-cypress-spec generator docs](/packages/angular/generators/component-cypress-spec)

If you're wanting to create Storybook stories for a component, then check out the [stories generator docs](/packages/angular/generators/stories) or [component-story generator docs](/packages/angular/generators/component-cypress-spec)
{% /callout %}

This generator is used to create a Cypress component test file for a given Angular component.

```shell
nx g @nx/angular:component-test --project=my-cool-angular-project --componentName=CoolBtnComponent --componentDir=src/cool-btn --componentFileName=cool-btn.component
```

Test file are generated with the `.cy.ts` suffix. this is to prevent colliding with any existing `.spec.` files contained in the project.

It's currently expected the generated `.cy.ts` file will live side by side with the component. It is also assumed the project is already setup for component testing. If it isn't, then you can run the [cypress-component-project generator](/packages/angular/generators/cypress-component-configuration) to set up the project for component testing.
