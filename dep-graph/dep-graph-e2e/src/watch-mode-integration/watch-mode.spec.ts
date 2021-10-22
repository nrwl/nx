import { getProjectItems } from '../support/app.po';

describe('dep-graph-client in watch mode', () => {
  beforeEach(() => {
    cy.clock();
    cy.visit('/');
    cy.tick(1000);
  });

  it('should auto-select new libs as they are created', () => {
    const excludedValues = ['existing-app-1', 'existing-lib-1'];

    cy.tick(5000);
    checkSelectedProjects(3, excludedValues);

    cy.tick(5000);
    checkSelectedProjects(4, excludedValues);

    cy.tick(5000);
    checkSelectedProjects(5, excludedValues);
  });

  it('should retain selected projects new libs as they are created', () => {
    cy.contains('existing-app-1').siblings('button').click();
    cy.contains('existing-lib-1').siblings('button').click();

    cy.tick(5000);

    checkSelectedProjects(3, []);

    cy.tick(5000);
    checkSelectedProjects(4, []);

    cy.tick(5000);
    checkSelectedProjects(5, []);
  });

  it('should not re-add new libs if they were un-selected', () => {
    cy.tick(5000);
    cy.get('[data-project*="3"][data-active="true"]')
      .should('exist')
      .click({ force: true });

    cy.get('[data-project*="3"][data-active="false"]').should('exist');

    cy.tick(5000);
    cy.tick(5000);

    cy.get('[data-project*="3"]')
      .first()
      .should((project) => {
        expect(project.data('active')).to.be.false;
      });
  });
});

function checkSelectedProjects(
  expectedNumberOfProjects: number,
  excludedProjects: string[]
) {
  getProjectItems().should((projects) => {
    expect(projects.length).to.equal(expectedNumberOfProjects);
    projects.each(function () {
      if (!excludedProjects.includes(this.dataset.project)) {
        expect(this.dataset.active).to.eq('true');
      }
    });
  });
}
