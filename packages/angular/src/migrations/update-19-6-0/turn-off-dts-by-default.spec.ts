import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import turnOffDtsByDefault from './turn-off-dts-by-default';

describe('turnOffDtsByDefault', () => {
  describe('withModuleFederation', () => {
    it('should update the webpack.config file to set {dts: false}', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.ts',
        `import { withModuleFederation } from '@nx/angular/module-federation';
      export default withModuleFederation(config)`
      );
      tree.write(
        'app/webpack.prod.config.js',
        `const { withModuleFederation } = require('@nx/angular/module-federation');
      module.exports = withModuleFederation(config);`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/angular/module-federation';
        export default withModuleFederation(config, { dts: false });
        "
      `);
      expect(tree.read('app/webpack.prod.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/angular/module-federation');
        module.exports = withModuleFederation(config, { dts: false });
        "
      `);
    });
    it('should update the webpack.config file to set {dts: false} when other properties exist in that object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.custom.ts',
        `import { withModuleFederation } from '@nx/angular/module-federation';
      export default withModuleFederation(config, {runtimePlugins: []});`
      );
      tree.write(
        'app/webpack.config.js',
        `const { withModuleFederation } = require('@nx/angular/module-federation');
      module.exports = withModuleFederation(config, {runtimePlugins: []});`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.custom.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/angular/module-federation';
        export default withModuleFederation(config, { dts: false, runtimePlugins: [] });
        "
      `);
      expect(tree.read('app/webpack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/angular/module-federation');
        module.exports = withModuleFederation(config, {
          dts: false,
          runtimePlugins: [],
        });
        "
      `);
    });
    it('should update the webpack.config file to set {dts: false} when other properties exist in that object and the config is an object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.server.ts',
        `import { withModuleFederation } from '@nx/angular/module-federation';
      export default withModuleFederation({remotes: []}, {runtimePlugins: []});`
      );
      tree.write(
        'app/webpack.config.server.js',
        `const { withModuleFederation } = require('@nx/angular/module-federation');
      module.exports = withModuleFederation({remotes: []}, {runtimePlugins: []});`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/angular/module-federation';
        export default withModuleFederation(
          { remotes: [] },
          { dts: false, runtimePlugins: [] }
        );
        "
      `);
      expect(tree.read('app/webpack.config.server.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/angular/module-federation');
        module.exports = withModuleFederation(
          { remotes: [] },
          { dts: false, runtimePlugins: [] }
        );
        "
      `);
    });

    it('should update the webpack.config file to set {dts: false} when other properties exist in that object and the config is an object with an object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.server.ts',
        `import { withModuleFederation } from '@nx/angular/module-federation';
      export default withModuleFederation({remotes: {"remote1": "something"}}, {runtimePlugins: {foo: "bar"}});`
      );
      tree.write(
        'app/webpack.config.server.js',
        `const { withModuleFederation } = require('@nx/angular/module-federation');
      module.exports = withModuleFederation({remotes: {"remote1": "something"}}, {runtimePlugins: {foo: "bar"}});`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/angular/module-federation';
        export default withModuleFederation(
          { remotes: { remote1: 'something' } },
          { dts: false, runtimePlugins: { foo: 'bar' } }
        );
        "
      `);
      expect(tree.read('app/webpack.config.server.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/angular/module-federation');
        module.exports = withModuleFederation(
          { remotes: { remote1: 'something' } },
          { dts: false, runtimePlugins: { foo: 'bar' } }
        );
        "
      `);
    });

    it('should not update the webpack.config file to set {dts: false} when it already exists in that object and the config is an object with an object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.server.ts',
        `import { withModuleFederation } from '@nx/angular/module-federation';
      export default withModuleFederation({remotes: {"remote1": "something"}}, {dts: true, runtimePlugins: {foo: "bar"}});`
      );
      tree.write(
        'app/webpack.config.server.js',
        `const { withModuleFederation } = require('@nx/angular/module-federation');
      module.exports = withModuleFederation({remotes: {"remote1": "something"}}, {dts: true, runtimePlugins: {foo: "bar"}});`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.server.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/angular/module-federation';
        export default withModuleFederation(
          { remotes: { remote1: 'something' } },
          { dts: true, runtimePlugins: { foo: 'bar' } }
        );
        "
      `);
      expect(tree.read('app/webpack.config.server.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederation } = require('@nx/angular/module-federation');
        module.exports = withModuleFederation(
          { remotes: { remote1: 'something' } },
          { dts: true, runtimePlugins: { foo: 'bar' } }
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
        `import { withModuleFederationForSSR } from '@nx/angular/module-federation';
      export default withModuleFederationForSSR(config);`
      );
      tree.write(
        'app/webpack.server.config.js',
        `const { withModuleFederationForSSR } = require('@nx/angular/module-federation');
      module.exports = withModuleFederationForSSR(config);`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederationForSSR } from '@nx/angular/module-federation';
        export default withModuleFederationForSSR(config, { dts: false });
        "
      `);
      expect(tree.read('app/webpack.server.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederationForSSR } = require('@nx/angular/module-federation');
        module.exports = withModuleFederationForSSR(config, { dts: false });
        "
      `);
    });
    it('should update the webpack.config file to set {dts: false} when other properties exist in that object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.custom.ts',
        `import { withModuleFederationForSSR } from '@nx/angular/module-federation';
      export default withModuleFederationForSSR(config, {runtimePlugins: []});`
      );
      tree.write(
        'app/webpack.config.js',
        `const { withModuleFederationForSSR } = require('@nx/angular/module-federation');
      module.exports = withModuleFederationForSSR(config, {runtimePlugins: []});`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.custom.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederationForSSR } from '@nx/angular/module-federation';
        export default withModuleFederationForSSR(config, {
          dts: false,
          runtimePlugins: [],
        });
        "
      `);
      expect(tree.read('app/webpack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederationForSSR } = require('@nx/angular/module-federation');
        module.exports = withModuleFederationForSSR(config, {
          dts: false,
          runtimePlugins: [],
        });
        "
      `);
    });
    it('should update the webpack.config file to set {dts: false} when other properties exist in that object and the config is an object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'app/webpack.config.ts',
        `import { withModuleFederationForSSR } from '@nx/angular/module-federation';
      export default composePlugins(withNx(), withReact(), withModuleFederationForSSR({remotes: []}, {runtimePlugins: []}));`
      );
      tree.write(
        'app/webpack.config.js',
        `const { withModuleFederationForSSR } = require('@nx/angular/module-federation');
      module.exports = withModuleFederationForSSR({remotes: []}, {runtimePlugins: []});`
      );

      // ACT
      await turnOffDtsByDefault(tree);

      // ASSERT
      expect(tree.read('app/webpack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederationForSSR } from '@nx/angular/module-federation';
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
        "const { withModuleFederationForSSR } = require('@nx/angular/module-federation');
        module.exports = withModuleFederationForSSR(
          { remotes: [] },
          { dts: false, runtimePlugins: [] }
        );
        "
      `);
    });
  });
});
