import { uniq } from '@nx/e2e/utils';

describe('nx-dev: Recipes pages', () => {
  it('should list related recipes based on tags', () => {
    const { map, uniq } = Cypress._;

    cy.visit('/recipes/deployment/deno-deploy');

    // All text content has to be different
    cy.get('[data-document="related"] > article > ul > li').should(($list) => {
      const values = map($list, 'innerText');
      const distinct = uniq(values);
      expect(distinct, 'all strings are different').to.have.length(
        values.length
      );
    });
  });
});
