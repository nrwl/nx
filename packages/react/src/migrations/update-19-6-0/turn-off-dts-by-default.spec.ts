import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import turnOffDtsByDefault from './turn-off-dts-by-default';

describe('turnOffDtsByDefault', () => {
  describe('withModuleFederation', () => {
    it('should update the webpack.config file to set {dts: false}', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.ts',
        `import { withModuleFederation } from '@nx/react/module-federation';
      export default composePlugins(withNx(), withReact(), withModuleFederation(config));`
      );
      tree.write(
        'app/webpack.prod.config.js',
        `const { withModuleFederation } = require('@nx/react/module-federation');
      module.exports = composePlugins(withNx(), withReact(), withModuleFederation(config));`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/react/module-federation';
        export default composePlugins(
          withNx(),
          withReact(),
          withModuleFederation(config, { dts: false })
        );
        "
      `);
      expect(tree.read('app/webpack.prod.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/react/module-federation');
        module.exports = composePlugins(
          withNx(),
          withReact(),
          withModuleFederation(config, { dts: false })
        );
        "
      `);
    });
    it('should update the webpack.config file to set {dts: false} when other properties exist in that object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.custom.ts',
        `import { withModuleFederation } from '@nx/react/module-federation';
      export default composePlugins(withNx(), withReact(), withModuleFederation(config, {runtimePlugins: []}));`
      );
      tree.write(
        'app/webpack.config.js',
        `const { withModuleFederation } = require('@nx/react/module-federation');
      module.exports = composePlugins(withNx(), withReact(), withModuleFederation(config, {runtimePlugins: []}));`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.custom.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/react/module-federation';
        export default composePlugins(
          withNx(),
          withReact(),
          withModuleFederation(config, { dts: false, runtimePlugins: [] })
        );
        "
      `);
      expect(tree.read('app/webpack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/react/module-federation');
        module.exports = composePlugins(
          withNx(),
          withReact(),
          withModuleFederation(config, { dts: false, runtimePlugins: [] })
        );
        "
      `);
    });
    it('should update the webpack.config file to set {dts: false} when other properties exist in that object and the config is an object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.server.ts',
        `import { withModuleFederation } from '@nx/react/module-federation';
      export default composePlugins(withNx(), withReact(), withModuleFederation({remotes: []}, {runtimePlugins: []}));`
      );
      tree.write(
        'app/webpack.config.server.js',
        `const { withModuleFederation } = require('@nx/react/module-federation');
      module.exports = composePlugins(withNx(), withReact(), withModuleFederation({remotes: []}, {runtimePlugins: []}));`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/react/module-federation';
        export default composePlugins(
          withNx(),
          withReact(),
          withModuleFederation({ remotes: [] }, { dts: false, runtimePlugins: [] })
        );
        "
      `);
      expect(tree.read('app/webpack.config.server.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/react/module-federation');
        module.exports = composePlugins(
          withNx(),
          withReact(),
          withModuleFederation({ remotes: [] }, { dts: false, runtimePlugins: [] })
        );
        "
      `);
    });

    it('should update the webpack.config file to set {dts: false} when other properties exist in that object and the config is an object with an object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.server.ts',
        `import { withModuleFederation } from '@nx/react/module-federation';
      export default composePlugins(withNx(), withReact(), withModuleFederation({remotes: {"remote1": "something"}}, {runtimePlugins: {foo: "bar"}}));`
      );
      tree.write(
        'app/webpack.config.server.js',
        `const { withModuleFederation } = require('@nx/react/module-federation');
      module.exports = composePlugins(withNx(), withReact(), withModuleFederation({remotes: {"remote1": "something"}}, {runtimePlugins: {foo: "bar"}}));`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/react/module-federation';
        export default composePlugins(
          withNx(),
          withReact(),
          withModuleFederation(
            { remotes: { remote1: 'something' } },
            { dts: false, runtimePlugins: { foo: 'bar' } }
          )
        );
        "
      `);
      expect(tree.read('app/webpack.config.server.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/react/module-federation');
        module.exports = composePlugins(
          withNx(),
          withReact(),
          withModuleFederation(
            { remotes: { remote1: 'something' } },
            { dts: false, runtimePlugins: { foo: 'bar' } }
          )
        );
        "
      `);
    });

    it('should not update the webpack.config file to set {dts: false} when it exists in that object and the config is an object with an object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.server.ts',
        `import { withModuleFederation } from '@nx/react/module-federation';
      export default composePlugins(withNx(), withReact(), withModuleFederation({remotes: {"remote1": "something"}}, {dts: true, runtimePlugins: {foo: "bar"}}));`
      );
      tree.write(
        'app/webpack.config.server.js',
        `const { withModuleFederation } = require('@nx/react/module-federation');
      module.exports = composePlugins(withNx(), withReact(), withModuleFederation({remotes: {"remote1": "something"}}, {dts: true, runtimePlugins: {foo: "bar"}}));`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/react/module-federation';
        export default composePlugins(
          withNx(),
          withReact(),
          withModuleFederation(
            { remotes: { remote1: 'something' } },
            { dts: true, runtimePlugins: { foo: 'bar' } }
          )
        );
        "
      `);
      expect(tree.read('app/webpack.config.server.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/react/module-federation');
        module.exports = composePlugins(
          withNx(),
          withReact(),
          withModuleFederation(
            { remotes: { remote1: 'something' } },
            { dts: true, runtimePlugins: { foo: 'bar' } }
          )
        );
        "
      `);
    });
  });
  describe('withModuleFederationForSSR', () => {
    it('should update the webpack.config file to set {dts: false}', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.ts',
        `import { withModuleFederationForSSR } from '@nx/react/module-federation';
      export default composePlugins(withNx(), withReact(), withModuleFederationForSSR(config));`
      );
      tree.write(
        'app/webpack.prod.config.js',
        `const { withModuleFederationForSSR } = require('@nx/react/module-federation');
      module.exports = composePlugins(withNx(), withReact(), withModuleFederationForSSR(config));`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederationForSSR } from '@nx/react/module-federation';
        export default composePlugins(
          withNx(),
          withReact(),
          withModuleFederationForSSR(config, { dts: false })
        );
        "
      `);
      expect(tree.read('app/webpack.prod.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederationForSSR } = require('@nx/react/module-federation');
        module.exports = composePlugins(
          withNx(),
          withReact(),
          withModuleFederationForSSR(config, { dts: false })
        );
        "
      `);
    });
    it('should update the webpack.config file to set {dts: false} when other properties exist in that object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.custom.ts',
        `import { withModuleFederationForSSR } from '@nx/react/module-federation';
      export default composePlugins(withNx(), withReact(), withModuleFederationForSSR(config, {runtimePlugins: []}));`
      );
      tree.write(
        'app/webpack.config.js',
        `const { withModuleFederationForSSR } = require('@nx/react/module-federation');
      module.exports = composePlugins(withNx(), withReact(), withModuleFederationForSSR(config, {runtimePlugins: []}));`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.custom.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederationForSSR } from '@nx/react/module-federation';
        export default composePlugins(
          withNx(),
          withReact(),
          withModuleFederationForSSR(config, { dts: false, runtimePlugins: [] })
        );
        "
      `);
      expect(tree.read('app/webpack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederationForSSR } = require('@nx/react/module-federation');
        module.exports = composePlugins(
          withNx(),
          withReact(),
          withModuleFederationForSSR(config, { dts: false, runtimePlugins: [] })
        );
        "
      `);
    });
    it('should update the webpack.config file to set {dts: false} when other properties exist in that object and the config is an object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.ts',
        `import { withModuleFederationForSSR } from '@nx/react/module-federation';
      export default composePlugins(withNx(), withReact(), withModuleFederationForSSR({remotes: []}, {runtimePlugins: []}));`
      );
      tree.write(
        'app/webpack.config.js',
        `const { withModuleFederationForSSR } = require('@nx/react/module-federation');
      module.exports = composePlugins(withNx(), withReact(), withModuleFederationForSSR({remotes: []}, {runtimePlugins: []}));`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederationForSSR } from '@nx/react/module-federation';
        export default composePlugins(
          withNx(),
          withReact(),
          withModuleFederationForSSR(
            { remotes: [] },
            { dts: false, runtimePlugins: [] }
          )
        );
        "
      `);
      expect(tree.read('app/webpack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederationForSSR } = require('@nx/react/module-federation');
        module.exports = composePlugins(
          withNx(),
          withReact(),
          withModuleFederationForSSR(
            { remotes: [] },
            { dts: false, runtimePlugins: [] }
          )
        );
        "
      `);
    });
  });
});
