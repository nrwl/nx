{% callout type="caution" title="Can I use component testing?" %}
React component testing with Nx requires **Cypress version 10** and up.

You can migrate with to v11 via the [migrate-to-cypress-11 generator](/nx-api/cypress/generators/migrate-to-cypress-11).

This generator is for Cypress based component testing.

If you're wanting to create Storybook stories for a component, then check out the [stories generator docs](/nx-api/react/generators/stories)

{% /callout %}

This generator is used to create a Cypress component test file for a given React component.

```shell
nx g @nx/react:component-test --project=my-cool-react-project --componentPath=src/my-fancy-button.tsx
```

Test file are generated with the `.cy.` suffix. this is to prevent colliding with any existing `.spec.` files contained in the project.

It's currently expected the generated `.cy.` file will live side by side with the component. It is also assumed the project is already setup for component testing. If it isn't, then you can run the [cypress-component-project generator](/nx-api/react/generators/cypress-component-configuration) to set up the project for component testing.
