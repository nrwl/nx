describe('release serve-mode app', () => {
  beforeEach(() => {
    cy.intercept('/assets/project-graphs/*').as('getGraph');

    cy.visit('/');

    // wait for first graph to finish loading
    cy.wait('@getGraph');
  });

  it('should not display experimental features', () => {
    cy.get('experimental-features').should('not.exist');
  });

  it('should not display the debugger', () => {
    cy.get('debugger-panel').should('not.exist');
  });
});
