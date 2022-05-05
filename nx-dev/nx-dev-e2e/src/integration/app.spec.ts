describe('nx-dev', () => {
  beforeEach(() => cy.visit('/'));

  it('should display the primary heading', () => {
    cy.get('[data-cy="primary-heading"]').should(
      'contain',
      'Smart, Fast and Extensible Build System'
    );
  });
});
