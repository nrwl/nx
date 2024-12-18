import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addHtmlTemplatePath,
  addCopyAssets,
  addExperimentalSwcPlugin,
} from './ast-utils';

describe('ast-utils', () => {
  describe('addHtmlTemplatePath', () => {
    it('should add the template path to the config when html object does not exist', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';
export default defineConfig({
});`
      );

      // ACT
      addHtmlTemplatePath(
        tree,
        'apps/my-app/rsbuild.config.ts',
        './src/index.html'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
        	html: {
        		template: './src/index.html'
        	},	
        });"
      `);
    });

    it('should add the template path to the config when html object exists but template is not', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';
export default defineConfig({
  html: {
    otherValue: true
  }
});`
      );

      // ACT
      addHtmlTemplatePath(
        tree,
        'apps/my-app/rsbuild.config.ts',
        './src/index.html'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
          html: {
        		template: './src/index.html',
        		
            otherValue: true
          }
        });"
      `);
    });

    it('should add the template path to the config when html object exists along with template', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';
export default defineConfig({
  html: {
    template: 'my.html'
  }
});`
      );

      // ACT
      addHtmlTemplatePath(
        tree,
        'apps/my-app/rsbuild.config.ts',
        './src/index.html'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
          html: {
            template: './src/index.html',
          }
        });"
      `);
    });
  });
  describe('addCopyAssets', () => {
    it('should add the copy path to the config when output object does not exist', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';
export default defineConfig({
});`
      );

      // ACT
      addCopyAssets(tree, 'apps/my-app/rsbuild.config.ts', './src/assets');

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
        	output: {
        			copy: [{ from: './src/assets' }],
        	},
        });"
      `);
    });

    it('should add the copy path to the config when outout object exists but copy does not', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';
export default defineConfig({
  output: {
    distPath: {
      root: 'dist',
    }
  }
});`
      );

      // ACT
      addCopyAssets(tree, 'apps/my-app/rsbuild.config.ts', './src/assets');

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
          output: {
        		copy: [{ from: './src/assets' }],
        	
            distPath: {
              root: 'dist',
            }
          }
        });"
      `);
    });

    it('should add the copy path to the config when output object exists along with copy object', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';
export default defineConfig({
  output: {
    copy: [
      { from: './src/assets' }
    ]
  }
});`
      );

      // ACT
      addCopyAssets(tree, 'apps/my-app/rsbuild.config.ts', './src/favicon.ico');

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
          output: {
            copy: [
        		{ from: './src/favicon.ico' },
        		
              { from: './src/assets' }
            ]
          }
        });"
      `);
    });
  });
  describe('addExperimentalSwcPlugin', () => {
    it('should add the swc plugin to the config when tools object does not exist', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';\nexport default defineConfig({\n});`
      );

      // ACT
      addExperimentalSwcPlugin(
        tree,
        'apps/my-app/rsbuild.config.ts',
        '@swc/plugin-emotion'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
        	tools: {
        		swc: {
        			jsc: {
        				experimental: {
        					plugins: [
        						['@swc/plugin-emotion', {}],
        					], 
        				},
        			},
        		},
        	},
        });"
      `);
    });

    it('should add the swc plugin to the config when swc object does not exist', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';\nexport default defineConfig({\n\ttools: {}\n});`
      );

      // ACT
      addExperimentalSwcPlugin(
        tree,
        'apps/my-app/rsbuild.config.ts',
        '@swc/plugin-emotion'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
        	tools: {
        		swc: {
        			jsc: {
        				experimental: {
        					plugins: [
        						['@swc/plugin-emotion', {}],
        					], 
        				},
        			},
        		},
        	}
        });"
      `);
    });

    it('should add the swc plugin to the config when jsc object does not exist', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';\nexport default defineConfig({\n\ttools: {\n\t\tswc: {}\n\t}\n});`
      );

      // ACT
      addExperimentalSwcPlugin(
        tree,
        'apps/my-app/rsbuild.config.ts',
        '@swc/plugin-emotion'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
        	tools: {
        		swc: {
        			jsc: {
        				experimental: {
        					plugins: [
        						['@swc/plugin-emotion', {}],
        					], 
        				},
        			},
        		}
        	}
        });"
      `);
    });

    it('should add the swc plugin to the config when experimental object does not exist', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';
export default defineConfig({
  tools: {
    swc: {
      jsc: {}
    }
  }
});`
      );

      // ACT
      addExperimentalSwcPlugin(
        tree,
        'apps/my-app/rsbuild.config.ts',
        '@swc/plugin-emotion'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
          tools: {
            swc: {
              jsc: {
        				experimental: {
        					plugins: [
        						['@swc/plugin-emotion', {}],
        					], 
        				},
        			}
            }
          }
        });"
      `);
    });

    it('should add the swc plugin to the config when plugins array does not exist', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';
export default defineConfig({
  tools: {
    swc: {
      jsc: {
        experimental: {}
      }
    }
  }
});`
      );

      // ACT
      addExperimentalSwcPlugin(
        tree,
        'apps/my-app/rsbuild.config.ts',
        '@swc/plugin-emotion'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
          tools: {
            swc: {
              jsc: {
                experimental: {
        					plugins: [
        						['@swc/plugin-emotion', {}],
        					],
        				}
              }
            }
          }
        });"
      `);
    });

    it('should add the swc plugin to the config when plugins array does exist', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/my-app/rsbuild.config.ts',
        `import {defineConfig} from '@rsbuild/core';
export default defineConfig({
  tools: {
    swc: {
      jsc: {
        experimental: {
          plugins: [['@swc/plugin-styled-jsx', {}]]
        }
      }
    }
  }
});`
      );

      // ACT
      addExperimentalSwcPlugin(
        tree,
        'apps/my-app/rsbuild.config.ts',
        '@swc/plugin-emotion'
      );

      // ASSERT
      expect(tree.read('apps/my-app/rsbuild.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import {defineConfig} from '@rsbuild/core';
        export default defineConfig({
          tools: {
            swc: {
              jsc: {
                experimental: {
                  plugins: [
        					['@swc/plugin-emotion', {}],
        					['@swc/plugin-styled-jsx', {}]]
                }
              }
            }
          }
        });"
      `);
    });
  });
});
