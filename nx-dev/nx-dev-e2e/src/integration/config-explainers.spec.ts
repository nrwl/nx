import { nxConfigExplainer } from 'nx/src/explain/config-explainers/nx-json';

describe('config explainers', () => {
  describe('nx.json config explainer', () => {
    Object.entries(nxConfigExplainer).forEach(([key, explainer]) => {
      it(`should ensure that the learn more path for "${key}" is valid and accessible`, () => {
        cy.visit(explainer.nxDevLearnMorePath);
        const anchorHref = explainer.nxDevLearnMorePath.split('#')[1];
        cy.get(`a[href="#${anchorHref}"]`).should('be.visible');
      });
    });
  });
});
