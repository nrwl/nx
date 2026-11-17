describe('external API project graph reset', () => {
  const projects = ['core', 'demo', 'ui', 'unrelated'];
  const focusControl =
    'button[title="Remove the current focus on the selected node"]';

  function expectVisible(visible: string[], focused = false) {
    cy.get('canvas').should('be.visible');
    for (const project of projects) {
      cy.get(
        `button[title="${visible.includes(project) ? 'Hide' : 'Show'} ${project}"]`
      ).should('be.visible');
    }
    cy.get(focusControl).should(focused ? 'be.visible' : 'not.exist');
    cy.contains('h3', 'Dependency Distance').should(
      focused ? 'be.visible' : 'not.exist'
    );
    if (focused) cy.get('input[type="number"]').should('have.value', '1');
  }

  beforeEach(() => {
    const fixture = {
      hash: 'four-projects',
      projects: projects.map((name) => ({
        name,
        type: name === 'demo' ? 'app' : 'lib',
        data: {
          root: name,
          targets: {},
          implicitDependencies:
            name === 'demo' ? ['ui'] : name === 'ui' ? ['core'] : [],
        },
      })),
      dependencies: {
        demo: [{ source: 'demo', target: 'ui', type: 'implicit' }],
        ui: [{ source: 'ui', target: 'core', type: 'implicit' }],
        core: [],
        unrelated: [],
      },
      fileMap: {},
      affected: [],
      errors: [],
    };
    cy.intercept('**/assets/project-graphs/e2e.json*', fixture);
    cy.intercept('**/project-graph.json*', fixture);
    cy.visit(
      `/projects?rawGraph=${encodeURIComponent(
        JSON.stringify({
          config: { showMode: 'all' },
          state: { type: 'default' },
        })
      )}`
    );
    expectVisible(projects);
    cy.location('search').should('contain', 'graph=');
  });

  it('restores the full rendered graph after external focus and repeated select-all', () => {
    cy.window().then((win) => win.externalApi.focusProject('demo'));
    expectVisible(['demo', 'ui'], true);

    cy.window().then((win) => win.externalApi.selectAllProjects());
    expectVisible(projects);
    cy.window().then((win) => win.externalApi.selectAllProjects());
    expectVisible(projects);
  });

  it('restores hidden projects on repeated calls while the URL stays unchanged', () => {
    cy.window().then((win) => win.externalApi.selectAllProjects());
    expectVisible(projects);
    cy.location('href').then((url) => {
      for (const hidden of ['unrelated', 'core']) {
        cy.get(`button[title="Hide ${hidden}"]`).click();
        expectVisible(projects.filter((project) => project !== hidden));
        cy.location('href').should('equal', url);

        cy.window().then((win) => {
          win.externalApi.selectAllProjects();
          win.externalApi.selectAllProjects();
        });
        expectVisible(projects);
        cy.location('href').should('equal', url);
      }
    });
  });

  it('preserves layout direction through ordinary URL sync and an API reset', () => {
    cy.get('button[title="Hide unrelated"]').click();
    expectVisible(['core', 'demo', 'ui']);
    cy.get('button[title^="Select rank direction for graph layout:"]').click();
    cy.contains('button', 'Left-Right').click();
    cy.location('search').should((search) => {
      const state = JSON.parse(
        decodeURIComponent(atob(new URLSearchParams(search).get('graph')))
      );
      expect(state.c.rankDir).to.equal('LR');
    });
    expectVisible(['core', 'demo', 'ui']);

    cy.window().then((win) => win.externalApi.selectAllProjects());
    expectVisible(projects);
    cy.get('button[title^="Select rank direction for graph layout:"]').should(
      'have.attr',
      'title',
      'Select rank direction for graph layout: Left-Right'
    );
  });
});
