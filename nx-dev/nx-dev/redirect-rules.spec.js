import redirectRules from './redirect-rules';

describe('Redirect rules configuration', () => {
  describe('Safety checks', () => {
    it('should not redirect to itself', () => {
      const rules = {
        ...redirectRules.cliUrls,
        ...redirectRules.diataxis,
        ...redirectRules.guideUrls,
        ...redirectRules.overviewUrls,
        ...redirectRules.schemaUrls,
        ...redirectRules.tutorialRedirects,
      };

      for (let k of Object.keys(rules)) {
        expect(k).not.toEqual(rules[k]);
      }
    });
  });

  describe('Tutorial redirects', () => {
    test('old tutorial links', () => {
      const oldReactUrls = [
        '/react-tutorial/01-create-application',
        '/react-tutorial/02-add-e2e-test',
        '/react-tutorial/03-display-todos',
        '/react-tutorial/04-connect-to-api',
        '/react-tutorial/05-add-node-app',
        '/react-tutorial/06-proxy',
        '/react-tutorial/07-share-code',
        '/react-tutorial/08-create-libs',
        '/react-tutorial/09-dep-graph',
        '/react-tutorial/10-computation-caching',
        '/react-tutorial/11-test-affected-projects',
        '/react-tutorial/12-summary',
      ];

      for (const url of oldReactUrls) {
        expect(redirectRules.tutorialRedirects[url]).toEqual(
          '/react-tutorial/1-code-generation'
        );
      }
    });

    test('old angular tutorial links', () => {
      const oldAngularUrls = [
        '/angular-tutorial/01-create-application',
        '/angular-tutorial/02-add-e2e-test',
        '/angular-tutorial/03-display-todos',
        '/angular-tutorial/04-connect-to-api',
        '/angular-tutorial/05-add-node-app',
        '/angular-tutorial/06-proxy',
        '/angular-tutorial/07-share-code',
        '/angular-tutorial/08-create-libs',
        '/angular-tutorial/09-dep-graph',
        '/angular-tutorial/10-computation-caching',
        '/angular-tutorial/11-test-affected-projects',
        '/angular-tutorial/12-summary',
      ];

      for (const url of oldAngularUrls) {
        expect(redirectRules.tutorialRedirects[url]).toEqual(
          '/angular-tutorial/1-code-generation'
        );
      }
    });

    test('old node tutorial links', () => {
      const oldNodeTutorialPaths = [
        '/node-tutorial/01-create-application',
        '/node-tutorial/02-display-todos',
        '/node-tutorial/03-share-code',
        '/node-tutorial/04-create-libs',
        '/node-tutorial/05-dep-graph',
        '/node-tutorial/06-computation-caching',
        '/node-tutorial/07-test-affected-projects',
        '/node-tutorial/08-summary',
      ];

      for (const url of oldNodeTutorialPaths) {
        expect(redirectRules.tutorialRedirects[url]).toEqual(
          '/getting-started/tutorials/node-server-tutorial'
        );
      }

      const oldNodePathPrefix = '/node-tutorial';
      const newNodePathPrefix = '/node-server-tutorial';
      const nodeDestination = [
        '/1-code-generation',
        '/2-project-graph',
        '/3-task-running',
        '/4-task-pipelines',
        '/5-docker-target',
        '/6-summary',
      ];

      nodeDestination.forEach((des) => {
        expect(
          redirectRules.tutorialRedirects[`${oldNodePathPrefix}${des}`]
        ).toEqual(`${newNodePathPrefix}${des}`);
      });
    });
  });
});
