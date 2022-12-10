import { getProjectItems } from '../support/app.po';

describe('watch mode  - app', () => {
  beforeEach(() => {
    cy.visit('/projects');
  });

  it('should auto-select new libs as they are created', () => {
    const excludedValues = ['existing-app-1', 'existing-lib-1'];
    checkSelectedProjects(2, excludedValues);
    checkSelectedProjects(3, excludedValues);
    checkSelectedProjects(4, excludedValues);
  });

  it('should retain selected projects as new libs are created', () => {
    cy.get('[data-project="existing-app-1"]').click();
    cy.get('[data-project="existing-lib-1"]').click();

    checkSelectedProjects(3, []);
    checkSelectedProjects(4, []);
    checkSelectedProjects(5, []);
  });

  it('should not re-add new libs if they were un-selected', () => {
    cy.get('[data-project*="3"][data-active="true"]', { timeout: 6000 })
      .should('exist')
      .click({ force: true });

    cy.get('[data-project*="3"][data-active="false"]', {
      timeout: 6000,
    }).should('exist');

    cy.get('[data-project*="3"]', { timeout: 6000 })
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
