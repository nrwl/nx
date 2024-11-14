{% callout type="caution" title="Can I use component testing?" %}
Angular component testing with Nx requires **Cypress version 10.7.0** and up.

You can migrate with to v11 via the [migrate-to-cypress-11 generator](/nx-api/cypress/generators/migrate-to-cypress-11).
{% /callout %}

This generator is used to create a Cypress component test file for a given Angular component.

```shell
nx g @nx/angular:component-test --project=my-cool-angular-project --componentName=CoolBtnComponent --componentDir=src/cool-btn --componentFileName=cool-btn.component
```

Test file are generated with the `.cy.ts` suffix. this is to prevent colliding with any existing `.spec.` files contained in the project.

It's currently expected the generated `.cy.ts` file will live side by side with the component. It is also assumed the project is already setup for component testing. If it isn't, then you can run the [cypress-component-project generator](/nx-api/angular/generators/cypress-component-configuration) to set up the project for component testing.
