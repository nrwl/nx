describe('dev mode - app', () => {
  before(() => {
    cy.intercept('/assets/project-graphs/e2e.json', {
      fixture: 'nx-examples-project-graph.json',
    }).as('getGraph');
    cy.visit('/e2e/projects');

    // wait for initial graph to finish loading
    cy.wait('@getGraph');
  });

  describe('theme preferences', () => {
    let systemTheme: string;
    before(() => {
      cy.visit('/e2e/projects');
      systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    });

    it('should initialize localstorage with default theme', () => {
      expect(localStorage.getItem('nx-dep-graph-theme')).eq('system');
    });

    it('has system default theme', () => {
      cy.log('system theme is:', systemTheme);
      cy.get('html').should('have.class', systemTheme);
    });

    describe('dark theme is set as prefered', () => {
      before(() => {
        cy.get('[data-cy="theme-open-modal-button"]').click();
        cy.get('[data-cy="dark-theme-button"]').click();
      });

      it('should set dark theme', () => {
        cy.log('Localstorage is: ', localStorage.getItem('nx-dep-graph-theme'));
        expect(localStorage.getItem('nx-dep-graph-theme')).eq('dark');
        cy.get('html').should('have.class', 'dark');
      });
    });

    describe('light theme is set as preferred', () => {
      before(() => {
        cy.get('[data-cy="theme-open-modal-button"]').click();
        cy.get('[data-cy="light-theme-button"]').click();
      });

      it('should set light theme', () => {
        cy.log('Localstorage is: ', localStorage.getItem('nx-dep-graph-theme'));
        expect(localStorage.getItem('nx-dep-graph-theme')).eq('light');
        cy.get('html').should('have.class', 'light');
      });
    });
  });

  describe('graph layout direction preferences', () => {
    let rankDir: string;
    before(() => {
      cy.visit('/e2e/projects');
      rankDir = 'TB';
    });

    it('should initialize localstorage with default graph layout direction', () => {
      expect(localStorage.getItem('nx-dep-graph-rankdir')).eq(rankDir);
    });

    describe('left-to-right graph layout direction is set as preferred', () => {
      before(() => {
        cy.get('[data-cy="lr-rankdir-button"]').click();
      });

      it('should set left-to-right graph layout direction', () => {
        cy.log(
          'Localstorage is: ',
          localStorage.getItem('nx-dep-graph-rankdir')
        );
        expect(localStorage.getItem('nx-dep-graph-rankdir')).eq('LR');
        cy.get('[data-cy="tb-rankdir-button"]').should(
          (elem) => expect(elem).to.exist
        );
      });
    });

    describe('top-to-bottom graph layout direction is set as preferred', () => {
      before(() => {
        cy.get('[data-cy="tb-rankdir-button"]').click();
      });

      it('should set top-to-bottom graph layout direction', () => {
        cy.log(
          'Localstorage is: ',
          localStorage.getItem('nx-dep-graph-rankdir')
        );
        expect(localStorage.getItem('nx-dep-graph-rankdir')).eq('TB');
        cy.get('[data-cy="lr-rankdir-button"]').should(
          (elem) => expect(elem).to.exist
        );
      });
    });
  });
});
