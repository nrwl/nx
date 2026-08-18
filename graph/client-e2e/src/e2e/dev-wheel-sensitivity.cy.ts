import {
  getGraphWheelSensitivityTestApi,
  selectProjectInSidebar,
  waitForGraphLoad,
  waitForGraphWheelTestApi,
} from '../support/app.po';

describe('dev mode - wheel sensitivity', () => {
  before(() => {
    cy.visit('/e2e/projects');
    waitForGraphLoad();
  });

  beforeEach(() => {
    selectProjectInSidebar('cart');
    cy.get('#cytoscape-graph').click({ force: true });
    waitForGraphWheelTestApi();
  });

  it('should configure reduced wheel sensitivity after graph render', () => {
    getGraphWheelSensitivityTestApi().then((testApi) => {
      expect(testApi.getWheelSensitivity()).to.eq(testApi.expectedSensitivity);
      expect(testApi.getWheelSensitivity()).to.be.lessThan(
        testApi.defaultSensitivity
      );
      expect(testApi.expectedSensitivity).to.eq(0.25);
    });
  });

  it('should re-apply wheel sensitivity after graph updates', () => {
    selectProjectInSidebar('products');
    selectProjectInSidebar('cart');
    waitForGraphWheelTestApi();

    getGraphWheelSensitivityTestApi().then((testApi) => {
      expect(testApi.getWheelSensitivity()).to.eq(testApi.expectedSensitivity);
    });
  });
});
