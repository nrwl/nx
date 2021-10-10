import { getProjectCheckboxes } from '../support/app.po';

describe('dep-graph-client in watch mode', () => {
  beforeEach(() => {
    cy.clock();
    cy.visit('/');
    cy.tick(1000);
  });

  it('should auto-select new libs as they are created', () => {
    const excludedValues = ['existing-app-1', 'existing-lib-1'];

    cy.tick(5000);
    checkCheckedBoxes(3, excludedValues);

    cy.tick(5000);
    checkCheckedBoxes(4, excludedValues);

    cy.tick(5000);
    checkCheckedBoxes(5, excludedValues);
  });

  it('should retain selected projects new libs as they are created', () => {
    cy.contains('existing-app-1').siblings('button').click();
    cy.contains('existing-lib-1').siblings('button').click();

    cy.tick(5000);

    checkCheckedBoxes(3, []);

    cy.tick(5000);
    checkCheckedBoxes(4, []);

    cy.tick(5000);
    checkCheckedBoxes(5, []);
  });

  it('should not re-add new libs if they were un-selected', () => {
    cy.tick(5000);
    cy.contains('3')
      .find('input')
      .should('be.checked')
      .click()
      .should('not.be.checked');

    cy.tick(5000);
    cy.tick(5000);
    cy.contains('3').find('input').should('not.be.checked');
  });
});

function checkCheckedBoxes(
  expectedCheckboxes: number,
  excludedValues: string[]
) {
  getProjectCheckboxes().should((checkboxes) => {
    expect(checkboxes.length).to.equal(expectedCheckboxes);
    checkboxes.each(function () {
      if (!excludedValues.includes(this.value)) {
        expect(this.checked).to.be.true;
      }
    });
  });
}
