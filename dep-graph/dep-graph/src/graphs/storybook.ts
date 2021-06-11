import { ProjectGraphCache } from '@nrwl/workspace';

export const storybookWorkspaceLayout = {
  libsDir: '',
  appsDir: '',
};

export const storybookGraph: ProjectGraphCache = {
  version: '2.0',
  rootFiles: [
    {
      file: 'package.json',
      hash: '7914823a6d977563b0321d304e1c0c4f208aba16',
      ext: '.json',
    },
    {
      file: 'workspace.json',
      hash: '198c5f89e79018233bd5cabb67458d5b3576b9ab',
      ext: '.json',
    },
    {
      file: 'nx.json',
      hash: 'e359b8303a570bf6acc621038f526011ce4cc2b5',
      ext: '.json',
    },
    {
      file: 'tsconfig.base.json',
      hash: '',
      ext: '.json',
    },
  ],
  nodes: {
    '@storybook/addon-storyshots-puppeteer': {
      name: '@storybook/addon-storyshots-puppeteer',
      type: 'lib',
      data: {
        root: 'addons/storyshots/storyshots-puppeteer',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/storyshots/storyshots-puppeteer/.eslintrc.js',
            hash: 'cc34d2deab0f7fbeee310e0ebc852e1ca467eecb',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/package.json',
            hash: '85ace72e67e0bf394942c2717b8e90dcd9fee081',
            ext: '.json',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/preset.js',
            hash: '501f6e0c1310e3b5f4ec57c6c4f36aede10798b8',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/README.md',
            hash: '4776f0d23b003cd2de66266ee64868d236f943ac',
            ext: '.md',
          },
          {
            file:
              'addons/storyshots/storyshots-puppeteer/src/__tests__/url.test.ts',
            hash: 'd0f8ddbddf07c41608a5ddc686db849b6c4a9cd8',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/src/axeTest.ts',
            hash: '02ad850016085eec4a98e83ac2ce883fadeb0d81',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/src/config.ts',
            hash: '34447cd8c117ddd5620c24fc8d1a92a395ae9f1e',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/src/imageSnapshot.ts',
            hash: 'e069f7b22d2b280d52b695dfcbc0ad66cfecf131',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/src/index.ts',
            hash: 'dd2e0b715feecefe1c9adb96087197e6316a3f4e',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/src/puppeteerTest.ts',
            hash: 'fbdd5233e5c13b5c98e98ac29b7332ff8741115a',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/src/url.ts',
            hash: 'f9f75a90cffff7a9df1023937e4968580311f5ed',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-puppeteer/tsconfig.json',
            hash: '4f09fb307c2099be5367a6e4df6e02be9f54c4ec',
            ext: '.json',
          },
        ],
      },
    },
    'web-components-kitchen-sink': {
      name: 'web-components-kitchen-sink',
      type: 'lib',
      data: {
        root: 'examples/web-components-kitchen-sink',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/web-components-kitchen-sink/.storybook/main.js',
            hash: 'd028ac2f59fe8d6c691d862e24999f75e4e3bcf4',
            ext: '.js',
          },
          {
            file: 'examples/web-components-kitchen-sink/.storybook/preview.js',
            hash: '5670ebb2e8e9c43015516eb6668e1e39bbb5f005',
            ext: '.js',
          },
          {
            file: 'examples/web-components-kitchen-sink/custom-elements.json',
            hash: '19f98b4a4e8d34e0edc899f5fc01eeedb5c50cb3',
            ext: '.json',
          },
          {
            file: 'examples/web-components-kitchen-sink/custom-elements.md',
            hash: '5e68c8e88aa1dc4235176afdaa7d6b78fdf90cc9',
            ext: '.md',
          },
          {
            file: 'examples/web-components-kitchen-sink/demo-wc-card.js',
            hash: 'd9cdbd7d60dc00b3b0a0be7126d0fd7e1a7c3e61',
            ext: '.js',
          },
          {
            file: 'examples/web-components-kitchen-sink/package.json',
            hash: '1cf5654588e09df1aa4a679e593a780699290308',
            ext: '.json',
          },
          {
            file: 'examples/web-components-kitchen-sink/README.md',
            hash: '9820aa41ed5387138884ccc5502eaccb735e651a',
            ext: '.md',
          },
          {
            file: 'examples/web-components-kitchen-sink/src/DemoWcCard.js',
            hash: '9eda6c80dd244407e741608d68411a78732de8f3',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/src/demoWcCardStyle.css.js',
            hash: '100d02dc9d37183652e3ef0ed476212aaf415f83',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/addon-a11y.stories.js',
            hash: '2b14aeeeea3ab0256418277e5f8242f37c74bb17',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/addon-actions.stories.js',
            hash: '019e582adcce65e5a0cac8d99e6821d0c1f0ea7e',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/addon-backgrounds.stories.js',
            hash: 'dc78b4d31000831698853a53ff2746614b014095',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/addon-controls.stories.js',
            hash: '9100b7bd0f7ede892f6fb7e796f53c8629a37312',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/addon-docs.stories.mdx',
            hash: '1aa77fd1a35785a6d8e659d04e9d686617a40cb5',
            ext: '.mdx',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/addon-knobs.stories.js',
            hash: 'c207e45b56f9e94472ad6109762f16994bdd5c94',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/card.stories.js',
            hash: '282bcc7ae0d8589e77fd0d558a55b71c07a6ee9d',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/issues/11831-unknown-component.stories.js',
            hash: 'db46cda1b866fbe0067ad90eb67229f5868a42c9',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/script.stories.js',
            hash: '168fc83e4f43e8210a78a0b2976f4a8134dbbbdd',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/stories/welcome.stories.js',
            hash: '7dd8a9f1b89249c507d4ec526310eb7261796d1a',
            ext: '.js',
          },
          {
            file:
              'examples/web-components-kitchen-sink/web-components-storyshots.test.js',
            hash: '89acc476c2ead5c19b64ec9cc3fb65e918f4a0ab',
            ext: '.js',
          },
        ],
      },
    },
    '@storybook/addon-storyshots': {
      name: '@storybook/addon-storyshots',
      type: 'lib',
      data: {
        root: 'addons/storyshots/storyshots-core',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          example: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'example',
            },
          },
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/storyshots/storyshots-core/.eslintrc.js',
            hash: 'd52d94baae34cc9abcc8b3cdcdd4e834a2f318c4',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-core/.storybook/config.js',
            hash: '79582f41050f2f38db5e7e7f2f429dddfcdce13e',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-core/.storybook/configTest.js',
            hash: '9c163a43e4d4cbeb4a50e3b9e9c819bdd99b35e3',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-core/.storybook/presets.js',
            hash: 'a04174c7a331a4ff12624857b9c3bc4c7f7a22f9',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-core/docs/storyshots-fail.png',
            hash: 'a85498d2ff2fdc909e866b4575b770e5b886bbc2',
            ext: '.png',
          },
          {
            file: 'addons/storyshots/storyshots-core/docs/storyshots.png',
            hash: '991e6c0bc18c988c12fe01cda0c56b273189c2e7',
            ext: '.png',
          },
          {
            file: 'addons/storyshots/storyshots-core/injectFileName.js',
            hash: '991bce4fc5f3a5d0daf8410e59b04415e79784a7',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-core/package.json',
            hash: 'b27c228e572611fbc5b3868989cbc8d4f8d71970',
            ext: '.json',
          },
          {
            file: 'addons/storyshots/storyshots-core/preset.js',
            hash: '501f6e0c1310e3b5f4ec57c6c4f36aede10798b8',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-core/README.md',
            hash: 'af3d314c30d61465cca17dae7fcddcb5bd3432f2',
            ext: '.md',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/api/ensureOptionsDefaults.ts',
            hash: '25adf62c8343861524469ff426cd2aa55b067879',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-core/src/api/index.ts',
            hash: '601697ff89d41bb49c57475867de33e495196d26',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/api/integrityTestTemplate.ts',
            hash: 'f11563e7ce5d582445e71721fd2e9049776d0384',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/api/snapshotsTestsTemplate.ts',
            hash: 'a29238a9bd6281e01c746b9fc42447d03b4bb3d3',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/api/StoryshotsOptions.ts',
            hash: 'dc5d542feb794af3a485feed164ed6075db37b6f',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/angular/loader.ts',
            hash: 'fa0b0755cc6d67f23bf47dc74781a6c765e4dcd0',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/angular/renderTree.ts',
            hash: '98b705ed5942b8f2992c115959c1118157ebbd96',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/angular/types.ts',
            hash: '232cf18fa8cc8026b0495bf78df4a040a5bfc5c2',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/configure.test.ts',
            hash: '76c88463876ac628ce609a84a7bfd5572785c775',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/configure.ts',
            hash: 'e80b4f2d6782bcb55ec221d07f82e12abc1b8023',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/frameworkLoader.ts',
            hash: '0ea2ed2eaf5be34ffbb440176667d181bb0b3b99',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/hasDependency.ts',
            hash: 'c88d5347b116c3b2146ed5e8541bf5a40a2e5763',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/html/loader.ts',
            hash: '9ca3cd51c88da7555bdd3d42cc0129d498933c2b',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/html/renderTree.ts',
            hash: '380ff7c189c5a88950b11e75a77f02748c6c0ff6',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-core/src/frameworks/index.ts',
            hash: '3eb9b3a990b040522b803f25163141df550be9a4',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-core/src/frameworks/Loader.ts',
            hash: 'a257e0e0e8ba51b79f4065fcd447eb0e065a21cc',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/preact/loader.ts',
            hash: 'eac1ef7d64a16f183fecd81e3f74bb98cf91da6e',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/preact/renderTree.ts',
            hash: 'bc6daf6a9e6fda5c150eaa8a2bad180b7a6c9284',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/rax/loader.ts',
            hash: '9ea737584e50177309ac82dccb5706e9647ba97d',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/rax/renderTree.ts',
            hash: '6046f0f6cc60340823e68d0272fcbb7dc970502a',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/react-native/loader.ts',
            hash: '29d89154e6132c4b8cc51fe4840a549f8139783e',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/react/loader.ts',
            hash: '7d6e4388394f024a4a5aeb895cfccfb41c064f4b',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/react/renderShallowTree.ts',
            hash: 'd8ac7b865b4efb6a8311dc4b7530b4c5b495600f',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/react/renderTree.ts',
            hash: 'd92a55710ab1cc7d53418beaed4fcdf8f1728624',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/riot/loader.ts',
            hash: 'bd2f7ce499afbc09e192abbfe1704bb15da85f6e',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/riot/renderTree.ts',
            hash: '4800a1c3c737cf5dccf82ee1ae9b840c2d0ec582',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/SupportedFramework.ts',
            hash: 'fd04db80adc9497f94c5a0ac92d62281479e38b3',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/svelte/loader.ts',
            hash: 'b0ba7627755808896fe63fe4e372af22f4f769ec',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/svelte/renderTree.ts',
            hash: 'd3a16e792a0526eb4b242a8b0b28dea7b819f574',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/vue/loader.ts',
            hash: '4ab5fad6fa365de75a10047e415ee6f3c42f27a8',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/vue/renderTree.ts',
            hash: 'ea3f0f8bc0aaf08672fc61e391f894e338114587',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/vue3/loader.ts',
            hash: '3ffc0df9714acd37e0f50850ca10c0f763e69eab',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/vue3/renderTree.ts',
            hash: 'c4e89908d51e2ad51a7f15e0e67b92d43cad4468',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/web-components/loader.ts',
            hash: 'c98f34946461c9091f84a7c1bc13263e267519bc',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/frameworks/web-components/renderTree.ts',
            hash: '8c45ea52eacaed1d4b1a17c633e4b82835c272d3',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-core/src/index.ts',
            hash: '1ded516202410871b9db5d0c36412eac3c2f3247',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/Stories2SnapsConverter.test.ts',
            hash: '0176f2e48b1ecad086be7169745397f0ed57bb79',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/src/Stories2SnapsConverter.ts',
            hash: '85425bae4d72eb76e0f78fda4090489c9f094bf2',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-core/src/test-bodies.ts',
            hash: 'e8fbc7f674ff44f1d933e1dccef1bd6fe21b94bd',
            ext: '.ts',
          },
          {
            file: 'addons/storyshots/storyshots-core/src/typings.d.ts',
            hash: '48a542a81ef50c96a840c5f34fb50072070a7d76',
            ext: '.ts',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/__snapshots__/storyshot.enzyme.test.js.snap',
            hash: '2c7cbf790b6815598a9f62ca2603a4b6e641c223',
            ext: '.snap',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/__snapshots__/storyshot.metadata.test.js.snap',
            hash: 'c9965e394a4c76f6d472b4edab693329134dee5d',
            ext: '.snap',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/__snapshots__/storyshot.shallow.test.js.snap',
            hash: 'caccf51b26098e5aca995b2198f067170ce78e43',
            ext: '.snap',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/__snapshots__/storyshot.shallowWithOptions.test.js.snap',
            hash: 'caccf51b26098e5aca995b2198f067170ce78e43',
            ext: '.snap',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/__snapshots__/storyshot.snapshotWithOptionsFunction.test.js.snap',
            hash: '8a70ef0ff961e6fce02e2b0caadd117903103fa6',
            ext: '.snap',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/directly_required/__snapshots__/index.foo',
            hash: 'b193752e2724e142eada1b7881fe581a01402d1e',
            ext: '.foo',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/directly_required/__snapshots__/index.storyshot',
            hash: 'b193752e2724e142eada1b7881fe581a01402d1e',
            ext: '.storyshot',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/directly_required/__snapshots__/index@Another-_-Button@with-_-some-_-emoji.boo',
            hash: '6941fa6cb16b4f079340968f2df13b45ee33545c',
            ext: '.boo',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/directly_required/__snapshots__/index@Another-_-Button@with-_-text.boo',
            hash: '9376d96fbeb4cf3ae72bd26a1274be0c3af8c053',
            ext: '.boo',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/directly_required/index.js',
            hash: '7bc4dc08f9d44d3fb1e6b0cf651453e0d28062df',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/exported_metadata/main.js',
            hash: 'f6e10c62569485194ecea567f4ee2e78d7c970fc',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/exported_metadata/preview.js',
            hash: '724c84b9a43241946ba80672ba08774146a0ef4b',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/exported_metadata/Text.stories.js',
            hash: 'e87143f2c7863475d2b1a6dadfd268be68a54b38',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/__snapshots__/Async.stories.async.storyshot',
            hash: '40cff33ed8c4920fce9d47d201a9ad709af530b2',
            ext: '.storyshot',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/__snapshots__/Async.stories.foo',
            hash: 'd4459afef802698674082d36047f83cecb0d37bb',
            ext: '.foo',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/__snapshots__/Async.stories.storyshot',
            hash: 'd4459afef802698674082d36047f83cecb0d37bb',
            ext: '.storyshot',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/__snapshots__/Button.stories.foo',
            hash: '47dabe9763f5a8888e9a5842a91290542cb52199',
            ext: '.foo',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/__snapshots__/Button.stories.storyshot',
            hash: '47dabe9763f5a8888e9a5842a91290542cb52199',
            ext: '.storyshot',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/__snapshots__/Welcome.stories.foo',
            hash: '9f31125b11770e5ed8ffc3018ca0bb1afbc3329a',
            ext: '.foo',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/__snapshots__/Welcome.stories.storyshot',
            hash: '357ca8ea27ac95766c6e29a6530102db07e51ca0',
            ext: '.storyshot',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/Async.stories.js',
            hash: 'd6e03732318b09625d73e797126b40e728f90f01',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/Button.stories.js',
            hash: '23ef66e18e57194c55c4c78d9b323ac324d89c68',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/Welcome.stories.js',
            hash: 'c1ffd1fbe5c5acdba033369d0bda5712a82069d6',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/required_with_context/Welcome.stories.mdx',
            hash: '8dbf6aa34bbc2688dec2f24f73a1dceb05054101',
            ext: '.mdx',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.async.test.js',
            hash: '59745f5282674a3cf51d507db0bc73bd3889730e',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.configFunc.test.js',
            hash: '28a37a20acb37d1fd0f48f4ab1104a7fb7cb9068',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.enzyme.test.js',
            hash: 'ef3fb2f198cbc38c91f23ef1e1b36629a4221fb7',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.metadata.test.js',
            hash: 'd12366fee7a9bf0393e5b01a4627b1e184007f0d',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.renderOnly.test.js',
            hash: '86187aef4545de09c6c5edad36b2ca92f12e21f8',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.renderWithOptions.test.js',
            hash: '7adf516b5dcea8a489a12babe98c7c7eca4292ab',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.shallow.test.js',
            hash: '17c95eb0dbb868026c084e70765f88162db9f7b3',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.shallowWithOptions.test.js',
            hash: '54ef1612b347874565b019a7dc6f658fac5f069f',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.snapshotWithOptionsFunction.test.js',
            hash: 'af8fffb87bb3f84da4f82dc52843896db74070c7',
            ext: '.js',
          },
          {
            file:
              'addons/storyshots/storyshots-core/stories/storyshot.specificConfig.test.js',
            hash: 'ad9596cdc2451fd83228129f5ce3a7d52a610d6a',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-core/stories/storyshot.test.js',
            hash: '2a39180dedfdc736a186685df4002ef44b420694',
            ext: '.js',
          },
          {
            file: 'addons/storyshots/storyshots-core/tsconfig.json',
            hash: '4a91c980e54c13a34148f71954f7dbb960e413b2',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-preview-wrapper': {
      name: '@storybook/addon-preview-wrapper',
      type: 'lib',
      data: {
        root: 'dev-kits/addon-preview-wrapper',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'dev-kits/addon-preview-wrapper/package.json',
            hash: '5f79c8514bcad23fd30b75c2e5edb6726deab433',
            ext: '.json',
          },
          {
            file: 'dev-kits/addon-preview-wrapper/README.md',
            hash: '212ad2a49cac26e61bd54bb334b8d933cac6744f',
            ext: '.md',
          },
          {
            file: 'dev-kits/addon-preview-wrapper/register.js',
            hash: 'cc38cb06f1f2a1cb5ece31b09c024e33d67a9930',
            ext: '.js',
          },
          {
            file: 'dev-kits/addon-preview-wrapper/src/constants.ts',
            hash: '6120231ce3e7fb0bdfb4bd8c612835281f081652',
            ext: '.ts',
          },
          {
            file: 'dev-kits/addon-preview-wrapper/src/register.tsx',
            hash: 'd7c3c86d3601c57212fabdd34778155cbca4906b',
            ext: '.tsx',
          },
          {
            file: 'dev-kits/addon-preview-wrapper/tsconfig.json',
            hash: '8876bb6737a1dbf74aa8792dca842e1cdb13423a',
            ext: '.json',
          },
        ],
      },
    },
    'aurelia-kitchen-sink': {
      name: 'aurelia-kitchen-sink',
      type: 'lib',
      data: {
        root: 'examples/aurelia-kitchen-sink',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          'now-build': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'now-build',
            },
          },
          start: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'start',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/aurelia-kitchen-sink/.gitignore',
            hash: '4d7c8911436e0e7c5f1e34ace65cfebaf689592b',
            ext: '',
          },
          {
            file: 'examples/aurelia-kitchen-sink/.htmlhintrc',
            hash: 'abef809442ea3263709ca639d842897043cdba8c',
            ext: '',
          },
          {
            file: 'examples/aurelia-kitchen-sink/.storybook/main.js',
            hash: '6690acf44858975b8e755140088563a60a240886',
            ext: '.js',
          },
          {
            file: 'examples/aurelia-kitchen-sink/.storybook/manager.js',
            hash: '717c4b8c36b7e40cd37bb48861cab7a869a2d2c8',
            ext: '.js',
          },
          {
            file: 'examples/aurelia-kitchen-sink/.storybook/tsconfig.json',
            hash: '17bef8d1cd0fe4630933030cda581f58cdceb301',
            ext: '.json',
          },
          {
            file: 'examples/aurelia-kitchen-sink/favicon.ico',
            hash: '330515e9c1d77fdfe88d7989060380932ca13e99',
            ext: '.ico',
          },
          {
            file: 'examples/aurelia-kitchen-sink/index.ejs',
            hash: 'e94127cc6574881260b93eb72d42933958c7f46d',
            ext: '.ejs',
          },
          {
            file: 'examples/aurelia-kitchen-sink/package.json',
            hash: '4401b3d8e47df5a8374f22ca44be52ea8c050fd9',
            ext: '.json',
          },
          {
            file: 'examples/aurelia-kitchen-sink/README.md',
            hash: '5860861dea229d277eb1d3b770478dda2fc56292',
            ext: '.md',
          },
          {
            file: 'examples/aurelia-kitchen-sink/src/app.html',
            hash: 'a2729f3217eeff2123222fc2708b7ab538e2289e',
            ext: '.html',
          },
          {
            file: 'examples/aurelia-kitchen-sink/src/app.ts',
            hash: '222bb6a411977d08a64391a01bff51cce5db9e11',
            ext: '.ts',
          },
          {
            file:
              'examples/aurelia-kitchen-sink/src/cool-button/cool-button.html',
            hash: '745cac0c6a51ae8f7fb51bab0cb5ec5f28d24e5d',
            ext: '.html',
          },
          {
            file:
              'examples/aurelia-kitchen-sink/src/cool-button/cool-button.ts',
            hash: '1bc95fe746830710d6ece189d2edb4b4a7b355f5',
            ext: '.ts',
          },
          {
            file: 'examples/aurelia-kitchen-sink/src/css.d.ts',
            hash: 'ba9c00551998cbe2ba14040379068a16352419d8',
            ext: '.ts',
          },
          {
            file: 'examples/aurelia-kitchen-sink/src/html.d.ts',
            hash: 'f4dc965735ff57427e55f3b834f7fa03c0248542',
            ext: '.ts',
          },
          {
            file: 'examples/aurelia-kitchen-sink/src/main.ts',
            hash: '9e175c4d064c6577b28f7f987dde2168ef1dc312',
            ext: '.ts',
          },
          {
            file: 'examples/aurelia-kitchen-sink/src/stories/button.ts',
            hash: '86cac656b57c7b07bff54a5b1e3aa02611558806',
            ext: '.ts',
          },
          {
            file:
              'examples/aurelia-kitchen-sink/src/stories/custom-element.stories.ts',
            hash: '2241978994867b6496cecd680ffa6b65ed57d439',
            ext: '.ts',
          },
          {
            file: 'examples/aurelia-kitchen-sink/src/stories/link.stories.ts',
            hash: 'b92ac4a06ef4fff77edf20ad8d34ed6a743193ef',
            ext: '.ts',
          },
          {
            file: 'examples/aurelia-kitchen-sink/src/stories/mdx.stories.mdx',
            hash: '79536f0edaa2bd62c49cdd6a31daf5a5cd71066c',
            ext: '.mdx',
          },
          {
            file: 'examples/aurelia-kitchen-sink/tsconfig.json',
            hash: '2447de35ea014ecc4c4a573eab091c01e2d6f065',
            ext: '.json',
          },
          {
            file: 'examples/aurelia-kitchen-sink/webpack.config.js',
            hash: '53c00451cb9578bf05a2980a6a9eacd1c887c171',
            ext: '.js',
          },
        ],
      },
    },
    'mithril-example': {
      name: 'mithril-example',
      type: 'lib',
      data: {
        root: 'examples/mithril-kitchen-sink',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/mithril-kitchen-sink/.env',
            hash: 'd24e628d281058029b0f5f6edb2e3ca5de99216e',
            ext: '',
          },
          {
            file: 'examples/mithril-kitchen-sink/.gitignore',
            hash: '56b6cc8a3115537a760630a624a8b0e86d38d5fa',
            ext: '',
          },
          {
            file: 'examples/mithril-kitchen-sink/.storybook/main.js',
            hash: '2fb5c2f82873fd8769727f63c625d8dba8f29b89',
            ext: '.js',
          },
          {
            file: 'examples/mithril-kitchen-sink/package.json',
            hash: '672e040054c6fd71ee74d3aa77793dd0120ad66b',
            ext: '.json',
          },
          {
            file: 'examples/mithril-kitchen-sink/README.md',
            hash: '935df144521927961c764c7aa8dbcd52e9e4c7d7',
            ext: '.md',
          },
          {
            file: 'examples/mithril-kitchen-sink/src/BaseButton.js',
            hash: 'ea451b9569d0a27f683f9c5da0c44a5c8eaf3561',
            ext: '.js',
          },
          {
            file: 'examples/mithril-kitchen-sink/src/Button.js',
            hash: 'f459403fdca70924488710fda68125f788af08b1',
            ext: '.js',
          },
          {
            file:
              'examples/mithril-kitchen-sink/src/stories/addon-actions.stories.js',
            hash: '32970a6e5b64596e670b0bef75fc440333af679b',
            ext: '.js',
          },
          {
            file:
              'examples/mithril-kitchen-sink/src/stories/addon-backgrounds.stories.js',
            hash: 'c3266da180b5f14f8064284b2896b56d04272316',
            ext: '.js',
          },
          {
            file:
              'examples/mithril-kitchen-sink/src/stories/addon-knobs.stories.js',
            hash: '4551f50da9732f7e0c5772d704d510165bb31a9b',
            ext: '.js',
          },
          {
            file:
              'examples/mithril-kitchen-sink/src/stories/addon-links.stories.js',
            hash: 'd75aaf9773ba78ea2cb37cc705adee10191afab4',
            ext: '.js',
          },
          {
            file: 'examples/mithril-kitchen-sink/src/stories/button.stories.js',
            hash: '0da88220da766ad1caee2c73fa323ee08f649d26',
            ext: '.js',
          },
          {
            file:
              'examples/mithril-kitchen-sink/src/stories/welcome.stories.js',
            hash: '2469dda9f7cba211ae2c712a67e1bd5df71baa15',
            ext: '.js',
          },
          {
            file: 'examples/mithril-kitchen-sink/src/Welcome.js',
            hash: 'cd3dd67c9cc4bf43b4e1d5ea2053424cc478743d',
            ext: '.js',
          },
        ],
      },
    },
    'cra-ts-kitchen-sink': {
      name: 'cra-ts-kitchen-sink',
      type: 'lib',
      data: {
        root: 'examples/cra-ts-kitchen-sink',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          eject: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'eject',
            },
          },
          start: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'start',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
          test: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/cra-ts-kitchen-sink/.env',
            hash: '34d70579f45a0033fe135b1a18d5eb99ad96bb19',
            ext: '',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/.storybook/localAddon/preset.ts',
            hash: '68be04174d340d3b23bc3cee79862b55b307d01a',
            ext: '.ts',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/.storybook/localAddon/register.tsx',
            hash: 'b8e30ec52d13690efa3983369db53cf8fdb76c7b',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/.storybook/main.ts',
            hash: 'cfd6a9462bbc868eb8c8821bdae9fcaf6d5547fc',
            ext: '.ts',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/.storybook/preview.ts',
            hash: '3cadf234299630eb9da1124d893eb73e9537ea25',
            ext: '.ts',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/package.json',
            hash: '2d39c0c46dfe423550b8d0411af525f90dccfda4',
            ext: '.json',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/public/favicon.ico',
            hash: 'c2c86b859eaa20639adf92ff979c2be8d580433e',
            ext: '.ico',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/public/index.html',
            hash: 'cc4acffe28cddddc9f4add7fad30edc29e4d6e58',
            ext: '.html',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/public/logo192.png',
            hash: 'afd69775c2a867a944e5247bdc4692eac5ee500c',
            ext: '.png',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/public/logo512.png',
            hash: '1d0d363818f51e6315d5dcc7f334a820418c39df',
            ext: '.png',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/public/manifest.json',
            hash: '080d6c77ac21bb2ef88a6992b2b73ad93daaca92',
            ext: '.json',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/public/robots.txt',
            hash: '01b0f9a10733b39c3bbeba1ccb1521d866f8e3a5',
            ext: '.txt',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/README.md',
            hash: '2fa78e71b5a6e6b36163de19081929c3c2612dd0',
            ext: '.md',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/App.css',
            hash: 'afc3885715f4a69457fdfccdb9aa4220c30ec1f5',
            ext: '.css',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/App.tsx',
            hash: 'a8520a8cceec1835ae2387dd27d2bf1591cd9b93',
            ext: '.tsx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/components/Button.stories.tsx',
            hash: '3db6e175ad9486a3faeae03ba40ded45c074d97b',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/components/Button.tsx',
            hash: '0d3f77ead09bac0ae9307084dc0a8f82f1aa9ca9',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/index.css',
            hash: 'ec2585e8c0bb8188184ed1e0703c4c8f2a8419b0',
            ext: '.css',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/index.tsx',
            hash: '612e2e014ca64636aeebd5e323fd6cc24391453b',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/logo.svg',
            hash: '7bd1599766bbeaa18c09e0f3439f409acf445573',
            ext: '.svg',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/react-app-env.d.ts',
            hash: '6431bc5fc6b2c932dfe5d0418fc667b86c18b9fc',
            ext: '.ts',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/0-Welcome.stories.tsx',
            hash: '9920a416e1ff7db4b32a832bc3ded0e8dab38df5',
            ext: '.tsx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/1-Button.stories.tsx',
            hash: 'f9cd3c5119d3e361cc47b0f25f9ea0fe0e45e633',
            ext: '.tsx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/anchors/anchors.stories.mdx',
            hash: 'fa27a4109c98f9b0bf31c18ab11253d6f2681621',
            ext: '.mdx',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/stories/Button.tsx',
            hash: '7673a0a118a4c676041f02131c0e1fe269963b7d',
            ext: '.tsx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/Classes.stories.mdx',
            hash: '80039504ba9b54bc6c7686605b1ca43057f50c00',
            ext: '.mdx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/docgen.stories.mdx',
            hash: '8927940597f96f7681807f5588c74cfed63fc654',
            ext: '.mdx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/DocgenJS.js',
            hash: 'ec7463c578d1617594e7f9fb55eb7204fb5391aa',
            ext: '.js',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/DocgenTS.tsx',
            hash: 'ea5f10f0f108bb12e7a664c062c68a41712d91fc',
            ext: '.tsx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/jsdoc/jsdoc-perfo.js',
            hash: '78665fe6c1c337769c60d3c28df0d51ccd3d2e09',
            ext: '.js',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/jsdoc/jsdoc-perfo.stories.mdx',
            hash: '48323079e19ed42d9c9cdd516cc55f3d3ab9e794',
            ext: '.mdx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/jsdoc/jsdoc-ts.tsx',
            hash: '5045d28cd75a016c31898e64f7efaf794a334a52',
            ext: '.tsx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/jsdoc/jsdoc.js',
            hash: '322a1dfe5eb82f6a672ff5898d5739ef7bd30326',
            ext: '.js',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/jsdoc/jsdoc.stories.mdx',
            hash: 'a13f7245265efbb3b05ef894c35fac99ac55310e',
            ext: '.mdx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/types/ext.js',
            hash: '047b6b362bd319ba6306c13cd880eac119952aec',
            ext: '.js',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/types/prop-types.js',
            hash: 'c8316e1e2a504b7fd12805dde08a77b70065f7a6',
            ext: '.js',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/types/ts-types.tsx',
            hash: 'eedd0b79d6633b7c78415dea5530b65bfb778d6f',
            ext: '.tsx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/docgen-tests/types/types.stories.mdx',
            hash: 'f4800485c6396e04433216baa279b9ea37448cc4',
            ext: '.mdx',
          },
          {
            file:
              'examples/cra-ts-kitchen-sink/src/stories/props-sort.stories.mdx',
            hash: '93ff36d488bbb4102652d56a00dfe7a61ab4a684',
            ext: '.mdx',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/stories/PropsSort.js',
            hash: '2e4a6b383e16b02fc1d64cda5cee475c62289f20',
            ext: '.js',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/src/stories/Test.stories.mdx',
            hash: '69953b6a1804f4353e711168dc94834701605e9c',
            ext: '.mdx',
          },
          {
            file: 'examples/cra-ts-kitchen-sink/tsconfig.json',
            hash: '1f8c0c06eadffd6d0b2c02246ccbb9a9a4947fe6',
            ext: '.json',
          },
        ],
      },
    },
    'preact-example': {
      name: 'preact-example',
      type: 'lib',
      data: {
        root: 'examples/preact-kitchen-sink',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          dev: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'dev',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/preact-kitchen-sink/.eslintrc.js',
            hash: 'cb88f3f613c8ec06fbd93a3cabbdd800fe4e0de6',
            ext: '.js',
          },
          {
            file: 'examples/preact-kitchen-sink/.gitignore',
            hash: '6c96c5cff124271309d717aa6a74c99fa3cdd455',
            ext: '',
          },
          {
            file: 'examples/preact-kitchen-sink/.storybook/main.js',
            hash: '085d8c93075bf7f6bc7116609c8186e98d663d56',
            ext: '.js',
          },
          {
            file: 'examples/preact-kitchen-sink/jest.config.js',
            hash: '07862cbaaf53c46c6b1c057eb516b17c0518ff59',
            ext: '.js',
          },
          {
            file: 'examples/preact-kitchen-sink/package.json',
            hash: 'a281792c61e77e741246ff5f0bfd9e18b1641e68',
            ext: '.json',
          },
          {
            file: 'examples/preact-kitchen-sink/preactshots.test.js',
            hash: 'd44a573ddaf64d17b6b5a3b2821d7957d8b45c8e',
            ext: '.js',
          },
          {
            file: 'examples/preact-kitchen-sink/public/favicon.ico',
            hash: 'f6da4336801ba3fba9cae9f222cfd4ad73785ebd',
            ext: '.ico',
          },
          {
            file: 'examples/preact-kitchen-sink/public/logo.png',
            hash: '52d1623ea1055fc5a445f52e092a137eac991752',
            ext: '.png',
          },
          {
            file: 'examples/preact-kitchen-sink/README.md',
            hash: 'f2c53ad4493fc79f93113b93a36584ace54c8d24',
            ext: '.md',
          },
          {
            file: 'examples/preact-kitchen-sink/src/Button.js',
            hash: '2a3410406a7eef7a20a1d6e0aea6ada176f04b19',
            ext: '.js',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/__snapshots__/addon-actions.stories.storyshot',
            hash: 'c15dfb282f781b1f1f8129a78cb11f22dc90c1c7',
            ext: '.storyshot',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/__snapshots__/addon-backgrounds.stories.storyshot',
            hash: '4530aab71bff4ab5bdaf80512a7fb28f03ec811d',
            ext: '.storyshot',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/__snapshots__/addon-knobs.stories.storyshot',
            hash: '6cf5d96d48f14bbc9e477b7a96d9853328410749',
            ext: '.storyshot',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/__snapshots__/addon-links.stories.storyshot',
            hash: '256585be5d5587eb5fc00f176057ec0885782ca2',
            ext: '.storyshot',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/__snapshots__/button.stories.storyshot',
            hash: '171bfa989e674ce25e72182c97cff8e89caa0f9f',
            ext: '.storyshot',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/__snapshots__/welcome.stories.storyshot',
            hash: '5d740bb097a34a2f4093f3a952d14a42c5c31995',
            ext: '.storyshot',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/addon-actions.stories.js',
            hash: '0d1547737d650fc2a3997a054a1002c495f8737c',
            ext: '.js',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/addon-backgrounds.stories.js',
            hash: 'da4fa9902acd714b822d6239dd378c0d24375c0e',
            ext: '.js',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/addon-knobs.stories.js',
            hash: '01a976dcddae10630f6877c92081a71f8f90f9c9',
            ext: '.js',
          },
          {
            file:
              'examples/preact-kitchen-sink/src/stories/addon-links.stories.js',
            hash: 'a88a2e2f579805276dc3de7465a18942d4c49bdb',
            ext: '.js',
          },
          {
            file: 'examples/preact-kitchen-sink/src/stories/button.stories.js',
            hash: '597d5cb4bcf589353508e9abcd66f12f6834ad69',
            ext: '.js',
          },
          {
            file: 'examples/preact-kitchen-sink/src/stories/welcome.stories.js',
            hash: 'f25999a441c6980fb8d189c3192018405790d027',
            ext: '.js',
          },
          {
            file: 'examples/preact-kitchen-sink/src/Welcome.js',
            hash: '479be7c62bffc0dda1d7d3c907ef91191d3851ea',
            ext: '.js',
          },
        ],
      },
    },
    'server-kitchen-sink': {
      name: 'server-kitchen-sink',
      type: 'lib',
      data: {
        root: 'examples/server-kitchen-sink',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          server: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'server',
            },
          },
          start: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'start',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/server-kitchen-sink/.storybook/main.js',
            hash: '11e029cb40c1782e632f44195e8a9efe971b5f8a',
            ext: '.js',
          },
          {
            file: 'examples/server-kitchen-sink/.storybook/preview.js',
            hash: '3d99fec16dff4e3aa275a9f88a4de6501adf37eb',
            ext: '.js',
          },
          {
            file: 'examples/server-kitchen-sink/package.json',
            hash: '3a398cd3e6314f2445ffcf7accad4ed74b57a314',
            ext: '.json',
          },
          {
            file: 'examples/server-kitchen-sink/public/css/button.css',
            hash: '2a9d9215b84bb9b0cd126b4e3b7d48c66356947d',
            ext: '.css',
          },
          {
            file: 'examples/server-kitchen-sink/public/js/alert.js',
            hash: '6031661d766f5bd6357edd0cc20a7f090dc09494',
            ext: '.js',
          },
          {
            file: 'examples/server-kitchen-sink/README.md',
            hash: '7f9cddd5ecd9784f2fd6294e53bfbf28723f2069',
            ext: '.md',
          },
          {
            file: 'examples/server-kitchen-sink/server.js',
            hash: 'b443b5c6c1d38a28bd61990b392ab40f44d4161c',
            ext: '.js',
          },
          {
            file:
              'examples/server-kitchen-sink/stories/addon-a11y.stories.json',
            hash: '95db30850089d274570f3d0de5138745ebab466a',
            ext: '.json',
          },
          {
            file:
              'examples/server-kitchen-sink/stories/addon-actions.stories.json',
            hash: 'b5db602918a9739816be18c0621142131fb76291',
            ext: '.json',
          },
          {
            file:
              'examples/server-kitchen-sink/stories/addon-backgrounds.stories.json',
            hash: 'f5fe3529dc23a9e8582b52f8ed6ea41534aa7078',
            ext: '.json',
          },
          {
            file:
              'examples/server-kitchen-sink/stories/addon-controls.stories.json',
            hash: '522fa1818e149745c538759fdef606d7610d27d0',
            ext: '.json',
          },
          {
            file: 'examples/server-kitchen-sink/stories/demo.stories.json',
            hash: '207332142d298582daa555cf66d35a0a9f00aaed',
            ext: '.json',
          },
          {
            file:
              'examples/server-kitchen-sink/stories/kitchen_sink.stories.json',
            hash: '87f09c3ce26c90e639b9e344a787bdace10f8e90',
            ext: '.json',
          },
          {
            file: 'examples/server-kitchen-sink/stories/params.stories.json',
            hash: 'c714b0a562dfef7aa77bf5cacacd5ffbfe86edb6',
            ext: '.json',
          },
          {
            file: 'examples/server-kitchen-sink/stories/scripts.stories.json',
            hash: '8edb51ffafd603bbde13962bab7b7e74ddeddc5f',
            ext: '.json',
          },
          {
            file: 'examples/server-kitchen-sink/stories/styles.stories.json',
            hash: '8a81304b8566c9e65dfaabe336d9393cf403afa8',
            ext: '.json',
          },
          {
            file: 'examples/server-kitchen-sink/stories/welcome.stories.json',
            hash: '976e10c37cc5d6e49e0d2c8bc4cb4a6937f98605',
            ext: '.json',
          },
          {
            file: 'examples/server-kitchen-sink/views/addons/a11y/contrast.pug',
            hash: '4b217011d3a19f9c82f1e47ae9918428a944200f',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/addons/a11y/default.pug',
            hash: '0900630d219dcd060812026eb940fcff3f076bbd',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/addons/a11y/disabled.pug',
            hash: '2b3652f5ecc7f1a45aa57b87831469e6ca93bcfd',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/addons/a11y/label.pug',
            hash: '901f438d64a5cdd526f1495b4dd91f1789d3db29',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/actions/button.pug',
            hash: 'e612bbfb36f1da43d689f7965efe41544a029aeb',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/actions/story1.pug',
            hash: '7894bcc0743bd803fd9b2fa0d97d8366d22f47c2',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/actions/story2.pug',
            hash: '7894bcc0743bd803fd9b2fa0d97d8366d22f47c2',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/actions/story3.pug',
            hash: '7894bcc0743bd803fd9b2fa0d97d8366d22f47c2',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/actions/story4.pug',
            hash: '7894bcc0743bd803fd9b2fa0d97d8366d22f47c2',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/actions/story5.pug',
            hash: '557c20da0e893002766f8d28306668a2ce18db2e',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/actions/story6.pug',
            hash: '7894bcc0743bd803fd9b2fa0d97d8366d22f47c2',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/actions/story7.pug',
            hash: '7894bcc0743bd803fd9b2fa0d97d8366d22f47c2',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/actions/story8.pug',
            hash: '7894bcc0743bd803fd9b2fa0d97d8366d22f47c2',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/backgrounds/story1.pug',
            hash: '7d62c85d7cdfe1d828e9330a7ec7cecef32992be',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/backgrounds/story2.pug',
            hash: '82abc4ee834aad1ee9afb86ec953981326c62742',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/addons/controls/all.pug',
            hash: '50fb62d4c2764eeb7d8006be0cbba85b165dcfb3',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/addons/controls/css.pug',
            hash: 'ec8996a537801bd2076daba0d938a06a606a873a',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/controls/simple.pug',
            hash: '899a25344ca4188c655164de6fdbacda4b8fb0c1',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/addons/controls/xss_safety.pug',
            hash: '6e0f1c5d2d33699aa9ad8b14cdf1c212dd28740b',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/demo/button.pug',
            hash: '69e440c555c6de377d482cf253e8b0547b2d3cee',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/demo/heading.pug',
            hash: '23b68dd8f3e97529afb937c9f36f65d20c77a0f2',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/demo/headings.pug',
            hash: '23a6d7f78ab6596d88ed26f5a27c3b72a55ec971',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/params/override.pug',
            hash: 'b60cffc6349bc98f1bb6de89a710fa62d2828780',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/params/params.pug',
            hash: '5020bd41af24bb69f33a6fabcdffd754dc7213ae',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/params/story_fn_override.pug',
            hash: 'b60cffc6349bc98f1bb6de89a710fa62d2828780',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/params/story.pug',
            hash: 'b60cffc6349bc98f1bb6de89a710fa62d2828780',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/scripts/body_inline.pug',
            hash: '9bd1e20577da67bb66cca88f018da63008e5b3f3',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/scripts/body_src.pug',
            hash: '9e188f875fca6f85585c0e118f05150e8228de68',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/scripts/head_inline.pug',
            hash: '6d6b6f95f6f93e4ad6e96760ac704cb969db3a56',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/scripts/head_src.pug',
            hash: '92c31ad6a8c6a8351831d725c22bd7d49212b1d9',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/scripts/includes/alert_script_inline.pug',
            hash: '4281d7a7b0898a682fbf163c2d6f4123d1eeb1b8',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/scripts/includes/alert_script_src.pug',
            hash: '0808952acb782bc18065177ea91ba4f4c76b70b6',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/scripts/includes/button.pug',
            hash: 'adfbe870d1ad33fca9aa18deb470386871561479',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/styles/body_inline.pug',
            hash: 'dc1b52bc963b693b3a4b8ef53aa2009ec83bebaa',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/styles/body_src.pug',
            hash: 'fb5a2e23874a6852e8a654a9f97addc606ff0e37',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/styles/head_inline.pug',
            hash: 'ed491a72b209a006df8ec5c49e22cb6b9b2ee546',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/styles/head_src.pug',
            hash: '0e06280312171f723ab6711b5bfa0ded1c98b487',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/styles/includes/button_styles_inline.pug',
            hash: 'c8ea6f680a6d812ad63f5e6c078bda1a7e355a3c',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/styles/includes/button_styles_src.pug',
            hash: '83545794603619627f3ce204caef9525f9209e1a',
            ext: '.pug',
          },
          {
            file:
              'examples/server-kitchen-sink/views/styles/includes/button.pug',
            hash: '69e440c555c6de377d482cf253e8b0547b2d3cee',
            ext: '.pug',
          },
          {
            file: 'examples/server-kitchen-sink/views/welcome/welcome.pug',
            hash: 'fe663b9d7c934ff5f916c2f7eb198932303b6a1f',
            ext: '.pug',
          },
        ],
      },
    },
    'svelte-example': {
      name: 'svelte-example',
      type: 'lib',
      data: {
        root: 'examples/svelte-kitchen-sink',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/svelte-kitchen-sink/.gitignore',
            hash: 'f25c23c591badeae8838a99193d2ed0230c3e2e9',
            ext: '',
          },
          {
            file: 'examples/svelte-kitchen-sink/.storybook/main.js',
            hash: 'cc8df22d3975be73d2224fe340b98a8710e5a719',
            ext: '.js',
          },
          {
            file: 'examples/svelte-kitchen-sink/.storybook/preview.js',
            hash: '2eae43220865d252edf9e67d052eee7f97d666ab',
            ext: '.js',
          },
          {
            file: 'examples/svelte-kitchen-sink/jest.config.js',
            hash: 'f1954f5b60237b20e1a915304c1db4717baf72fd',
            ext: '.js',
          },
          {
            file: 'examples/svelte-kitchen-sink/package.json',
            hash: '730676d8fc770342f59a3cddb61219a8d5641f89',
            ext: '.json',
          },
          {
            file: 'examples/svelte-kitchen-sink/public/favicon.ico',
            hash: '9e9c880c25b3345c015fe3ac8437f021f65fcbd6',
            ext: '.ico',
          },
          {
            file: 'examples/svelte-kitchen-sink/README.md',
            hash: '22b59e4567176065658a5552b6facc6bba947395',
            ext: '.md',
          },
          {
            file: 'examples/svelte-kitchen-sink/src/components/Button.svelte',
            hash: 'c444ce741385a0ddea357975937cac87973a553f',
            ext: '.svelte',
          },
          {
            file: 'examples/svelte-kitchen-sink/src/components/Button.test.js',
            hash: '2160b1358b31b521f84f6f8a0d9fcfbce48d290b',
            ext: '.js',
          },
          {
            file: 'examples/svelte-kitchen-sink/src/components/Context.svelte',
            hash: '68b5699af448dbc14992d2fbbe321d37f183c108',
            ext: '.svelte',
          },
          {
            file: 'examples/svelte-kitchen-sink/src/logo.png',
            hash: '92b1560c6de132943c5a02339d3088fae8c78656',
            ext: '.png',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/addon-actions.stories.storyshot',
            hash: '9628f3d76163ffb33b144e96053cbfd533462f55',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/addon-backgrounds.stories.storyshot',
            hash: '7d5e0bac2e1e8d8fd1072a5d7e04b5fa7284d59b',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/addon-controls.stories.storyshot',
            hash: 'a44a4cc79a6d223a104732987dfba62e39c5ef2c',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/addon-docs.stories.storyshot',
            hash: '1245061655ac5df26b366574ff26b3f1e0749d3e',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/addon-knobs.stories.storyshot',
            hash: 'f50bd0d7a5bba3f7699ff5b7c8c15888034dd300',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/addon-links.stories.storyshot',
            hash: '677c69de4bfa12597095dc5e6eb7bd19c2921207',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/argstable.stories.storyshot',
            hash: 'd135617e8100c266de36fdc71305543d88ca2da9',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/button.stories.storyshot',
            hash: '33a9896cd07ac21884d985a03906524d30350ebd',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/decorators.stories.storyshot',
            hash: '4ff491be39b04d69ea450c3b8d643cb5a8ce93e4',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/__snapshots__/welcome.stories.storyshot',
            hash: '8df9d140f482786a8c295e1afbbc83e7e21a6797',
            ext: '.storyshot',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/addon-actions.stories.js',
            hash: '4cb15b8a702e136b527d0bd4d647bf93fac6eead',
            ext: '.js',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/addon-backgrounds.stories.js',
            hash: '24bf99802265b19b94e8ac7a2df61897cf53a8f7',
            ext: '.js',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/addon-controls.stories.js',
            hash: 'f6c7b8853928714e7649ea4aeb5dbf56ffccf4da',
            ext: '.js',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/addon-docs.stories.mdx',
            hash: '800518bbfcfac5e5ac300a4c4ced196f5776ce4f',
            ext: '.mdx',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/addon-knobs.stories.js',
            hash: 'edc36a3f3300ee7087fe88117885dec655f825d0',
            ext: '.js',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/addon-links.stories.js',
            hash: '74ec418fe8a0303aae07fb8a7a48cb40741664fa',
            ext: '.js',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/argstable.stories.js',
            hash: 'c804e96cc10101fee8cd86cc3ef358ce189a7be7',
            ext: '.js',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/BorderDecorator.svelte',
            hash: '52365b2008ba3665c51c6d2c346acede38e1f24c',
            ext: '.svelte',
          },
          {
            file: 'examples/svelte-kitchen-sink/src/stories/button.stories.js',
            hash: '51dd804077d526d2eb91d37bbc51363c191b7205',
            ext: '.js',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/decorators.stories.js',
            hash: '6b9a1e6993c2cd95c12b9cb41566393e8de6f902',
            ext: '.js',
          },
          {
            file: 'examples/svelte-kitchen-sink/src/stories/error.stories.js',
            hash: '21be1c4add5497f8d5b06f2b752f54158cdcea11',
            ext: '.js',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/views/ActionKnobView.svelte',
            hash: 'fb37b663ce163e44d8681d784c8fdb3dd83aa0d1',
            ext: '.svelte',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/views/ActionLinkView.svelte',
            hash: '1e4e79fdd43d99658c5a077911d6993482b8f818',
            ext: '.svelte',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/views/ArgsTableView.svelte',
            hash: 'c81fb0578f9feb31c71b3e28335fa631e17990e8',
            ext: '.svelte',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/views/ButtonView.svelte',
            hash: '7306df6a054ae7a8f792e2bf9865087b3ef4b0a1',
            ext: '.svelte',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/views/ControlShowcaseView.svelte',
            hash: '9112e9204c3c999821d878482f8e78f6fc157e2a',
            ext: '.svelte',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/views/ErrorView.svelte',
            hash: '50847c1e169ffa82eddf3c3668fc2789a917a341',
            ext: '.svelte',
          },
          {
            file:
              'examples/svelte-kitchen-sink/src/stories/views/WelcomeView.svelte',
            hash: 'f3bfc9442b3d7c7415de7782d0996933998d213c',
            ext: '.svelte',
          },
          {
            file: 'examples/svelte-kitchen-sink/src/stories/welcome.stories.js',
            hash: '865dbdc60663bc21dcc4ef2ae47507bca6f27004',
            ext: '.js',
          },
          {
            file: 'examples/svelte-kitchen-sink/svelte.config.js',
            hash: '2dd36643e8b8bc9e56564e67ad97aaacaa1f96bb',
            ext: '.js',
          },
          {
            file: 'examples/svelte-kitchen-sink/svelteshots.test.js',
            hash: 'fd14ec12becb64837b64c99711428535f62d4001',
            ext: '.js',
          },
          {
            file: 'examples/svelte-kitchen-sink/tsconfig.json',
            hash: '71816f58b0b081de83b7b5f6b158a414724e3bfb',
            ext: '.json',
          },
        ],
      },
    },
    'official-storybook': {
      name: 'official-storybook',
      type: 'lib',
      data: {
        root: 'examples/official-storybook',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          debug: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'debug',
            },
          },
          'do-storyshots-puppeteer': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'do-storyshots-puppeteer',
            },
          },
          'generate-addon-jest-testresults': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'generate-addon-jest-testresults',
            },
          },
          graphql: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'graphql',
            },
          },
          packtracker: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'packtracker',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
          'storyshots-puppeteer': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storyshots-puppeteer',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/official-storybook/.env',
            hash: '23af4d561fae55edbe3bba73f3c0bded0775520e',
            ext: '',
          },
          {
            file: 'examples/official-storybook/.env.development',
            hash: '3746c482ab58401a8df8b9479788928b11aeac7b',
            ext: '.development',
          },
          {
            file: 'examples/official-storybook/components/addon-a11y/Button.js',
            hash: '293f6ca973034b38033c3e5de5a509c5256f6758',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/components/addon-a11y/Form/index.js',
            hash: 'c893c0a55dd6e6b03d53cfbc44aeb4af6fa84267',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/components/addon-a11y/Form/Input.js',
            hash: 'f5fca29664d8b11d03df01388b5afdd5f57eba6f',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/components/addon-a11y/Form/Label.js',
            hash: '5f3799a6ac6c711dfd8c9a789179cb3077550092',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/components/addon-a11y/Form/Row.js',
            hash: '51f87b04052935686c797a9d893951769d5f7d02',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/BaseButton.js',
            hash: '17b2ce719fda151559395179e62cbf3b6391649d',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/ButtonGroup.js',
            hash: '6b8187dac6bb4eee6c19c16af51dfc9ef0669aec',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/DelayedRender.js',
            hash: '85ec79e1a6af3ed5cdf9947454c752942dc41f24',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/DocgenButton.js',
            hash: '801605b1884591e6b1e5912882da769baecdc57b',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/FlowTypeButton.js',
            hash: '827e01b2870f2cbec516bf8013f8007e425576da',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/ForwardRefButton.js',
            hash: 'b65eeb511546f500ced3cf388dd63e627b1641dc',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/components/ImportedPropsButton.js',
            hash: 'b8a1e7e88cd654bb5233e5e66f5b5c6dea7b12e4',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/MemoButton.js',
            hash: '8e8dc72a7d33f70f3ac01742319f6fbf0f42642e',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/NamedExportButton.js',
            hash: '8a0491c24b7734a6e84148200541e5f31aad9bab',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/OptionalButton.tsx',
            hash: 'dc10a20c49372e73f28ed3554dc91eef3d55abb4',
            ext: '.tsx',
          },
          {
            file: 'examples/official-storybook/components/TableComponent.js',
            hash: '0a738c793be3c62ed16d2ce5a95314e7c8497430',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/components/TsButton.tsx',
            hash: '0d3f77ead09bac0ae9307084dc0a8f82f1aa9ca9',
            ext: '.tsx',
          },
          {
            file: 'examples/official-storybook/graphql-server/data.json',
            hash: 'e0e399cef11aa7e931b1716fcdad87816043ab5a',
            ext: '.json',
          },
          {
            file: 'examples/official-storybook/graphql-server/index.js',
            hash: '2a1c93dd78cb46edc76a9b576f7576606f609b1a',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/head-warning.js',
            hash: 'adca9e680619773c3d625931e92fddc942906a6a',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/intro.stories.mdx',
            hash: 'b192db9fded5123537b08a8c43a669de7a461a9f',
            ext: '.mdx',
          },
          {
            file: 'examples/official-storybook/main.ts',
            hash: 'e72009a04f2035d9cb2035dbe0bd31bf3c3da27f',
            ext: '.ts',
          },
          {
            file: 'examples/official-storybook/manager-head.html',
            hash: '7d058f58633bc794a0eb998ae426b34b26eb3c57',
            ext: '.html',
          },
          {
            file: 'examples/official-storybook/manager.js',
            hash: 'b46efbc338c55fa3618612606033f6c28a88a1f5',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/package.json',
            hash: 'ed43ed5a2111640ce7d3ff0efff9ea244e26b82e',
            ext: '.json',
          },
          {
            file: 'examples/official-storybook/preview-head.html',
            hash: '832d1d79398251be78824e6ff40abe5b3691f5dd',
            ext: '.html',
          },
          {
            file: 'examples/official-storybook/preview.js',
            hash: '92985fb849e603b767b8936ab7836a7e29c81446',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/README.md',
            hash: '2ada0aa35033a980c198daed2f0457a4bdbe7129',
            ext: '.md',
          },
          {
            file:
              'examples/official-storybook/stories/addon-a11y/base-button.stories.js',
            hash: 'ff3dd0145b2bb6360cdd442fdb309fb33c9435d2',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-a11y/button.stories.js',
            hash: 'ba4521b719299edef0f8558516fb11ef1cabfa21',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-a11y/form.stories.js',
            hash: 'a60eb6b4a6d30f229bc013e2e347e283dafb8704',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-a11y/highlight.stories.js',
            hash: '88af6f4086bc1e04565626b8b697afd0a7520b8b',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-a11y/image.stories.js',
            hash: 'f96410cbd7f10403b77b944d0e1b6033de78951b',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-a11y/typography.stories.js',
            hash: '1acf3b81bf23aa6c2064407232a81d9e977cacde',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-actions.stories.js',
            hash: 'fd4f3223570045b4335670394d2ec8d16d0fbd87',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-backgrounds.stories.js',
            hash: '3ad15dc5a00b50ee7ede8a18e129acec05fed183',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-controls.stories.tsx',
            hash: '93040bf0a443c953fb9e99d3d3e4e99e2e510629',
            ext: '.tsx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-cssresources.stories.js',
            hash: '92d4ef7af59503947791b467f06c41d90741cdf2',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-design-assets.stories.js',
            hash: '05361efae06b12ecd64d476860be7b209bc97646',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/addon-docs-blocks.stories.js',
            hash: 'edb017b0f237df5a26b304974b06d32da7dcbed3',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/addon-docs-mdx.stories.mdx',
            hash: '58fad82735405f0b29168c04a76ea4b9db3a8e2d',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/addon-docs.stories.js',
            hash: 'b559a7a94fd8b5617a57d6c6ff7514bbd0e1acd6',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/array-subcomponents.stories.js',
            hash: 'c42ffd6048c2552b9986a2965148507120aadb0e',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/colorpalette.stories.mdx',
            hash: '91537cda500f5206b7d2f94c71e531e308a4b515',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/container-override.stories.mdx',
            hash: 'ff728f5642960de53c39489d4042d7c38c1b5e1d',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/csf-with-mdx-docs.stories.js',
            hash: '7e88ab303f56dd2d79ee8317126e997f9e2adc03',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/csf-with-mdx-docs.stories.mdx',
            hash: 'ad7ef620f3e15137ba0fe3de98d7c11f29b53a27',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/docs-only.stories.mdx',
            hash: '986d5445f41ddb6162878379e76ee059168ae2bc',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/dynamic-title.stories.js',
            hash: '1ee17c07f9b286130a1412953cfdbc6fcd9b9975',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/forward-ref-inner-proptypes.stories.js',
            hash: 'fc6789af1dbbbfa169131d24376fe244b2d71314',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/forward-ref-outer-proptypes.stories.js',
            hash: '7feb23f4050d67aa592cde55f535f19adfdc1715',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/imported.stories.tsx',
            hash: '122fe922ee42a99171bd39ff4558ac77fb64fa3b',
            ext: '.tsx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/markdown.stories.mdx',
            hash: 'd89a82a9f4ec9dc92ac5888435cfff472f486a0b',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/mdx.stories.js',
            hash: '77bc2d757e5598b7f3a9c401816800e36b1b9bf0',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/memo.stories.js',
            hash: '3d07ae61abc912bea09d2291b665d8d19fac76fb',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/meta-string-template.stories.mdx',
            hash: '15aa10637a43523b8f1b885668aff2d231ebbbd7',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/meta-title-quotes.stories.mdx',
            hash: 'd89cdab9ab95ebb3288abae4b7d3339cfa2715d1',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/mixed-leaves-component.stories.js',
            hash: '3d6a49874f1cd6295033be386d98269a739045ba',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/mixed-leaves-folder.stories.js',
            hash: '2f9216606fe9568a233d1a92d99835c653533723',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/props-include-exclude.stories.mdx',
            hash: '836d4d133249fad8b018f6467fe51d4f68b6533e',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/props.stories.mdx',
            hash: '94bacefa5e3c37ed477cc8feea1fae617711ab78',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/source.stories.tsx',
            hash: '8fce2c7422f79cc428b0a04075a20dc6eb7eb15e',
            ext: '.tsx',
          },
          {
            file: 'examples/official-storybook/stories/addon-docs/stories.mdx',
            hash: '1188516d4fbaca7b7f58845c44d33c8b52f95fe2',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/subcomponents.stories.js',
            hash: '2fa7db68a0b92c3783a58fa707cd7bec66803089',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/title-generators.ts',
            hash: 'f5b0f0abce451964dbf6ddc0c5c1fcb56ef59d29',
            ext: '.ts',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/transform-source.stories.js',
            hash: 'd805bc05ddf0b116b63052a309ff72ad07b6bdf8',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-docs/ts-button.stories.tsx',
            hash: '6b8800c31864aba8e0cbb7106f7049aa20bd909e',
            ext: '.tsx',
          },
          {
            file: 'examples/official-storybook/stories/addon-events.stories.js',
            hash: '01d46ac5e838702d8b4cd553ee88f2132dd39950',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-graphql.stories.js',
            hash: '52e7465f8c0b1f855eb6de1ce1a69153fef9275b',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/addon-jest.stories.js',
            hash: 'abb0aad1ae6d726d12ac1d54d3e9ba7b2344f8a1',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-jest.testresults.json',
            hash: 'd6bd6709fad77ba9266708155f979fc5ddce5227',
            ext: '.json',
          },
          {
            file:
              'examples/official-storybook/stories/addon-knobs/with-knobs-decorators.stories.js',
            hash: '86bfa4c795a0e3e33df1735143b8f08e1a540376',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-knobs/with-knobs-options.stories.js',
            hash: '5e14440af8266be13c34bd050d1b607ad6a1c5c3',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-knobs/with-knobs.stories.js',
            hash: '928d8833eee82c8f5ec3da32cba0ff226c01d4f3',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-links/button.stories.tsx',
            hash: '73b9352134cfb0d90622db3154e2ea7fa04f29b4',
            ext: '.tsx',
          },
          {
            file:
              'examples/official-storybook/stories/addon-links/href.stories.js',
            hash: '64a912762d498eff64304622a8bcc7b1d370a68c',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-links/link.stories.js',
            hash: '110ea0cb8d3b1d79dc47f8b4d6a9c5c39c6f6721',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-links/scroll.stories.js',
            hash: '134bb026f884f0cc130f5814f37cf087b74882b5',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-links/select.stories.js',
            hash: 'debbf867a3864e58af075149e098ca6123f3164f',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-options.stories.js',
            hash: '0ee37459418ecfe15491b339f140a3efec97fbee',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-queryparams.stories.js',
            hash: 'ee32dbe82750d962dafa6f7af00e32c846c9d280',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-storyshots.stories.js',
            hash: 'eaf56417ff5a0d37f7273e34bd1cccacaa46422d',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-toolbars.stories.js',
            hash: '5a36dc1cab491367eadca67d9e7b8a084e7ece4b',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-viewport/custom-default.stories.js',
            hash: '8b6700546a2593078f6eb593d452764f8fdc6769',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/addon-viewport/default.stories.js',
            hash: 'bdd2ee5ed7fe13bab16944b53f433d733c5c3a73',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/controls-sort.stories.tsx',
            hash: '46dc611795d130d1ff0c920072748ee0d847f556',
            ext: '.tsx',
          },
          {
            file: 'examples/official-storybook/stories/core/args.stories.js',
            hash: '1a1bb9ee72a13dc0e6d9f71f6efedde3605a364b',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/core/async.stories.inactive.js',
            hash: 'bd6a8ad5ec5bef4ac181d0be322364fc394fbde8',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/core/decorators.stories.js',
            hash: '7184460ac2541793635c517ab8e4541f1777e81f',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/core/errors.stories.js',
            hash: '727dcf21d92bde0d85e1053bcce713db8bdde310',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/core/events.stories.js',
            hash: 'aabf9192a5ad5ca152faeaf68ee015e80efc7df1',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/core/globals.stories.js',
            hash: 'a9426c938f842539d4719c43a3a1fdc741b7aa1a',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/core/interleaved-exports.stories.js',
            hash: 'b585bfa6b3d202404960730b5a32995df351b10a',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/core/layout.stories.js',
            hash: '61967456a0fe1bcf38e52ba25ec1bba83030a758',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/core/layout.stories.mdx',
            hash: 'e0a314b1ed8e55f9b4c2360391edf67d5895e22a',
            ext: '.mdx',
          },
          {
            file: 'examples/official-storybook/stories/core/loaders.stories.js',
            hash: 'bea9cab24134d79ccefc3ca7eb9346d8fd52f4a4',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/core/named-export-order.stories.js',
            hash: '03fda7eb5bcf881481dfcc3782967a831b94d94d',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/core/parameters.stories.js',
            hash: 'f98c478beae2c0d357c7e0538de19a4ef237648b',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/core/prefix.stories.js',
            hash: '0010f1ddfe65e34b0548d9c2e4a389d7437ff12a',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/core/reexport-source-loader.stories.js',
            hash: '8bbac6a575f4c144e33ddc6b6c689ca2aa0cf1f8',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/core/rendering.stories.js',
            hash: 'f446292b95ff128b28125a2f28ef2f7d332ca669',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/core/scroll.stories.js',
            hash: 'e614c386f622d8551893fd5560aaf9be278a2ae0',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/core/unicode.stories.js',
            hash: 'e85392f4a8724e8b7412acab7fb838167edad3b2',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/demo/button.stories.js',
            hash: '929300d2d9fca04763a6a0601a1c6ff9af84139b',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/demo/button.stories.mdx',
            hash: '4cc01dea469b2417a0016c04af4e69e64f057454',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/demo/csf-embedding.test.js',
            hash: 'ba26d54e53d3a65ffdd2f33b96aaee91dd1e54c2',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/stories/demo/typed-button.stories.tsx',
            hash: 'ec57fd8146bc5b6459a700818f9006599a0b4d06',
            ext: '.tsx',
          },
          {
            file: 'examples/official-storybook/stories/demo/welcome.stories.js',
            hash: '621ea5cfaa0615cb4f46e196b36af2f8e0805ac8',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/hooks.stories.js',
            hash: 'b9642a674927ec45fc7981019ca5b42f781ecdbd',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/Logger.js',
            hash: '7279e4ba13bb940e8e4f04902afe7706abda28f8',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/stories/notes/notes.md',
            hash: '1b903f1d94405eaa66439b3a931d84c90d067c78',
            ext: '.md',
          },
          {
            file: 'examples/official-storybook/stories/notes/notes.mdx',
            hash: 'e744599a3799752539d9ad302c7130a82e8f4655',
            ext: '.mdx',
          },
          {
            file:
              'examples/official-storybook/stories/other-dirname.stories.js',
            hash: '734a8a8912be3a317e6585096065f9d98b3831bf',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/storyshots-puppeteer/__image_snapshots__/storyshots-image-runner-js-image-snapshots-addons-storyshots-block-story-1-snap.png',
            hash: '97342bef03deb8c7f7d0ddf00c7a21acbb6e44b5',
            ext: '.png',
          },
          {
            file:
              'examples/official-storybook/storyshots-puppeteer/axe-tests.runner.js',
            hash: '05dde656719d086dbe64b02232c74e241a8560bb',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/storyshots-puppeteer/getStorybookUrl.js',
            hash: '913acc6c592c7dcd49198c091fb92ca38cb93fd4',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/storyshots-puppeteer/jest.config.js',
            hash: '427991f8b937894fc1b004d8c956bbedbd61f58b',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/storyshots-puppeteer/puppeteer-tests.runner.js',
            hash: 'df5db691816a9d9cc8d58669d48bac7cab58a603',
            ext: '.js',
          },
          {
            file:
              'examples/official-storybook/storyshots-puppeteer/storyshots-image.runner.js',
            hash: '8f69249353ded58a35368e5d8fc5eeb4f5004e8a',
            ext: '.js',
          },
          {
            file: 'examples/official-storybook/tests/addon-jest.config.json',
            hash: 'c4d98bd88eaf0393aeae544cde5d7316978825e2',
            ext: '.json',
          },
          {
            file: 'examples/official-storybook/tests/addon-jest.test.js',
            hash: '2e98560ff35a775709fe02cd834cb7a6a83d2cc4',
            ext: '.js',
          },
        ],
      },
    },
    'standalone-preview': {
      name: 'standalone-preview',
      type: 'lib',
      data: {
        root: 'examples/standalone-preview',
        type: 'library',
        targets: {
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/standalone-preview/.babelrc.js',
            hash: 'f053ebf7976e3726d11f3c03fade2170903889a5',
            ext: '.js',
          },
          {
            file: 'examples/standalone-preview/package.json',
            hash: 'ebbfd24ae5cdace3bd8834869d16dd950b0d8ef4',
            ext: '.json',
          },
          {
            file: 'examples/standalone-preview/README.md',
            hash: '06c45a73689a0df9fe0d022f6dc104631a501e88',
            ext: '.md',
          },
          {
            file: 'examples/standalone-preview/stories/Component1.stories.tsx',
            hash: '03736b01f0872f338da0c05252e53d3a759470c4',
            ext: '.tsx',
          },
          {
            file: 'examples/standalone-preview/stories/Component2.stories.tsx',
            hash: 'f9ba700e48d64c994970d7b2a4ab0f4080075866',
            ext: '.tsx',
          },
          {
            file: 'examples/standalone-preview/storybook.html',
            hash: '302bfe485f64ac0501585ef87a278fea666f1462',
            ext: '.html',
          },
          {
            file: 'examples/standalone-preview/storybook.ts',
            hash: '6480e83e1f2d1ae93ce15effedb0dc5589897a50',
            ext: '.ts',
          },
        ],
      },
    },
    'cra-ts-essentials': {
      name: 'cra-ts-essentials',
      type: 'lib',
      data: {
        root: 'examples/cra-ts-essentials',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          eject: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'eject',
            },
          },
          start: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'start',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
          test: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/cra-ts-essentials/.storybook/main.js',
            hash: 'f4ce1050561580228400698d574a6b1fea21f7e2',
            ext: '.js',
          },
          {
            file: 'examples/cra-ts-essentials/.storybook/preview.js',
            hash: '305c8eb0be14aeaf3a684ccc6ed8d9d81d58cf7e',
            ext: '.js',
          },
          {
            file: 'examples/cra-ts-essentials/package.json',
            hash: '8f1e69fbd289176f51e249fcbcf37c9f15126f95',
            ext: '.json',
          },
          {
            file: 'examples/cra-ts-essentials/public/favicon.ico',
            hash: 'c2c86b859eaa20639adf92ff979c2be8d580433e',
            ext: '.ico',
          },
          {
            file: 'examples/cra-ts-essentials/public/index.html',
            hash: 'c240d2ca8b0f6337eb440695f17829e3bada5ed1',
            ext: '.html',
          },
          {
            file: 'examples/cra-ts-essentials/public/logo192.png',
            hash: 'fbdb05d4eb6bd88ae0e8582b4f02cc01e761ea74',
            ext: '.png',
          },
          {
            file: 'examples/cra-ts-essentials/public/logo512.png',
            hash: '917458c29a82e2ae8933f1a42acdc3bf050e393c',
            ext: '.png',
          },
          {
            file: 'examples/cra-ts-essentials/public/manifest.json',
            hash: '080d6c77ac21bb2ef88a6992b2b73ad93daaca92',
            ext: '.json',
          },
          {
            file: 'examples/cra-ts-essentials/public/robots.txt',
            hash: '01b0f9a10733b39c3bbeba1ccb1521d866f8e3a5',
            ext: '.txt',
          },
          {
            file: 'examples/cra-ts-essentials/README.md',
            hash: '8ef4a5d7cdcfc9a69151416e82606b33cba638ef',
            ext: '.md',
          },
          {
            file: 'examples/cra-ts-essentials/src/App.css',
            hash: 'afc3885715f4a69457fdfccdb9aa4220c30ec1f5',
            ext: '.css',
          },
          {
            file: 'examples/cra-ts-essentials/src/App.test.tsx',
            hash: '85b51b430b5603ae26b0d53f3da8ee70fba94407',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-essentials/src/App.tsx',
            hash: 'c512fb7a779073dbe0234f69bee391cff337ca39',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-essentials/src/index.css',
            hash: 'ec2585e8c0bb8188184ed1e0703c4c8f2a8419b0',
            ext: '.css',
          },
          {
            file: 'examples/cra-ts-essentials/src/index.tsx',
            hash: '4b040d0809d05ddd3589f88b6c56f86a20c28669',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-essentials/src/logo.svg',
            hash: '7bd1599766bbeaa18c09e0f3439f409acf445573',
            ext: '.svg',
          },
          {
            file: 'examples/cra-ts-essentials/src/react-app-env.d.ts',
            hash: '6431bc5fc6b2c932dfe5d0418fc667b86c18b9fc',
            ext: '.ts',
          },
          {
            file: 'examples/cra-ts-essentials/src/serviceWorker.ts',
            hash: '9a5c5abb94e43c3b5dc6f196ca16949588193f61',
            ext: '.ts',
          },
          {
            file:
              'examples/cra-ts-essentials/src/stories/0-Welcome.stories.tsx',
            hash: '29a1920ce69df71cf2fbd2dc9ff9a457a1bc5bd0',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-essentials/src/stories/1-Button.stories.tsx',
            hash: 'e952509a9012162c374d3bb46f97ea0a8b443570',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-essentials/src/stories/button.css',
            hash: 'dc91dc76370b78ec277e634f8615b67ca55a5145',
            ext: '.css',
          },
          {
            file: 'examples/cra-ts-essentials/src/stories/Button.stories.tsx',
            hash: 'a6ad97180e3c8344f7de88ce2b4dba420621cdc1',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-essentials/src/stories/Button.tsx',
            hash: '6d397b7494922fa314ac6ccc9eb33a2bf004dada',
            ext: '.tsx',
          },
          {
            file: 'examples/cra-ts-essentials/src/stories/Test.stories.mdx',
            hash: '2a336ae69958a2314672ffbaa5fd2b5a9abf8fb8',
            ext: '.mdx',
          },
          {
            file: 'examples/cra-ts-essentials/tsconfig.json',
            hash: '1f8c0c06eadffd6d0b2c02246ccbb9a9a4947fe6',
            ext: '.json',
          },
        ],
      },
    },
    'html-kitchen-sink': {
      name: 'html-kitchen-sink',
      type: 'lib',
      data: {
        root: 'examples/html-kitchen-sink',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          'generate-addon-jest-testresults': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'generate-addon-jest-testresults',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/html-kitchen-sink/.storybook/main.js',
            hash: 'd5c5bb0352f46a1b187d5ab07d4dcdde1fa3f2a3',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/.storybook/preview.js',
            hash: '4d8de85177bc3f16cd86b33834debd35ab967c87',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/jest.config.js',
            hash: '96bbe6655e13952c1aa41893d41641f58b2b89f7',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/package.json',
            hash: '549afda53eda7214e97e20b6e669475cb209ba73',
            ext: '.json',
          },
          {
            file: 'examples/html-kitchen-sink/postcss.config.js',
            hash: '253ca7d453959610ae6e84e1d687860098302b89',
            ext: '.js',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/addon-a11y.stories.storyshot',
            hash: 'd2f9a117a089d29e011b9e6e1e58434245527cee',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/addon-actions.stories.storyshot',
            hash: '803a63aafdce6de2b03b1ed0593bd38d54cc1660',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/addon-backgrounds.stories.storyshot',
            hash: '7a5e0008d7b6da9a0c574b987311a475ab5da1fd',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/addon-controls.stories.storyshot',
            hash: '67525782be1dc493e5f786c7d3c5c45714a09213',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/addon-docs.stories.storyshot',
            hash: '63efe8baf0322456b50710658d19c25a08a191d6',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/addon-events.stories.storyshot',
            hash: 'e87017fba576b7c4e730f2c2492660c2e5660cd1',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/addon-jest.stories.storyshot',
            hash: '437fd6b56c74008086ceeac69c3b9186f4db31a8',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/addon-knobs.stories.storyshot',
            hash: '3366b7f3e0bc315cde37b8cdd1e98f35bf22a9de',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/button.stories.storyshot',
            hash: '8402ab0e25366c71e0e697711047c262b0b1d84e',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/loaders.stories.storyshot',
            hash: '91af9532caf82f54b32ee44d400aa6f075b54eb5',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/source-loader.stories.storyshot',
            hash: '8ba05f3c3c96d693f73e360558160ada3d5a21d7',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/__snapshots__/welcome.stories.storyshot',
            hash: '8b68425a1eaf0f272d971d0c836b918740b9b6cf',
            ext: '.storyshot',
          },
          {
            file: 'examples/html-kitchen-sink/stories/addon-a11y.stories.js',
            hash: '781ab23595a867e5f9631427ac02286cb2c1e41f',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/stories/addon-actions.stories.js',
            hash: '1ed26062f3886014e7c89aa9deb10b0f076a8902',
            ext: '.js',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/addon-backgrounds.stories.js',
            hash: '91b21d9d6c16e3086eba88225c94a5ea3089bc1c',
            ext: '.js',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/addon-controls.stories.js',
            hash: '034e440b19dee58c1566ed4b8d0a965242677a7e',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/stories/addon-docs.stories.mdx',
            hash: '55df31627bce04a6cd3223f0cdc35bead7b533e7',
            ext: '.mdx',
          },
          {
            file: 'examples/html-kitchen-sink/stories/addon-events.css',
            hash: '1346e8b132c34fcf8d5ef7daf76f127dc394f326',
            ext: '.css',
          },
          {
            file: 'examples/html-kitchen-sink/stories/addon-events.stories.js',
            hash: 'b912d56594f94fc0a7bfd7712d4d29c7af79222d',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/stories/addon-jest.stories.js',
            hash: 'eb80009be86b8f07a543808e1208c1cc2a97c346',
            ext: '.js',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/addon-jest.testresults.json',
            hash: '14cb9a48d08f7befbf57845cd7e4e5e2dd8375f7',
            ext: '.json',
          },
          {
            file: 'examples/html-kitchen-sink/stories/addon-knobs.stories.js',
            hash: 'fa02754df0525e4314f28be7a8fc223fa0fcfc60',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/stories/button.html',
            hash: '112fb4cab1c88346b9cc8399605f439ce6b2d1c4',
            ext: '.html',
          },
          {
            file: 'examples/html-kitchen-sink/stories/button.stories.js',
            hash: 'e75cf85449c9c79ab71472848ab14ff1b010cbfe',
            ext: '.js',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/__snapshots__/Button.stories.storyshot',
            hash: '91d7916acb88ef60b2134ee324b41c52a66b13ea',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/__snapshots__/Header.stories.storyshot',
            hash: 'd43c0b2517a3c8fcd08d62d07af60ff432ffaf93',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/__snapshots__/Page.stories.storyshot',
            hash: '6a9ca27deff4446897e50508c8469c10b6cef6cd',
            ext: '.storyshot',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/assets/code-brackets.svg',
            hash: '73de9477600103d031de4114e20468832cfe0d78',
            ext: '.svg',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/assets/colors.svg',
            hash: '17d58d516e149de0fa83dc6e684ebd2901aeabf7',
            ext: '.svg',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/assets/comments.svg',
            hash: '6493a139f523ee8cceccfb242fd532c0fbfcb5c3',
            ext: '.svg',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/assets/direction.svg',
            hash: '65676ac27229460d03c6cfc929210f4773c37d45',
            ext: '.svg',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/assets/flow.svg',
            hash: '8ac27db403c236ff9f5db8bf023c396570dc8f6b',
            ext: '.svg',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/assets/plugin.svg',
            hash: '29e5c690c0a250f78a5d6f88410fbc14a268e4c2',
            ext: '.svg',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/assets/repo.svg',
            hash: 'f386ee902c1fe318885140acebab6aa2f8549646',
            ext: '.svg',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/assets/stackalt.svg',
            hash: '9b7ad2743506eb0ec12daa9a11ec2321a05d6775',
            ext: '.svg',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/button.css',
            hash: 'dc91dc76370b78ec277e634f8615b67ca55a5145',
            ext: '.css',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/Button.stories.ts',
            hash: '50d2aa30b17e2fea74cddca450354744080b9ada',
            ext: '.ts',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/Button.ts',
            hash: '4da8ab88fa382109edf9fe4de38d49499a050289',
            ext: '.ts',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/header.css',
            hash: 'acadc9ec8c7f4e7ed196d6901c12774a60ac30c1',
            ext: '.css',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/Header.stories.ts',
            hash: '476dfd5b89c43c37a2439772aa9bb58c1ab59ea5',
            ext: '.ts',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/Header.ts',
            hash: '2923e721eb65c44c700469476d298733776ebe2a',
            ext: '.ts',
          },
          {
            file: 'examples/html-kitchen-sink/stories/from-essentials/page.css',
            hash: '51c9d099a139397dcbd6099e08701d3774af7f38',
            ext: '.css',
          },
          {
            file:
              'examples/html-kitchen-sink/stories/from-essentials/Page.stories.ts',
            hash: '14318d63fca0572f11be3fbd85c5b18320eac52b',
            ext: '.ts',
          },
          {
            file: 'examples/html-kitchen-sink/stories/from-essentials/Page.ts',
            hash: '446682036a1631c5f94bf244e49c5ee2881c8a7c',
            ext: '.ts',
          },
          {
            file: 'examples/html-kitchen-sink/stories/loaders.stories.js',
            hash: 'ae8b4616195d7287ede7a86d8219a3d52855a373',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/stories/logo.svg',
            hash: '4afc49cee5edc8105c820cd51c5ad91fd7b3eb9b',
            ext: '.svg',
          },
          {
            file: 'examples/html-kitchen-sink/stories/source-loader.stories.js',
            hash: 'f1170d8293b83d0ebcb95becefff896e3226787f',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/stories/welcome.css',
            hash: 'f6b49bab864f405456e30796802923befed66bc4',
            ext: '.css',
          },
          {
            file: 'examples/html-kitchen-sink/stories/welcome.html',
            hash: 'af62ae262a1aacb8bb9e076792950e39885d8b91',
            ext: '.html',
          },
          {
            file: 'examples/html-kitchen-sink/stories/welcome.stories.js',
            hash: '6410a83ee835911f00778f12d45685f84d7052a8',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/tests/addon-jest.config.json',
            hash: 'e6e886d95ac2e86376894799a01fd9df57eb876d',
            ext: '.json',
          },
          {
            file: 'examples/html-kitchen-sink/tests/addon-jest.test.js',
            hash: '0b4fa6ee89f87f44c92ebe21d07723b3e3a29106',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/tests/htmlshots.test.js',
            hash: 'f7d22dfc52abafb045ac33b569327b6daaf9e5ae',
            ext: '.js',
          },
          {
            file: 'examples/html-kitchen-sink/typings.d.ts',
            hash: 'c977a48950ed6364ea36b5b197293b46fc7bb239',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/example-react-ts-webpack4': {
      name: '@storybook/example-react-ts-webpack4',
      type: 'lib',
      data: {
        root: 'examples/react-ts-webpack4',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          debug: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'debug',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/react-ts-webpack4/main.ts',
            hash: '14131c236a8e5e3b67e5e5f1994e0ce1038ca830',
            ext: '.ts',
          },
          {
            file: 'examples/react-ts-webpack4/package.json',
            hash: 'c9f0ba4e7fd4c503e5bc467425cd026bb5699836',
            ext: '.json',
          },
          {
            file: 'examples/react-ts-webpack4/README.md',
            hash: '70d4f2ccb02b5a44c42c44620852baeeca80aecc',
            ext: '.md',
          },
          {
            file: 'examples/react-ts-webpack4/src/button.stories.tsx',
            hash: '1b86f8635ff7ba07961e11a8007ed1334fc9dfa4',
            ext: '.tsx',
          },
          {
            file: 'examples/react-ts-webpack4/src/button.tsx',
            hash: 'f3c9ee6b83ea54aa83827815b0be4fd705756a06',
            ext: '.tsx',
          },
          {
            file: 'examples/react-ts-webpack4/src/emoji-button.js',
            hash: '716afa1238c0627aa53e5617c8aec37401256fd5',
            ext: '.js',
          },
          {
            file: 'examples/react-ts-webpack4/src/emoji-button.stories.js',
            hash: '1e0fd80611343aa494de876a2a1d466c9a50591a',
            ext: '.js',
          },
          {
            file: 'examples/react-ts-webpack4/tsconfig.json',
            hash: '5447ee7e4d86046ddd72d6a526a72bf6208d20a3',
            ext: '.json',
          },
        ],
      },
    },
    'riot-example': {
      name: 'riot-example',
      type: 'lib',
      data: {
        root: 'examples/riot-kitchen-sink',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          dev: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'dev',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/riot-kitchen-sink/.gitignore',
            hash: '6c96c5cff124271309d717aa6a74c99fa3cdd455',
            ext: '',
          },
          {
            file: 'examples/riot-kitchen-sink/.storybook/main.js',
            hash: 'f58eaf285d703003f489c8c266611d46e3199cf8',
            ext: '.js',
          },
          {
            file: 'examples/riot-kitchen-sink/jest.config.js',
            hash: '6cc92c000721b2d3d541fea9ed1afd3f5fbb4e16',
            ext: '.js',
          },
          {
            file: 'examples/riot-kitchen-sink/package.json',
            hash: '06a4ea3d997912884bb7a92ec624d64765f75d76',
            ext: '.json',
          },
          {
            file: 'examples/riot-kitchen-sink/public/favicon.ico',
            hash: '4f929bca31aadc003397e5739cc6dc39c1d496aa',
            ext: '.ico',
          },
          {
            file: 'examples/riot-kitchen-sink/public/logo.png',
            hash: 'fbfe95e79728bccce0ba20a3993644b4bb28fb0e',
            ext: '.png',
          },
          {
            file: 'examples/riot-kitchen-sink/README.md',
            hash: 'cc4306faac11111e54f4c6d22a2b7748064a5976',
            ext: '.md',
          },
          {
            file: 'examples/riot-kitchen-sink/riotshots.test.js',
            hash: '02d25b4b7ee5c0cb88e4e64efe37401b45d96f1d',
            ext: '.js',
          },
          {
            file: 'examples/riot-kitchen-sink/src/App.tag',
            hash: 'ff464566c5c12d43390a72ce9793bd1c29ae09d0',
            ext: '.tag',
          },
          {
            file: 'examples/riot-kitchen-sink/src/index.js',
            hash: 'daadca3dd1b985eb7b3cdaef2004334ec7c4ad1d',
            ext: '.js',
          },
          {
            file: 'examples/riot-kitchen-sink/src/logo.png',
            hash: 'fbfe95e79728bccce0ba20a3993644b4bb28fb0e',
            ext: '.png',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/__snapshots__/addon-actions.stories.storyshot',
            hash: 'd45cb2881b25dab6699206eb2167074aad28d6f2',
            ext: '.storyshot',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/__snapshots__/addon-backgrounds.stories.storyshot',
            hash: 'aeea57e09afef88362ae756332a9f099015907fb',
            ext: '.storyshot',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/__snapshots__/addon-knobs.stories.storyshot',
            hash: 'b459f6778c772f8d71179b686a6f6c54dc68b958',
            ext: '.storyshot',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/__snapshots__/addon-links.stories.storyshot',
            hash: 'ddccd86f6bcd5cba68070649b7ca5389a71b9a99',
            ext: '.storyshot',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/__snapshots__/core.stories.storyshot',
            hash: 'f273095490f2541c5afbe769aefc78f5ef6a684c',
            ext: '.storyshot',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/__snapshots__/nested-tags.stories.storyshot',
            hash: 'c571daeaacd6dca4813c49db40447f5e1c94d6e5',
            ext: '.storyshot',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/__snapshots__/story-code.stories.storyshot',
            hash: '82ab91deac809d7864f81f852db903cd34fdc2c5',
            ext: '.storyshot',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/addon-actions.stories.js',
            hash: '0c6d41b6324273bbdb736347c97c763849e0605b',
            ext: '.js',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/addon-backgrounds.stories.js',
            hash: '8f658a0bd2199f74252b0d7b196ba459450ec70e',
            ext: '.js',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/addon-knobs.stories.js',
            hash: 'b2f9b65a0cbabeab7d70062aec5358b546b6244d',
            ext: '.js',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/addon-links.stories.js',
            hash: 'bf494beaa8821d03c26aa41e1bda96eeb8bb7fec',
            ext: '.js',
          },
          {
            file: 'examples/riot-kitchen-sink/src/stories/AnotherTest.tag',
            hash: 'c6e9d75b657a459d63d14cc9e96fdf5189c1d3ec',
            ext: '.tag',
          },
          {
            file: 'examples/riot-kitchen-sink/src/stories/Button.txt',
            hash: '50757ef8d8437e5917fb496be832f13dfd99801f',
            ext: '.txt',
          },
          {
            file: 'examples/riot-kitchen-sink/src/stories/core.stories.js',
            hash: '124446efd20c3b56cf7517d0127a6b00dea394a1',
            ext: '.js',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/nested-tags.stories.js',
            hash: 'cb7f0463eda24b3534014cd4f25dc83d2ffbbcf9',
            ext: '.js',
          },
          {
            file: 'examples/riot-kitchen-sink/src/stories/SimpleTest.txt',
            hash: 'd9afbd766b639a8a1a86b1064bbcd10dde6549dc',
            ext: '.txt',
          },
          {
            file:
              'examples/riot-kitchen-sink/src/stories/story-code.stories.js',
            hash: '86988519a3d3552697eb5f11d6f356de902a14a6',
            ext: '.js',
          },
          {
            file: 'examples/riot-kitchen-sink/src/stories/Welcome.tag',
            hash: 'ace441a10860a9ca72de498610bb830f795c152d',
            ext: '.tag',
          },
        ],
      },
    },
    'cra-kitchen-sink': {
      name: 'cra-kitchen-sink',
      type: 'lib',
      data: {
        root: 'examples/cra-kitchen-sink',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          eject: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'eject',
            },
          },
          start: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'start',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
          test: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/cra-kitchen-sink/.env',
            hash: 'e70a111949cd0f3a2de095887aff0fd2b2caacb9',
            ext: '',
          },
          {
            file: 'examples/cra-kitchen-sink/.storybook/main.js',
            hash: '2e2bf4c6155ec234ec4dd5dca962851fce883011',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/.storybook/manager.js',
            hash: 'a53f23565dd2755198976d0bda78430322f988ef',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/.storybook/preview.js',
            hash: 'e484476c0b67fcce3ad8ec384302a0cc4bc399ea',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/package.json',
            hash: '0bb2d73a4296978550749d49fa4532be9f0b9da6',
            ext: '.json',
          },
          {
            file: 'examples/cra-kitchen-sink/public/favicon.ico',
            hash: '5c125de5d897c1ff5692a656485b3216123dcd89',
            ext: '.ico',
          },
          {
            file: 'examples/cra-kitchen-sink/public/index.html',
            hash: 'ec668f00d89c2a4bdbc7c450b7fac91d0d30064d',
            ext: '.html',
          },
          {
            file: 'examples/cra-kitchen-sink/src/App.css',
            hash: '426762e6e5c2fc251d3e279e6606b76129b761af',
            ext: '.css',
          },
          {
            file: 'examples/cra-kitchen-sink/src/App.js',
            hash: '2c49d780e9a9755b9a570b0f425e3317f6ebf935',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/src/base.css',
            hash: '81681882f2d393c29f36bde75b52e4a13fa5c826',
            ext: '.css',
          },
          {
            file: 'examples/cra-kitchen-sink/src/components/Container.js',
            hash: 'efd894da18a1f18e2255daec48c8dd84f75a3782',
            ext: '.js',
          },
          {
            file:
              'examples/cra-kitchen-sink/src/components/FastRefreshExample.js',
            hash: 'd9e382ffa97cf5c4235dd859bedb6191cd0756f6',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/src/components/LifecycleLogger.js',
            hash: 'a98a6585ab9a7850d00ce0e09c8495d1cffe5f4c',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/src/index.css',
            hash: 'b4cc7250b98cb3f1a2dd5bec134296c6942344d9',
            ext: '.css',
          },
          {
            file: 'examples/cra-kitchen-sink/src/index.js',
            hash: '0d9b8750cfaf1158a0ee050ee6016bcadaabd5e0',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/src/logo.svg',
            hash: '9dfc1c058cebbef8b891c5062be6f31033d7d186',
            ext: '.svg',
          },
          {
            file: 'examples/cra-kitchen-sink/src/stories/App.stories.js',
            hash: '5902417523b9ece849f5097c142b2764ab1e4a80',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/src/stories/button.stories.js',
            hash: 'f1e3145ef49509abd180cd9471777a6303458f86',
            ext: '.js',
          },
          {
            file:
              'examples/cra-kitchen-sink/src/stories/cra-dynamic-import.stories.js',
            hash: '8e0e22e94b2fdcb7ebdf59ccd4186181ed9d507e',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/src/stories/cra-svgr.stories.js',
            hash: '044c8df8d416f31dd133446334523df05674c52f',
            ext: '.js',
          },
          {
            file:
              'examples/cra-kitchen-sink/src/stories/fast-refresh.stories.js',
            hash: 'f96f85877dcfe6d843d86d8fc8800ac5f0acf4c6',
            ext: '.js',
          },
          {
            file:
              'examples/cra-kitchen-sink/src/stories/force-rerender.stories.js',
            hash: '2635e6739ffdaf3d5d7b3b03f6dcc9e3ab5387c8',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/src/stories/Lifecycle.stories.js',
            hash: '0a8fbaceb3ff0793e337ed3ad03b393197c8d6f5',
            ext: '.js',
          },
          {
            file:
              'examples/cra-kitchen-sink/src/stories/long-description.stories.js',
            hash: 'd456dfd3810094a1febdb56f2c7f6c19d5150ae2',
            ext: '.js',
          },
          {
            file: 'examples/cra-kitchen-sink/src/stories/test.stories.mdx',
            hash: '6d296277b347dd289a9037b164e0f85aea12c2a9',
            ext: '.mdx',
          },
          {
            file: 'examples/cra-kitchen-sink/src/stories/welcome.stories.js',
            hash: '878844fa562c1afec0c85266459174518ca4566a',
            ext: '.js',
          },
        ],
      },
    },
    'rax-kitchen-sink': {
      name: 'rax-kitchen-sink',
      type: 'lib',
      data: {
        root: 'examples/rax-kitchen-sink',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          start: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'start',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/rax-kitchen-sink/.env',
            hash: 'e70a111949cd0f3a2de095887aff0fd2b2caacb9',
            ext: '',
          },
          {
            file: 'examples/rax-kitchen-sink/.eslintrc.js',
            hash: '1fb6998cdd4a7b8a0dd96559119a2f5fe58cc47b',
            ext: '.js',
          },
          {
            file: 'examples/rax-kitchen-sink/.gitignore',
            hash: '3c52f29c750dc9f4bc9c7669ed0343b9040ce2aa',
            ext: '',
          },
          {
            file: 'examples/rax-kitchen-sink/.storybook/main.js',
            hash: '45906ad6cec35ff7a1da044e0b6e38dd3060f42a',
            ext: '.js',
          },
          {
            file: 'examples/rax-kitchen-sink/.storybook/manager.js',
            hash: 'bd96ff13ccb7c5a413c06f940bb98172d8693401',
            ext: '.js',
          },
          {
            file: 'examples/rax-kitchen-sink/babel.config.js',
            hash: '60ee7951d28ceaa34a4efc103b2004915d3e4584',
            ext: '.js',
          },
          {
            file: 'examples/rax-kitchen-sink/build.json',
            hash: 'b7f0e676bf6b097457b6c30b1199177688977dac',
            ext: '.json',
          },
          {
            file: 'examples/rax-kitchen-sink/package.json',
            hash: '217ee6961a698cc0626eaea0ff57b3f38db9bc30',
            ext: '.json',
          },
          {
            file: 'examples/rax-kitchen-sink/README.md',
            hash: 'cb2dab3ba9ce97d50cd17f40dba52f8cdcc81827',
            ext: '.md',
          },
          {
            file: 'examples/rax-kitchen-sink/src/app.js',
            hash: '10501ae7fbde24cbcca5ac546f113fdbf49a1db0',
            ext: '.js',
          },
          {
            file: 'examples/rax-kitchen-sink/src/components/App/index.js',
            hash: '32805bfb831ed709470aa8a1e222eb2d5b2d1509',
            ext: '.js',
          },
          {
            file: 'examples/rax-kitchen-sink/src/document/index.jsx',
            hash: '18347d00dc1a3cf8b306b4b1a3e3010c17709bbf',
            ext: '.jsx',
          },
          {
            file: 'examples/rax-kitchen-sink/src/stories/addon-a11y.stories.js',
            hash: '6016d0d01640ec338765597d4637468805822466',
            ext: '.js',
          },
          {
            file:
              'examples/rax-kitchen-sink/src/stories/addon-actions.stories.js',
            hash: 'a5d6a1fc0539eb3cba715caae446ab852a1def11',
            ext: '.js',
          },
          {
            file:
              'examples/rax-kitchen-sink/src/stories/addon-knobs.stories.js',
            hash: '2777e6a6e6e0296a49103bcfcf1fe2a2105c9751',
            ext: '.js',
          },
          {
            file: 'examples/rax-kitchen-sink/src/stories/index.stories.js',
            hash: '02ad01279cc1ac2952c6ef37246d00f3dbef8c60',
            ext: '.js',
          },
        ],
      },
    },
    'vue-example': {
      name: 'vue-example',
      type: 'lib',
      data: {
        root: 'examples/vue-kitchen-sink',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          dev: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'dev',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/vue-kitchen-sink/.babelrc',
            hash: '9c25278cd9b1df4adbd63dcb03e838993b86b8e7',
            ext: '',
          },
          {
            file: 'examples/vue-kitchen-sink/.gitignore',
            hash: '6c96c5cff124271309d717aa6a74c99fa3cdd455',
            ext: '',
          },
          {
            file: 'examples/vue-kitchen-sink/.storybook/main.js',
            hash: '0327c43cc0da93429a6eda51223d2e41e49d9e13',
            ext: '.js',
          },
          {
            file: 'examples/vue-kitchen-sink/.storybook/preview.js',
            hash: '65ca5b85929d9fe5a05bdd3fcd784e0145dbb7de',
            ext: '.js',
          },
          {
            file: 'examples/vue-kitchen-sink/index.html',
            hash: '8e597cae110438ae27493d94cebef3a22ea6e88a',
            ext: '.html',
          },
          {
            file: 'examples/vue-kitchen-sink/jest.config.js',
            hash: '5440e27d8c1f4e98afb851a2e9b978c4e11eca6d',
            ext: '.js',
          },
          {
            file: 'examples/vue-kitchen-sink/package.json',
            hash: '1f83c1849a99761949e3f1dc73c46243ce727037',
            ext: '.json',
          },
          {
            file: 'examples/vue-kitchen-sink/public/favicon.ico',
            hash: '74dd2624cbe44e13457fd7e85fafe6e563482444',
            ext: '.ico',
          },
          {
            file: 'examples/vue-kitchen-sink/README.md',
            hash: 'bf042ddc891ccf85987be7094fe31e38541b333c',
            ext: '.md',
          },
          {
            file: 'examples/vue-kitchen-sink/src/App.vue',
            hash: '06f14e40a8caff75c3a3b35f6437f8bb6a960369',
            ext: '.vue',
          },
          {
            file: 'examples/vue-kitchen-sink/src/index.js',
            hash: 'f4e9498b4599210eb33852a9f10a0aad1034096b',
            ext: '.js',
          },
          {
            file: 'examples/vue-kitchen-sink/src/logo.png',
            hash: 'dd735898997753eeeeb310e27711ffea84a0b8ed',
            ext: '.png',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/addon-actions.stories.storyshot',
            hash: '96a1f741569712925508f40253b85ea9015ded7d',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/addon-backgrounds.stories.storyshot',
            hash: 'b13aebbc5830c353d0f9c2411070c1f87d164785',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/addon-controls.stories.storyshot',
            hash: '9e9705b5c650b94d3b11a2d4c2acb193cb6564b5',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/addon-knobs.stories.storyshot',
            hash: 'ac001b7686ca8eb1a729d7438c41a1ba27e0c15f',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/addon-links.stories.storyshot',
            hash: '829b529042e95a077967240ca0bcab43eac66744',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/core-errors.stories.storyshot',
            hash: '7c1f2d2bb0b6df5e8531239c5103966aadcb4654',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/core-template.stories.storyshot',
            hash: 'd4da5fd31ce676de79d730249948f467ea5a6ea5',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/core.stories.storyshot',
            hash: 'a8db6fb38ee03ca156a89fd52841387482cf0743',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/custom-decorators.stories.storyshot',
            hash: 'd1b0a347facd515c1c232a9069b82abf4b6fca7c',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/__snapshots__/custom-rendering.stories.storyshot',
            hash: 'cea7424ece37c9db26c2d6e98eaa18b8fbc2f33b',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/addon-actions.stories.js',
            hash: '2e0ac18b964cbe41a796cc75b915efa5facf749a',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/addon-backgrounds.stories.js',
            hash: '5400daf8829e10b12ae112a4df9de19194491866',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/addon-controls.stories.js',
            hash: '7ba2f091e1c02bc7298f87d19c26c526e779b3d6',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/addon-controls.stories.mdx',
            hash: '213be4c2aedec70db2b1b63015f9e2e40555e293',
            ext: '.mdx',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/addon-docs.stories.mdx',
            hash: '201a1e89c2c9d769d34bcd0997026b5353dd7fc0',
            ext: '.mdx',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/addon-knobs.stories.js',
            hash: '36fcb6ddc51c04d020a8ac65dadb6d0e3506ba02',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/addon-links.stories.js',
            hash: 'ff4bf352b05bbe68c0e5525006cd491425cb0f2c',
            ext: '.js',
          },
          {
            file: 'examples/vue-kitchen-sink/src/stories/Button.vue',
            hash: '4a20dfb5f9ace90340da437e06fc1574d83a85f9',
            ext: '.vue',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/__snapshots__/app.stories.storyshot',
            hash: '2b30c7b211467167aafdbb812bc62693a7ffb802',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/__snapshots__/button-ts.stories.storyshot',
            hash: '7c84cb5492f3f753e29a60e6ea437b5721595383',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/__snapshots__/button.stories.storyshot',
            hash: 'e89a25c25a84fc376c706e425df280fd527ba8f5',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/__snapshots__/info-button.stories.storyshot',
            hash: 'cb3a3a3b8f0c08c582a38fe33d7e28264b2fb711',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/__snapshots__/welcome.stories.storyshot',
            hash: '0122e0d931430544a8ccd275626b84a3986a62f4',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/app.stories.js',
            hash: '229c3457cfe43fafba88c119e73a713d7959c819',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/button-ts.stories.js',
            hash: 'caab5dd3642b3cef6c4ec9cb52274c165f1ac934',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/button.stories.js',
            hash: '36ed1818287f61e201e1a3ca63b425cd93d7f6ae',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/ButtonTs.vue',
            hash: 'd316faf20c8f7fc9557b2d16e02fc3418080f0b9',
            ext: '.vue',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/info-button.stories.js',
            hash: 'fba6f26201ec321bc4ccd338952d9c1c03cfdbe1',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/InfoButton.vue',
            hash: '595bf40175895963558ac4093ce7ededd7175c7f',
            ext: '.vue',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/components/welcome.stories.js',
            hash: 'b40eaf5bdecd5b3bf7cc154b463bb3ff7e630e2d',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/core-errors.stories.js',
            hash: '3b5c1245bfe72b13fa4c7b690bfde7cb63d4df16',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/core-template.stories.js',
            hash: '2cbb8972babf7175be5149cb4d401b6f0d2b3efa',
            ext: '.js',
          },
          {
            file: 'examples/vue-kitchen-sink/src/stories/core.stories.js',
            hash: '7f328fe356ed16dead94340f10c8d9df1547ac74',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/custom-decorators.stories.js',
            hash: '06b7c5dc7d411bf49fca00c72ca61366e770192e',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/custom-rendering.stories.js',
            hash: '7d6d97193d73bd558d2599c0173d1143818506b8',
            ext: '.js',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/issues/11839-undefined-bolean-prop/__snapshots__/index.stories.storyshot',
            hash: 'dfc34df7a84f6a9f9c50937b27f3528d1671ec3e',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/issues/11839-undefined-bolean-prop/component.vue',
            hash: '6ca3dd05d936ba43a578007994fbca7c8b25f827',
            ext: '.vue',
          },
          {
            file:
              'examples/vue-kitchen-sink/src/stories/issues/11839-undefined-bolean-prop/index.stories.js',
            hash: 'c63b77fe2d22481329d8ecd4e0bcd099ecd7a537',
            ext: '.js',
          },
          {
            file: 'examples/vue-kitchen-sink/src/stories/Welcome.vue',
            hash: 'd3ec62eac551dfd2ae330baefe067be89e50d287',
            ext: '.vue',
          },
          {
            file: 'examples/vue-kitchen-sink/vueshots.test.js',
            hash: '9b5965bc0eaa4503fe92f7323e33183e466114e7',
            ext: '.js',
          },
          {
            file: 'examples/vue-kitchen-sink/webpack.config.js',
            hash: 'cf390b2b71ff26fc8144bae129bd9e227fe39815',
            ext: '.js',
          },
        ],
      },
    },
    '@storybook/addon-decorator': {
      name: '@storybook/addon-decorator',
      type: 'lib',
      data: {
        root: 'dev-kits/addon-decorator',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'dev-kits/addon-decorator/package.json',
            hash: '69076817c8ad1845e412e3141527263f4ba0f05f',
            ext: '.json',
          },
          {
            file: 'dev-kits/addon-decorator/README.md',
            hash: 'd3a7de7499c20a5a8d7d131cf655a0bec64aaccb',
            ext: '.md',
          },
          {
            file: 'dev-kits/addon-decorator/src/constants.ts',
            hash: 'a8767864188bf79fac47112e4b93b0b8f868e74f',
            ext: '.ts',
          },
          {
            file: 'dev-kits/addon-decorator/src/index.ts',
            hash: '73952b007c492c31992673efdd96d16322f53af9',
            ext: '.ts',
          },
          {
            file: 'dev-kits/addon-decorator/src/typings.d.ts',
            hash: '5d85a4ae4c0a4ed38a008c747d30997059a55d32',
            ext: '.ts',
          },
          {
            file: 'dev-kits/addon-decorator/tsconfig.json',
            hash: '8876bb6737a1dbf74aa8792dca842e1cdb13423a',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-parameter': {
      name: '@storybook/addon-parameter',
      type: 'lib',
      data: {
        root: 'dev-kits/addon-parameter',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'dev-kits/addon-parameter/package.json',
            hash: 'd18503f206f5fbe54ff386cfa76fcc7bbad67c46',
            ext: '.json',
          },
          {
            file: 'dev-kits/addon-parameter/README.md',
            hash: 'eb4f75396669cff1b1500f8b0aa950caa395bbfe',
            ext: '.md',
          },
          {
            file: 'dev-kits/addon-parameter/register.js',
            hash: 'cc38cb06f1f2a1cb5ece31b09c024e33d67a9930',
            ext: '.js',
          },
          {
            file: 'dev-kits/addon-parameter/src/constants.ts',
            hash: 'b23e22343ad949072a3020d92d160194f9c33e68',
            ext: '.ts',
          },
          {
            file: 'dev-kits/addon-parameter/src/register.tsx',
            hash: '3bd8f0d56258f161f4e499a08f1d866226a123b4',
            ext: '.tsx',
          },
          {
            file: 'dev-kits/addon-parameter/tsconfig.json',
            hash: '8876bb6737a1dbf74aa8792dca842e1cdb13423a',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-roundtrip': {
      name: '@storybook/addon-roundtrip',
      type: 'lib',
      data: {
        root: 'dev-kits/addon-roundtrip',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'dev-kits/addon-roundtrip/package.json',
            hash: '069c9d86990ed95abab70d65596ef71ce88a9692',
            ext: '.json',
          },
          {
            file: 'dev-kits/addon-roundtrip/README.md',
            hash: '2ee7ad68b59d7d656015e2c698357d5f5025d740',
            ext: '.md',
          },
          {
            file: 'dev-kits/addon-roundtrip/register.js',
            hash: 'cc38cb06f1f2a1cb5ece31b09c024e33d67a9930',
            ext: '.js',
          },
          {
            file: 'dev-kits/addon-roundtrip/src/constants.ts',
            hash: 'de7ba424d63b31e832d6484d2429f654453fda5f',
            ext: '.ts',
          },
          {
            file: 'dev-kits/addon-roundtrip/src/index.ts',
            hash: '6bbb89a2f3cf24da64aef1c459ddcabbcbce017c',
            ext: '.ts',
          },
          {
            file: 'dev-kits/addon-roundtrip/src/panel.tsx',
            hash: '52892f3bae0e99bb3e142edf3517413496ff3718',
            ext: '.tsx',
          },
          {
            file: 'dev-kits/addon-roundtrip/src/register.tsx',
            hash: '96562f944e8753c212aef8b33d636c06c5ef198e',
            ext: '.tsx',
          },
          {
            file: 'dev-kits/addon-roundtrip/tsconfig.json',
            hash: '8876bb6737a1dbf74aa8792dca842e1cdb13423a',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-google-analytics': {
      name: '@storybook/addon-google-analytics',
      type: 'lib',
      data: {
        root: 'addons/google-analytics',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/google-analytics/package.json',
            hash: 'e38f1d4ece9826676c8c8983582161f51ddda054',
            ext: '.json',
          },
          {
            file: 'addons/google-analytics/README.md',
            hash: '2dc10d17e620c55be44f804398b1acfe52dc6da5',
            ext: '.md',
          },
          {
            file: 'addons/google-analytics/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/google-analytics/src/register.ts',
            hash: 'b2c85d647726cb28899fc487a84cc2051cb0eca6',
            ext: '.ts',
          },
          {
            file: 'addons/google-analytics/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'addons/google-analytics/tsconfig.json',
            hash: 'd1ee4fc75941ea63fc45ba234dca37d9882e1620',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/channel-postmessage': {
      name: '@storybook/channel-postmessage',
      type: 'lib',
      data: {
        root: 'lib/channel-postmessage',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/channel-postmessage/package.json',
            hash: '1f08992730d698286a0f01055fbaed5023f45f0f',
            ext: '.json',
          },
          {
            file: 'lib/channel-postmessage/README.md',
            hash: '938468ef2073f5df0443dba69387649eaf96cfb7',
            ext: '.md',
          },
          {
            file: 'lib/channel-postmessage/src/index.ts',
            hash: '00d243bc5c292c9884d8de8b4c637568b2ab506a',
            ext: '.ts',
          },
          {
            file: 'lib/channel-postmessage/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'lib/channel-postmessage/tsconfig.json',
            hash: '61cbbd6356c3da4d4cfe0d110704238935c617ae',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/channel-websocket': {
      name: '@storybook/channel-websocket',
      type: 'lib',
      data: {
        root: 'lib/channel-websocket',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/channel-websocket/package.json',
            hash: '77db4548c721a5cfe86c14f42390b39c059515ba',
            ext: '.json',
          },
          {
            file: 'lib/channel-websocket/README.md',
            hash: 'c354ccb521ba72fae2aaf9af027e4c8fc5ed81cd',
            ext: '.md',
          },
          {
            file: 'lib/channel-websocket/src/index.ts',
            hash: '6b824160a25ef3337b67e5f1ce962d620fbd18dd',
            ext: '.ts',
          },
          {
            file: 'lib/channel-websocket/src/typings.d.ts',
            hash: '8f141185b8aee1a73713d0ffb3704826e3783d88',
            ext: '.ts',
          },
          {
            file: 'lib/channel-websocket/tsconfig.json',
            hash: '1b75df12e9421be88d8849ac0bbc9876c0597a4d',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-design-assets': {
      name: '@storybook/addon-design-assets',
      type: 'lib',
      data: {
        root: 'addons/design-assets',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/design-assets/package.json',
            hash: '0eaf6ca33f71345bb1a31d84bcd884852515ce0a',
            ext: '.json',
          },
          {
            file: 'addons/design-assets/preset.js',
            hash: 'a1382ab7c27cef6d6deb55edf426bd75b414cb3f',
            ext: '.js',
          },
          {
            file: 'addons/design-assets/README.md',
            hash: '9f33edf6063b22b42c3a86d3c2bf325cf39f3dca',
            ext: '.md',
          },
          {
            file: 'addons/design-assets/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/design-assets/src/constants.ts',
            hash: '67d462acd8a6e69c301af4e29065b62151cfbc0c',
            ext: '.ts',
          },
          {
            file: 'addons/design-assets/src/panel.tsx',
            hash: '120a7b701c416d9087910e8ccb29a5be5b3685db',
            ext: '.tsx',
          },
          {
            file: 'addons/design-assets/src/register.tsx',
            hash: 'f13619c654bbcab49bee1fa1f32ff27508f65f04',
            ext: '.tsx',
          },
          {
            file: 'addons/design-assets/tsconfig.json',
            hash: 'd1ee4fc75941ea63fc45ba234dca37d9882e1620',
            ext: '.json',
          },
        ],
      },
    },
    'angular-cli': {
      name: 'angular-cli',
      type: 'lib',
      data: {
        root: 'examples/angular-cli',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'prebuild-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prebuild-storybook',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          'docs:json': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'docs:json',
            },
          },
          e2e: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'e2e',
            },
          },
          ng: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'ng',
            },
          },
          start: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'start',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
          'storybook:prebuild': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook:prebuild',
            },
          },
          test: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test',
            },
          },
          'test:coverage': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test:coverage',
            },
          },
          'test:generate-output': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test:generate-output',
            },
          },
          'test:watch': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test:watch',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/angular-cli/.editorconfig',
            hash: '6e87a003da89defd554080af5af93600cc9f91fe',
            ext: '',
          },
          {
            file: 'examples/angular-cli/.env',
            hash: 'd24e628d281058029b0f5f6edb2e3ca5de99216e',
            ext: '',
          },
          {
            file: 'examples/angular-cli/.eslintignore',
            hash: '6c5a2da47b0829f42a657743dfa63b66b35600f8',
            ext: '',
          },
          {
            file: 'examples/angular-cli/.eslintrc.js',
            hash: '4de262aa2700aa2bfa471d6c0dca1a3678f7727a',
            ext: '.js',
          },
          {
            file: 'examples/angular-cli/.gitignore',
            hash: '7a5ad868aa59d57e39eac67bac6b788feb6ce4a8',
            ext: '',
          },
          {
            file: 'examples/angular-cli/.storybook/main.js',
            hash: '7897fd5e4341b2ee3266e65c1a9c6cab7f5c50e3',
            ext: '.js',
          },
          {
            file: 'examples/angular-cli/.storybook/preview.ts',
            hash: '1f2220621e701aecefd2c35856fc3a2b4b403958',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/.storybook/tsconfig.json',
            hash: '4de48e82d32ff677e92076c45d214a50fb87a80b',
            ext: '.json',
          },
          {
            file: 'examples/angular-cli/angular.json',
            hash: 'cc608887c369c9e2e86e45cf639ac19e646a18c7',
            ext: '.json',
          },
          {
            file: 'examples/angular-cli/angularshots.test.js',
            hash: 'a7532588da4f9441e950d1f62c8ad1e08b80e3ad',
            ext: '.js',
          },
          {
            file: 'examples/angular-cli/e2e/app.e2e-spec.ts',
            hash: '33a23c8b6cff3b083cf6396b51b8985d47e506b4',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/e2e/app.po.ts',
            hash: 'eb663398fd58a6066bcd036c678a6306c2916216',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/e2e/tsconfig.e2e.json',
            hash: '1d9e5edf0965125ddb36005861f4c4b8cb0ddff1',
            ext: '.json',
          },
          {
            file: 'examples/angular-cli/jest-config/globalMocks.ts',
            hash: '712539727a02fb2d963b4f8da29c26c8cc1b4a64',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/jest-config/setup.ts',
            hash: 'bcbed8ce167f15fbbef90bec77b7997219f5d894',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/jest.addon-config.js',
            hash: '9f8d61a2c0d695a55f026c90e72fd833da391612',
            ext: '.js',
          },
          {
            file: 'examples/angular-cli/jest.config.js',
            hash: '422ede7df832980d48b37acba1adc0b32cc742ba',
            ext: '.js',
          },
          {
            file: 'examples/angular-cli/package.json',
            hash: '97cc7c98a6e162df1ab66fb398f81fe248803a8c',
            ext: '.json',
          },
          {
            file: 'examples/angular-cli/protractor.conf.js',
            hash: '7699c9c53812966bd65630a81b39960d1f36ff71',
            ext: '.js',
          },
          {
            file: 'examples/angular-cli/README.md',
            hash: 'abde1422bbbf7fcec5cfba44be6500823ea852e0',
            ext: '.md',
          },
          {
            file: 'examples/angular-cli/src/app/app.component.html',
            hash: '6fc3931e8da2545e06762452fee24432aa466d09',
            ext: '.html',
          },
          {
            file: 'examples/angular-cli/src/app/app.component.scss',
            hash: '8b20dbe44d7ac95b50969768a76c7a185a5e8e0d',
            ext: '.scss',
          },
          {
            file: 'examples/angular-cli/src/app/app.component.spec.ts',
            hash: 'b16e2844467843adf8bfeb09bfeec65215dd04b4',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/app/app.component.ts',
            hash: 'cd7b01613d859733db282443be61bcf76112c5d3',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/app/app.module.ts',
            hash: '5ce7811a4c03da167bd77a37c5de07e61a488b71',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/assets/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'examples/angular-cli/src/assets/favicon.ico',
            hash: '8081c7ceaf2be08bf59010158c586170d9d2d517',
            ext: '.ico',
          },
          {
            file: 'examples/angular-cli/src/commons/_colors.scss',
            hash: '1822b861e8bec26c62cf24a20ffea1d907c70a50',
            ext: '.scss',
          },
          {
            file: 'examples/angular-cli/src/cssWarning.ts',
            hash: '924b26982335f86a8f1241119f0a1b8ec8e060c0',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/environments/environment.prod.ts',
            hash: 'c9669790be176ac85a5d8c11278875c2f52dc507',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/environments/environment.ts',
            hash: 'cf6bba0df389cc9e7e473f2629910d225734df49',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/index.html',
            hash: '4d9441d0f323ee1290b5cc77a336d018f88810eb',
            ext: '.html',
          },
          {
            file: 'examples/angular-cli/src/karma.ts',
            hash: '6d9bcf8f0f42a624daaeb253dc872b1c2792189f',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/main.ts',
            hash: 'a9ca1caf8ceebeb432bbf02b6a2b18378653fbd0',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/polyfills.ts',
            hash: 'f73afc37ee5d42c64acc92a14ebf75a1124e70c0',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/__snapshots__/welcome-angular.stories.storyshot',
            hash: 'fab90a3835e24bd44e254578a15148fdce3966b0',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/__snapshots__/welcome-storybook.stories.storyshot',
            hash: '13b8459513f80e76c6e06b23c98e702ed7974ef6',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/actions/__snapshots__/addon-actions.stories.storyshot',
            hash: 'ce3a20fae52a5ceb56c562200deb88803d714327',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/actions/addon-actions.stories.ts',
            hash: 'a18426f42ada9c87d39f79f11229d6deeba09296',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/backgrounds/__snapshots__/addon-background.stories.storyshot',
            hash: '0eb2c97c69ea5504b5bdbf667b1aed1c922920fd',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/backgrounds/addon-background.stories.ts',
            hash: 'cddc9d157043623b7e1a86078ae52dd7642a4783',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/controls/__snapshots__/addon-controls.stories.storyshot',
            hash: '3799b4c64552b8884b406ec0cd4d21cc1944db6c',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/controls/addon-controls.stories.ts',
            hash: '4b26dfa5722bfbb7dbf5864251f37a6147d476cf',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/__snapshots__/addon-docs.stories.storyshot',
            hash: '70939d88e5af5956e68d4e1707797e1a340d4f94',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/__snapshots__/simple.stories.storyshot',
            hash: '2648e92aa89fdb3ac9da417227488ae92c62a5d5',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/addon-docs.stories.mdx',
            hash: '909f7692fdefd7915911410bbcf3df7edb363370',
            ext: '.mdx',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-button/__snapshots__/doc-button.stories.storyshot',
            hash: '33b6ae63d795ae4b9b4eb52bfcaaad600a3a0ec8',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-button/doc-button.component.html',
            hash: '7af61d6f344df7b74536bf6d01bbecef32d948f6',
            ext: '.html',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-button/doc-button.component.scss',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.scss',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-button/doc-button.component.ts',
            hash: '68a4815d5367fe4acbe2adecf40bf9f0bf7fb933',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-button/doc-button.stories.ts',
            hash: 'e6666a31f3b06115992d94fb62d91e1d1362918f',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-directive/__snapshots__/doc-directive.stories.storyshot',
            hash: 'dcd5223c795f18a02024dc3e7f0564a6d2e9640a',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-directive/doc-directive.directive.ts',
            hash: 'bcb039c9d9f18c9de2dadb9569ea95970b4d1fa1',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-directive/doc-directive.stories.ts',
            hash: 'fe5d8d97b236782d5cfe18c33deccf2155bd0c53',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-injectable/__snapshots__/doc-injectable.stories.storyshot',
            hash: '04582c4cdaf492bcf6f685f3d9bf9d1a7c1a01c1',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-injectable/doc-injectable.service.ts',
            hash: 'b6ad136fec3308cdf221da9868e6dfdfc3d3a3a2',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-injectable/doc-injectable.stories.ts',
            hash: 'b329ffc893675fa850f9c4ccda73c14776885cce',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-pipe/__snapshots__/doc-pipe.stories.storyshot',
            hash: '50e37db418e1a0b5152b43141b671b19d6a9f636',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-pipe/doc-pipe.pipe.ts',
            hash: '6b7aca418a37133926ec3bc158bd5b2c11888e2a',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/doc-pipe/doc-pipe.stories.ts',
            hash: '07c8660958e43dc98f59362fa7391cc703683f25',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/docs-only.stories.mdx',
            hash: 'e699cf0f079ff1afcbf793c705e91cd4bc0d1e63',
            ext: '.mdx',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/iframe/__snapshots__/iframe.stories.storyshot',
            hash: '55864ff9b1a502401bf15ccfe765695e78a453ca',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/iframe/iframe.stories.ts',
            hash: '8f5b470415c6666f3b547ad35f0833eb3c95271e',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/markdown.stories.mdx',
            hash: '2d5ff78e99712cab93ac6d0bc77b9ffd88ae9e54',
            ext: '.mdx',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/docs/simple.stories.mdx',
            hash: '6c885ff13ffaddab498e7470e8d4d82acbe4842a',
            ext: '.mdx',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/jest/__snapshots__/addon-jest.stories.storyshot',
            hash: 'af4fc50f3de4d49e116ca10f095d7015ccad62ab',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/jest/addon-jest.stories.ts',
            hash: '8d1ef787c2dea5d536f121497cad43e5a00c1f68',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/knobs/__snapshots__/addon-knobs.stories.storyshot',
            hash: 'e6a99e7b35591579930bb497026315203fb88c82',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/knobs/addon-knobs.stories.ts',
            hash: 'e49aa30622b119d1821aa36d12dfec6b6c05d4c0',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/knobs/all-knobs.component.ts',
            hash: '493121e46c106d0b02c25b4e9a85389f20fc051e',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/knobs/knobs.component.ts',
            hash: '4400661fecfad31a8648c3a315bd01bb19e81cdc',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/links/__snapshots__/addon-links.stories.storyshot',
            hash: '29703076aaf12d61ac79b461498cde2d3285ca60',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/addons/links/addon-links.stories.ts',
            hash: '5fab196ef2c88e84d0e8b36af4862a90c4fdc62e',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/stories/addons/README.stories.mdx',
            hash: 'd263972ded967fa3ff3e74e4717ea912dc25fbd4',
            ext: '.mdx',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/angular-forms/customControlValueAccessor/__snapshots__/custom-cva-component.stories.storyshot',
            hash: '5f4b1dfb13a1b709554b0fddb95fa7d30c28e8fb',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/angular-forms/customControlValueAccessor/custom-cva-component.stories.ts',
            hash: '40cad770527dcca7b9442c0e53a48992656d7516',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/angular-forms/customControlValueAccessor/custom-cva.component.ts',
            hash: '3806d30ac5e8160d36ccfb0f8f2dcf17953cdce1',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-complex-selectors/__snapshots__/multiple-selector.component.stories.storyshot',
            hash: 'b42e9f7f6128dd4b5bec64f55663b10a1b5e2124',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-complex-selectors/attribute-selector.component.ts',
            hash: '41cce5c36a278fea3645df9d988ea8079ae7a701',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-complex-selectors/class-selector.component.ts',
            hash: '4d73fb43ebe4f6b9c8e196253a0088f42b4900cb',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-complex-selectors/multiple-selector.component.stories.ts',
            hash: '52633a23fe6568cc18c9dc2e879622c659b888f6',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-complex-selectors/multiple-selector.component.ts',
            hash: '8c9648efa0074fb2543995a01caff4a38b232d8c',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-enums/__snapshots__/enums.component.stories.storyshot',
            hash: 'aaf435fc730ab7a38525864f7069e17b241d8fc4',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-enums/enums.component.html',
            hash: '08584b9824f45c3815075cc79fb87fb744733042',
            ext: '.html',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-enums/enums.component.stories.ts',
            hash: 'f0af610db3359a3df274a0c697c74a5dbb8d8237',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-enums/enums.component.ts',
            hash: '48e781942386e1d8409bdeea59f2fd83418c3706',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-inheritance/__snapshots__/inheritance.stories.storyshot',
            hash: '8bae8186a796e1c4488a9c756a176d2815fa33b9',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-inheritance/base-button.component.ts',
            hash: '6afc2f20cce8578187c2250d4de19a7f74aea4e3',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-inheritance/icon-button.component.ts',
            hash: '82ff17cf9e96deb036991d5b08d9fed87de832fa',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-inheritance/inheritance.stories.ts',
            hash: 'a7caf2f4e9f6d60ca48bcdb7c36d96741f4275d9',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-ng-content/__snapshots__/ng-content-about-parent.stories.storyshot',
            hash: 'feff4372ed165d7cf50c9e94618ad95e16ec4647',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-ng-content/__snapshots__/ng-content-simple.stories.storyshot',
            hash: '9ff0be60731d52597cd46dbc0dc5257b6ffcae5d',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-ng-content/ng-content-about-parent.stories.ts',
            hash: '27688157013c4fde170508801a92d7b630d88d39',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-ng-content/ng-content-simple.stories.ts',
            hash: 'e0660cebc33caecd76be20e5d187e18f59b38cdf',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-ng-on-destroy/component-with-on-destroy.stories.ts',
            hash: '3a006f838aa7e60ebee9e714f9e13237a0c6186f',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-on-push/__snapshots__/on-push.stories.storyshot',
            hash: 'f33448f92bbab867e1fc286ceb0dcd4f8e74e40d',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-on-push/on-push-box.component.ts',
            hash: 'e35ada4b1c5b45d72542c5321c2395e9b22677cc',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-on-push/on-push.stories.ts',
            hash: 'e88ab5c97c2c723a10005a17ae6d500b3500ba18',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-pipe/__snapshots__/custom-pipes.stories.storyshot',
            hash: '086157037ecb428fe68ad7f6980172055d94f282',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-pipe/custom-pipes.stories.ts',
            hash: 'cdfcff5e069470c4e00cb70bea6d324691f599d5',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-pipe/custom.pipe.ts',
            hash: '0e55d112c41ef190fc218c8fd8f21ca412d786a3',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-pipe/with-pipe.component.ts',
            hash: '0ea676d121d65660217fc8fccad05c9dc9f47da2',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-provider/__snapshots__/di.component.stories.storyshot',
            hash: '161e5c2edfb06140300f89fd5519fdcefdb0e2dd',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-provider/di.component.html',
            hash: 'fc6c74c42eadefdc96e262ca2f07874c227c2766',
            ext: '.html',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-provider/di.component.stories.ts',
            hash: 'e0ae1cfb912e9ff06527b1c90b4b706ee2965317',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-provider/di.component.ts',
            hash: '1d5bb78001598cb7d017f3343a7ad46337d6668c',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-style/__snapshots__/styled.component.stories.storyshot',
            hash: '67afa3fec1e55dbd4727459d27c5aaa57b8e6071',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-style/styled.component.css',
            hash: 'fdfe0940158f655d6855979d63e6d8aceee0e66f',
            ext: '.css',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-style/styled.component.html',
            hash: '129e735ec5b01c5ef7daab1d091f7c6059a12d0a',
            ext: '.html',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-style/styled.component.scss',
            hash: '5895f510a1da61c4148aaabf787c008f8b831dcb',
            ext: '.scss',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-style/styled.component.stories.ts',
            hash: 'c986f00bec8846e7e4d98f097105ebc3b9dbb462',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-with-style/styled.component.ts',
            hash: '6cdb0a9a627be4f1e6fe7c3c9b9100f4ba1625b1',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-without-selector/__snapshots__/without-selector-ng-component-outlet.stories.storyshot',
            hash: '66a392f0cbb406c43516c8cdb412d4ac1cee8667',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-without-selector/__snapshots__/without-selector-ng-factory-resolver.stories.storyshot',
            hash: '9bd911768d2c5da7f928b3aa3ce00b5a78a43fde',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-without-selector/__snapshots__/without-selector.stories.storyshot',
            hash: 'cc9d114e8379721c4cc2ff285bf2ec7b1d9273ec',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-without-selector/without-selector-ng-component-outlet.stories.ts',
            hash: '474d50b36ff11a2239ec9235c97ed0f4dc33ae45',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-without-selector/without-selector-ng-factory-resolver.stories.ts',
            hash: 'e583d2735651a961a6ecbe7ed5551c0e7cdb4d02',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-without-selector/without-selector.component.ts',
            hash: 'd644c76b69f82dd45920e8aa4969760e9f82e6cd',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/component-without-selector/without-selector.stories.ts',
            hash: '148920200322fe155832739bf4e99ebd78194ce8',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/ng-module/__snapshots__/import-module-for-root.stories.storyshot',
            hash: 'afa7c25f41322538f8c98b46375428eac11628b3',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/ng-module/__snapshots__/import-module.stories.storyshot',
            hash: 'a066165183e8e293ebf9f56b1a3a00727393bd94',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/ng-module/angular-src/chip-color.token.ts',
            hash: '5d0a1991490bb6a24e1d77289cbfae55bc704e3b',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/ng-module/angular-src/chip-text.pipe.ts',
            hash: 'c57cf51f87de5b7188cbf599b9d8d61d6fd949dc',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/ng-module/angular-src/chip.component.ts',
            hash: '18ae3440a582ee1eb883780109ec6955bc2a3508',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/ng-module/angular-src/chips-group.component.ts',
            hash: '8969e188e90cbcf99ac8fcfcdbee609507ca8b5d',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/ng-module/angular-src/chips.module.ts',
            hash: '9d1bc7ea9406534458b9812ea157b724f3ba942b',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/ng-module/import-module-for-root.stories.ts',
            hash: 'de90f39bc4856ee931efeb5c346e2c8dce98ec4a',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/basics/ng-module/import-module.stories.ts',
            hash: '7c6493e6cf9bb442cdaed9e355be26c22ba142a1',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/stories/basics/README.stories.mdx',
            hash: 'cdf4de76ce3875da6394d4dfe2ea9df52d143d27',
            ext: '.mdx',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/decorators/componentWrapperDecorator/__snapshots__/decorators.stories.storyshot',
            hash: '3a00a0a189e06f0e94fe3f3e13be7f8ac801d18a',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/decorators/componentWrapperDecorator/child.component.ts',
            hash: '4666ec952ad1c85d22344b33fc052fccb96fd94c',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/decorators/componentWrapperDecorator/decorators.stories.ts',
            hash: '1f4b61b9bec92dfdaa3ad9c8774d541a0ab578be',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/decorators/componentWrapperDecorator/parent.component.ts',
            hash: 'f49ce1bb18738bc0c3716b449dc71934392e5473',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/decorators/theme-decorator/__snapshots__/decorators.stories.storyshot',
            hash: '26b6592642cc7b1bfaba3945d43b173b0c09fe59',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/decorators/theme-decorator/decorators.stories.ts',
            hash: 'c3890ea870953e3f66ba99fcea15695a1b6df898',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/__snapshots__/in-export-default.stories.storyshot',
            hash: 'cf0badba9c731418148506584ade8d99654826e9',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/__snapshots__/in-stories.stories.storyshot',
            hash: 'f872033bdd71ae78c55dfe3f5b2c118f22aaa76b',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/__snapshots__/merge-default-and-story.stories.storyshot',
            hash: 'b506f64d2bdb4004307a6e22ca77ee31173770e7',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/angular-src/custom.pipe.ts',
            hash: '0e55d112c41ef190fc218c8fd8f21ca412d786a3',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/angular-src/dummy.service.ts',
            hash: 'fc3668478af3eb533f0659f5d92f3c86671ed3d6',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/angular-src/service.component.ts',
            hash: '2d84bac39628b51a1d34429c7a3f08bc65866232',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/angular-src/token.component.ts',
            hash: 'f2abda201863cdc44977c18b81a33c9916b8c13b',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/in-export-default.stories.ts',
            hash: 'aa6e01e8a900030a3e197ed3caaa862b5351bb82',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/in-stories.stories.ts',
            hash: 'bfd46f2bd9a9165b0be848897c5f94a19c317ef3',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/moduleMetadata/merge-default-and-story.stories.ts',
            hash: 'b14ca16572cc570b56dcd593343e89020b064eee',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/parameters/__snapshots__/all-parameters.stories.storyshot',
            hash: '69a63403adc12c7a4d7baf411c22f1f96f8981cd',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/parameters/__snapshots__/layout.parameters.stories.storyshot',
            hash: '1cbb51b7d9dea333d54349dcb459067b03395d76',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/parameters/all-parameters.stories.ts',
            hash: 'afc67081268db850cfd2d317a202032635aa069f',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/parameters/layout.parameters.stories.ts',
            hash: '6af835e1891101c33c4535fce809360983f32d46',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/stories/core/README.stories.mdx',
            hash: 'ce54dc9675b0bd924c5b17998bd56c314b94ee36',
            ext: '.mdx',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/styles/__snapshots__/story-styles.stories.storyshot',
            hash: 'deef1154ad8718ca4f4a103b3be2413116b0d5ea',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/core/styles/story-styles.stories.ts',
            hash: 'ade8aab8fb8acb9e44b9eda3fc0a1f09353554aa',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/legacy/__snapshots__/component-in-story.stories.storyshot',
            hash: 'dc24c553667b5676246c10785d31d05ccdd0036d',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/legacy/__snapshots__/storiesOf.stories.storyshot',
            hash: '5ed0635b6435121c93c4b2d8d86bc5e2125bb6ef',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/legacy/component-in-story.stories.ts',
            hash: '78a750892136987415036239f74120fd256e4416',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/stories/legacy/README.stories.mdx',
            hash: '7b9ff60ee5f81db4af1926a3024faa5fae6cb1b2',
            ext: '.mdx',
          },
          {
            file:
              'examples/angular-cli/src/stories/legacy/storiesOf.stories.ts',
            hash: '8b9f3854d8080ee17f318953a32776af3acb8b11',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/others/issues/__snapshots__/12009-unknown-component.stories.storyshot',
            hash: '25f4de0b77c4fb5e471ce887575dcbbce1d1e9ef',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/others/issues/12009-unknown-component.stories.ts',
            hash: '9a2c9dde535bfbb654a58b433bc0642536938742',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/others/ngrx/__snapshots__/ngrx-store.stories.storyshot',
            hash: '5da2e3b813317cc15d903f5c2766991fbcd338df',
            ext: '.storyshot',
          },
          {
            file:
              'examples/angular-cli/src/stories/others/ngrx/ngrx-store.stories.ts',
            hash: '267a82785dfcf67b4f6a1a10d1830d81a17d0a37',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/stories/welcome-angular.stories.ts',
            hash: 'c0003987c2d2149e85f8a6ec75bf8c27313a7e93',
            ext: '.ts',
          },
          {
            file:
              'examples/angular-cli/src/stories/welcome-storybook.stories.ts',
            hash: 'a68ba20a49a675c2244b0e91e9203b50434f2e5f',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/src/styles.css',
            hash: 'dd56b348e94bf93e381c1d20c044a79aa891ec44',
            ext: '.css',
          },
          {
            file: 'examples/angular-cli/src/styles.scss',
            hash: '2bcb866267c9fab730726263ff5a15683b81ca57',
            ext: '.scss',
          },
          {
            file: 'examples/angular-cli/src/tsconfig.app.json',
            hash: 'a2e2c05f4a364ff282250307fb8f215c90035e34',
            ext: '.json',
          },
          {
            file: 'examples/angular-cli/src/tsconfig.spec.json',
            hash: '89c11377ec8977e1b0c57822e8c2b479684336f2',
            ext: '.json',
          },
          {
            file: 'examples/angular-cli/src/typings.d.ts',
            hash: 'b58fa33df4f61c32238e41e5ce63bb1284edd57c',
            ext: '.ts',
          },
          {
            file: 'examples/angular-cli/tsconfig.json',
            hash: 'fd917221625c271c2992877fe3c18d2a675e72d1',
            ext: '.json',
          },
        ],
      },
    },
    'cra-react15': {
      name: 'cra-react15',
      type: 'lib',
      data: {
        root: 'examples/cra-react15',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          eject: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'eject',
            },
          },
          start: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'start',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
          test: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/cra-react15/.storybook/main.js',
            hash: '355f5c0450d00ca3520c25e4e8c3355119e6b91e',
            ext: '.js',
          },
          {
            file: 'examples/cra-react15/.storybook/manager.js',
            hash: 'b0792091a0c0827bd76f1e1f91c96459b3f562d3',
            ext: '.js',
          },
          {
            file: 'examples/cra-react15/package.json',
            hash: '28b6698530d640a7bc48ae411f34e21cf376b21e',
            ext: '.json',
          },
          {
            file: 'examples/cra-react15/public/favicon.ico',
            hash: 'a11777cc471a4344702741ab1c8a588998b1311a',
            ext: '.ico',
          },
          {
            file: 'examples/cra-react15/public/index.html',
            hash: 'ed0ebafa1b7c3057e5fc3eddbdf9e4c2c46de805',
            ext: '.html',
          },
          {
            file: 'examples/cra-react15/public/manifest.json',
            hash: 'ef19ec243e739479802a5553d0b38a18ed845307',
            ext: '.json',
          },
          {
            file: 'examples/cra-react15/README.md',
            hash: 'd3442797bfc88a01c9feb54f7a7cf893e59a6d6d',
            ext: '.md',
          },
          {
            file: 'examples/cra-react15/src/App.css',
            hash: '31be39dcc49b33d79e99f24f1309a007dd894200',
            ext: '.css',
          },
          {
            file: 'examples/cra-react15/src/App.js',
            hash: '5c30e5e818b1cc82db4ec5945d789534827e3e0a',
            ext: '.js',
          },
          {
            file: 'examples/cra-react15/src/App.test.js',
            hash: '2fa98e36949e4ad8e1b561e5b4eb989b64857d0d',
            ext: '.js',
          },
          {
            file: 'examples/cra-react15/src/index.css',
            hash: 'b4cc7250b98cb3f1a2dd5bec134296c6942344d9',
            ext: '.css',
          },
          {
            file: 'examples/cra-react15/src/index.js',
            hash: 'ad8982e6fb1953671cd7227429490c501309e902',
            ext: '.js',
          },
          {
            file: 'examples/cra-react15/src/logo.svg',
            hash: '9dfc1c058cebbef8b891c5062be6f31033d7d186',
            ext: '.svg',
          },
          {
            file: 'examples/cra-react15/src/stories/button.stories.js',
            hash: '49cb4cabd47ed2c10596932ac8fe6a866a4dceee',
            ext: '.js',
          },
          {
            file: 'examples/cra-react15/src/stories/welcome.stories.js',
            hash: 'ab49853d1d4d3b1ca2570c05eef2a8b5496abf2b',
            ext: '.js',
          },
        ],
      },
    },
    '@storybook/builder-webpack4': {
      name: '@storybook/builder-webpack4',
      type: 'lib',
      data: {
        root: 'lib/builder-webpack4',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/builder-webpack4/package.json',
            hash: '9a2e70e8ea3b965279f456a1a26e1314ec28e39e',
            ext: '.json',
          },
          {
            file: 'lib/builder-webpack4/README.md',
            hash: 'e2806e27a850a881755219ebfa11db311ab7fd52',
            ext: '.md',
          },
          {
            file: 'lib/builder-webpack4/src/index.ts',
            hash: '5d9b131b778b4283141024d5b43cd389e50900d1',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack4/src/presets/custom-webpack-preset.ts',
            hash: '62c1fa4d19c63ab9d1f2c734afdae421141e77b1',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack4/src/presets/preview-preset.ts',
            hash: '1e2d3949220ec034948bd1ee496464148f08377b',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack4/src/preview/babel-loader-preview.ts',
            hash: '7056e71e78d2bb6445fd2c695106cc7cd3aa2c28',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack4/src/preview/base-webpack.config.ts',
            hash: 'bb37afd9b10d4e43c446ce13ed865b0c1d14f223',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack4/src/preview/entries.test.ts',
            hash: 'cb1ee0a5d1dba8368352cc314cbb3eecd991b3e3',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack4/src/preview/entries.ts',
            hash: 'fa81ba266e16c7534053b0ef435d93ed66c98674',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack4/src/preview/iframe-webpack.config.ts',
            hash: '929593fecb769f05bc7b8340a3e13a90adaec284',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack4/src/preview/useBaseTsSupport.ts',
            hash: '431b604993ebe44a07b51b1cc612c52df3e5a7f6',
            ext: '.ts',
          },
          {
            file:
              'lib/builder-webpack4/src/preview/virtualModuleEntry.template.js',
            hash: '214d3fe8a16428b813174c1be469e7f3b9bcc947',
            ext: '.js',
          },
          {
            file:
              'lib/builder-webpack4/src/preview/virtualModuleStory.template.js',
            hash: 'db3ca75fab2c86a58bbc33b14b493bb9baedb0e0',
            ext: '.js',
          },
          {
            file: 'lib/builder-webpack4/tsconfig.json',
            hash: '94f6c54442045163272d16195ee860e2220c2a8c',
            ext: '.json',
          },
          {
            file: 'lib/builder-webpack4/typings.d.ts',
            hash: 'd6299bfb8a3b6913ae78abaafa222803dfb92b74',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/builder-webpack5': {
      name: '@storybook/builder-webpack5',
      type: 'lib',
      data: {
        root: 'lib/builder-webpack5',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/builder-webpack5/package.json',
            hash: '78d864d8728ffb6307508ab36b6bf368698dd010',
            ext: '.json',
          },
          {
            file: 'lib/builder-webpack5/README.md',
            hash: 'ee2baec22c4e2e4f9a9cb41610cf262f76383684',
            ext: '.md',
          },
          {
            file: 'lib/builder-webpack5/src/index.ts',
            hash: '6bc723267fe0ab054062eba73db73e560980b17c',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack5/src/presets/custom-webpack-preset.ts',
            hash: '510f8b16895014282fcd92ab68aec69a32d52e7a',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack5/src/presets/preview-preset.ts',
            hash: 'af6d14441e8308c3b7c378ef55a01571fadb5fa4',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack5/src/preview/babel-loader-preview.ts',
            hash: '7d02ca31a46135ff34f202eef7b25cc5ceb2712c',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack5/src/preview/base-webpack.config.ts',
            hash: '6b5525afe73df38e56e32f42314cf131a2afeae3',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack5/src/preview/entries.test.ts',
            hash: 'cb1ee0a5d1dba8368352cc314cbb3eecd991b3e3',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack5/src/preview/entries.ts',
            hash: 'fa81ba266e16c7534053b0ef435d93ed66c98674',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack5/src/preview/iframe-webpack.config.ts',
            hash: '844e0c984955904864fc1f1abf2f936b22d4722b',
            ext: '.ts',
          },
          {
            file: 'lib/builder-webpack5/src/preview/useBaseTsSupport.ts',
            hash: '431b604993ebe44a07b51b1cc612c52df3e5a7f6',
            ext: '.ts',
          },
          {
            file:
              'lib/builder-webpack5/src/preview/virtualModuleEntry.template.js',
            hash: '214d3fe8a16428b813174c1be469e7f3b9bcc947',
            ext: '.js',
          },
          {
            file:
              'lib/builder-webpack5/src/preview/virtualModuleStory.template.js',
            hash: 'db3ca75fab2c86a58bbc33b14b493bb9baedb0e0',
            ext: '.js',
          },
          {
            file: 'lib/builder-webpack5/tsconfig.json',
            hash: '94f6c54442045163272d16195ee860e2220c2a8c',
            ext: '.json',
          },
          {
            file: 'lib/builder-webpack5/typings.d.ts',
            hash: 'd6299bfb8a3b6913ae78abaafa222803dfb92b74',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/addon-cssresources': {
      name: '@storybook/addon-cssresources',
      type: 'lib',
      data: {
        root: 'addons/cssresources',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/cssresources/docs/demo.gif',
            hash: '75bc3685edf6829dcdc4a388b76d29ce5843961b',
            ext: '.gif',
          },
          {
            file: 'addons/cssresources/package.json',
            hash: '54ebdfa3ffdf87b4fabfa41a7c945dc6c79aeee9',
            ext: '.json',
          },
          {
            file: 'addons/cssresources/preset.js',
            hash: 'a1382ab7c27cef6d6deb55edf426bd75b414cb3f',
            ext: '.js',
          },
          {
            file: 'addons/cssresources/README.md',
            hash: 'fad0c977444bfc9188de9c24cfcf20d9084dcaee',
            ext: '.md',
          },
          {
            file: 'addons/cssresources/register.js',
            hash: '257d32c01f8fbcac0f2e673cdf5385b4cd7d37a1',
            ext: '.js',
          },
          {
            file: 'addons/cssresources/src/constants.ts',
            hash: '1a0f36540353d43bcb1e1ed7e2a1891991ba144e',
            ext: '.ts',
          },
          {
            file: 'addons/cssresources/src/css-resource-panel.test.tsx',
            hash: '05969c33a7e689efcc06f096baa2fbb6737c5847',
            ext: '.tsx',
          },
          {
            file: 'addons/cssresources/src/css-resource-panel.tsx',
            hash: 'a2780acefe7c1b6621c6f3b7360ee8dce91faeec',
            ext: '.tsx',
          },
          {
            file: 'addons/cssresources/src/CssResource.ts',
            hash: 'ee67b93e2a7c1eb09d27fe3f479234df44906c04',
            ext: '.ts',
          },
          {
            file: 'addons/cssresources/src/index.ts',
            hash: '98f9c9387d5aed9de4a283043ae33faf1b2f54c0',
            ext: '.ts',
          },
          {
            file: 'addons/cssresources/src/register.tsx',
            hash: 'e34e1fc64494412c7189b8abe005347620772b2d',
            ext: '.tsx',
          },
          {
            file: 'addons/cssresources/src/typings.d.ts',
            hash: 'a41bf8a45b794eb44d6af995b21b359f2fc56f20',
            ext: '.ts',
          },
          {
            file: 'addons/cssresources/tsconfig.json',
            hash: 'b17b463e1da1c1a788e247c4680e5d43af3a7b50',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-backgrounds': {
      name: '@storybook/addon-backgrounds',
      type: 'lib',
      data: {
        root: 'addons/backgrounds',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/backgrounds/package.json',
            hash: '4de82c5f580ff7340aecf8dd0c37858d08b14d79',
            ext: '.json',
          },
          {
            file: 'addons/backgrounds/preset.js',
            hash: 'a80aaefb5b30b8f67b5ded92dfa8464a8e50c085',
            ext: '.js',
          },
          {
            file: 'addons/backgrounds/README.md',
            hash: 'bae041ad110507a47072faac9ae79c369752c2e1',
            ext: '.md',
          },
          {
            file: 'addons/backgrounds/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/backgrounds/src/components/ColorIcon.tsx',
            hash: 'e654c408b204f864c6a1d05f97cac365a186daf1',
            ext: '.tsx',
          },
          {
            file: 'addons/backgrounds/src/constants.ts',
            hash: '566bc9dbbb32a8c976a58096f562f96b5c31ad99',
            ext: '.ts',
          },
          {
            file: 'addons/backgrounds/src/containers/BackgroundSelector.tsx',
            hash: '269b7fed32a7d57b9b0143e5bf773a09741df962',
            ext: '.tsx',
          },
          {
            file: 'addons/backgrounds/src/containers/GridSelector.tsx',
            hash: '5ab21e54ffc3baffe44dad1bd42087e56cf8b557',
            ext: '.tsx',
          },
          {
            file: 'addons/backgrounds/src/decorators/index.ts',
            hash: 'cf4a28890479e694f4c66fadda6b6e29b8e1aa0a',
            ext: '.ts',
          },
          {
            file: 'addons/backgrounds/src/decorators/withBackground.ts',
            hash: 'defad6f99c7173780a48c9cb0d203c0161b707eb',
            ext: '.ts',
          },
          {
            file: 'addons/backgrounds/src/decorators/withGrid.ts',
            hash: 'e6f4be7a169c0a9b1bc08dc0abb33a90bfb58d9e',
            ext: '.ts',
          },
          {
            file: 'addons/backgrounds/src/helpers/index.ts',
            hash: '6fead3837610befce197287de1dee7c1a9c07c45',
            ext: '.ts',
          },
          {
            file: 'addons/backgrounds/src/index.ts',
            hash: '644402abb41c6179b3b918dcc86bfd1599db17f8',
            ext: '.ts',
          },
          {
            file: 'addons/backgrounds/src/preset/addDecorator.tsx',
            hash: '93ccff6323392c1b35413aaa63e09fc78781a650',
            ext: '.tsx',
          },
          {
            file: 'addons/backgrounds/src/preset/addParameter.tsx',
            hash: 'ceb1d3b41203110cee242bedcfb7fecde742460b',
            ext: '.tsx',
          },
          {
            file: 'addons/backgrounds/src/register.tsx',
            hash: 'd3b8d095ec977465f2008a57df837edfbf2f5ad2',
            ext: '.tsx',
          },
          {
            file: 'addons/backgrounds/src/types/index.ts',
            hash: 'a77e4faf932234f6303a1c200a06d198fd4108a1',
            ext: '.ts',
          },
          {
            file: 'addons/backgrounds/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'addons/backgrounds/tsconfig.json',
            hash: 'd1ee4fc75941ea63fc45ba234dca37d9882e1620',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-queryparams': {
      name: '@storybook/addon-queryparams',
      type: 'lib',
      data: {
        root: 'addons/queryparams',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/queryparams/package.json',
            hash: '8e953c0e5a48e06558d230f40a89305a38072eae',
            ext: '.json',
          },
          {
            file: 'addons/queryparams/preset.js',
            hash: 'c98b2907c03e4432a872d7ae15af56fca43f8964',
            ext: '.js',
          },
          {
            file: 'addons/queryparams/README.md',
            hash: '0befd0e5e69a99a5a306e9a7d220bf4593b44159',
            ext: '.md',
          },
          {
            file: 'addons/queryparams/src/constants.ts',
            hash: 'd8fc643d74bacb3a679bfdc16290b9fe90f7aa31',
            ext: '.ts',
          },
          {
            file: 'addons/queryparams/src/index.ts',
            hash: '0070b840986b9e06321d86289245c48d32dd9dfb',
            ext: '.ts',
          },
          {
            file: 'addons/queryparams/src/preset/addDecorator.ts',
            hash: 'f04053309f7928427c28ff06a4c215c212222e39',
            ext: '.ts',
          },
          {
            file: 'addons/queryparams/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'addons/queryparams/tsconfig.json',
            hash: 'd1ee4fc75941ea63fc45ba234dca37d9882e1620',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-storysource': {
      name: '@storybook/addon-storysource',
      type: 'lib',
      data: {
        root: 'addons/storysource',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/storysource/docs/demo.gif',
            hash: 'e46a4f561fcfcc5b9eec47235fca0097e11a8c47',
            ext: '.gif',
          },
          {
            file: 'addons/storysource/docs/theming-light-dark.png',
            hash: '193b0c2fe02b8437d9d7246d85661130a960dd1f',
            ext: '.png',
          },
          {
            file: 'addons/storysource/package.json',
            hash: '5a7da359062ddaffa58dd805e73cde2cfe75388d',
            ext: '.json',
          },
          {
            file: 'addons/storysource/preset.js',
            hash: '9a53f8d68228e99574c83c46098ee0b46018a21b',
            ext: '.js',
          },
          {
            file: 'addons/storysource/README.md',
            hash: 'f94a50b07a7ea68fb0c8ac7e534cf22500ce707c',
            ext: '.md',
          },
          {
            file: 'addons/storysource/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/storysource/src/events.ts',
            hash: '9436b8a7511405007b17eff5be2716eb277e9e3e',
            ext: '.ts',
          },
          {
            file: 'addons/storysource/src/index.ts',
            hash: 'a5cd9202f547be024e284eb57ad0c15d4eaeafb0',
            ext: '.ts',
          },
          {
            file: 'addons/storysource/src/register.tsx',
            hash: '7027071f226cbba73fa220bbd810c136f1edd748',
            ext: '.tsx',
          },
          {
            file: 'addons/storysource/src/StoryPanel.tsx',
            hash: 'd1c79b8f942d90642a8fcb7e3c94e920e56a2d97',
            ext: '.tsx',
          },
          {
            file: 'addons/storysource/theming-light-dark.png',
            hash: 'e162bc2e0d890adb5a713a3399a4c2a74652f068',
            ext: '.png',
          },
          {
            file: 'addons/storysource/tsconfig.json',
            hash: 'd1ee4fc75941ea63fc45ba234dca37d9882e1620',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/web-components': {
      name: '@storybook/web-components',
      type: 'lib',
      data: {
        root: 'app/web-components',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/web-components/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/web-components/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/web-components/package.json',
            hash: 'a13a854f4f5c9f70f2a12c9e5dbd1012301a9fbb',
            ext: '.json',
          },
          {
            file: 'app/web-components/README.md',
            hash: '7baf1c3c0af59bfd6234a60610d999f47a8d8dc0',
            ext: '.md',
          },
          {
            file: 'app/web-components/src/client/customElements.ts',
            hash: '06ebc9b7859ff991714ea1b8cbdfcba25f3943c3',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/client/index.ts',
            hash: 'b2379641137f5dd07b069e1561a2ea40eb2e169b',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/client/preview/globals.ts',
            hash: '052fcec5cd629324f80060409ab56d1489c05d7c',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/client/preview/index.ts',
            hash: '7193f399353ff3d4cf2d1d4c5e8c2a55b07e35d7',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/client/preview/render.ts',
            hash: '5970b4d3e70486e4b89e85decb092055d86cb18f',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/client/preview/types-6-0.ts',
            hash: 'c7077eaea1b30e9c369afd7c4f6e17836d719a2d',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/client/preview/types.ts',
            hash: '039a835cfc017364f3e037347bbf7d4285dcb1cc',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file:
              'app/web-components/src/server/framework-preset-web-components.ts',
            hash: '8e14b519defe61dfa8236b5e131f0410d2e3763f',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/server/options.ts',
            hash: '0a63c8168cb10b3aa89ad79f1a98369c1abf25b8',
            ext: '.ts',
          },
          {
            file: 'app/web-components/src/typings.d.ts',
            hash: 'd8f7c6f660ad7acc11040fd6d2e70cb5dde4dccb',
            ext: '.ts',
          },
          {
            file: 'app/web-components/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/web-components/tsconfig.json',
            hash: '13f32ad6309564ac1f4d8d0877732916ec10bdfe',
            ext: '.json',
          },
          {
            file: 'app/web-components/types-6-0.d.ts',
            hash: 'b5946b39a8d8e20d1c13962a519c1aeae6a25c94',
            ext: '.ts',
          },
        ],
      },
    },
    'ember-example': {
      name: 'ember-example',
      type: 'lib',
      data: {
        root: 'examples/ember-cli',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'prebuild-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prebuild-storybook',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          dev: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'dev',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
          'storybook:dev': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook:dev',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/ember-cli/.ember-cli',
            hash: 'ee64cfed2a8905dc23506af1060ec80cf887582d',
            ext: '',
          },
          {
            file: 'examples/ember-cli/.env',
            hash: '8e8c4cbfc8fc605e21d528dbc51cc1b4de599a07',
            ext: '',
          },
          {
            file: 'examples/ember-cli/.eslintignore',
            hash: '3c0a3b68cd29b8faf7ea8428d39d55ed1163528a',
            ext: '',
          },
          {
            file: 'examples/ember-cli/.eslintrc.js',
            hash: '45b9d104adb4ba6effe37ddcf3e1eb4e5b928d29',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/.gitignore',
            hash: '9f61ffc32c50f91b588caed3031defd1e0239f24',
            ext: '',
          },
          {
            file: 'examples/ember-cli/.storybook/main.js',
            hash: '01db9cd98fbe3570f53a31e2c3479a05ff310d94',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/.storybook/preview.js',
            hash: '9e7eaa3b889c6b8c21cdfe521ff6aa8baf13b618',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/app/app.js',
            hash: '84944156ce77a57dcd4c4985a9df618fc9f2057a',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/app/components/welcome-banner.js',
            hash: '05478b4b5608e4f0f0de9428f8313846d58928f8',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/app/components/welcome-page.js',
            hash: '55706477346c43886e12f2d9aa719767d2464ae7',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/app/index.html',
            hash: '7c13eb3503f896bdec89b57fbdb2ae5b4a53a25e',
            ext: '.html',
          },
          {
            file: 'examples/ember-cli/app/initializers/.gitkeep',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '',
          },
          {
            file: 'examples/ember-cli/app/resolver.js',
            hash: '3aa83c31154a39149a932a71f35c011ac84a3152',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/app/router.js',
            hash: '16bbc2e6980785a1a009fe9120e48dd9c59f5cc2',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/app/styles/app.css',
            hash: '30fa0b480d139c1708c35a6cfa3c3cbc649b38f8',
            ext: '.css',
          },
          {
            file: 'examples/ember-cli/app/templates/application.hbs',
            hash: 'e31972d28371921659e3e6e2508ea5e1964a2128',
            ext: '.hbs',
          },
          {
            file: 'examples/ember-cli/app/templates/components/named-block.hbs',
            hash: '13741644ed9a9642749807bf478d9343f61a275e',
            ext: '.hbs',
          },
          {
            file:
              'examples/ember-cli/app/templates/components/welcome-banner.hbs',
            hash: '9ca8973181aa43f82952739516321f4e29a8218e',
            ext: '.hbs',
          },
          {
            file:
              'examples/ember-cli/app/templates/components/welcome-page.hbs',
            hash: '3825de4af5d41d96930ed1d2c0760e45952d3419',
            ext: '.hbs',
          },
          {
            file: 'examples/ember-cli/config/environment.js',
            hash: 'f56c0853ceedf37ba95e2d15c1ecc891987c05cd',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/config/optional-features.json',
            hash: 'dd50c7cd3a3d01163222fed5abf0856388c24483',
            ext: '.json',
          },
          {
            file: 'examples/ember-cli/config/targets.js',
            hash: '071439de373de9ac1099b26baf1a8a275c41913f',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/ember-cli-build.js',
            hash: 'de9188ada6c68523c565350687f64348c22ccbb2',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/package.json',
            hash: 'acaaf86422005c1252826eb57f51cd43c69f6cca',
            ext: '.json',
          },
          {
            file: 'examples/ember-cli/public/logo.png',
            hash: '0080f013ac14aa37ffcb8d7e769c0ebbb2153684',
            ext: '.png',
          },
          {
            file: 'examples/ember-cli/README.md',
            hash: '7b3dc63568c63c053b1705c01b1cab36541e766c',
            ext: '.md',
          },
          {
            file: 'examples/ember-cli/stories/addon-a11y.stories.js',
            hash: '92cb2a614cfdf7496242a119c3a608943f307b91',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/stories/addon-actions.stories.js',
            hash: 'ce4b67a59eecd870e655d5c7c7c25e09241b29bf',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/stories/addon-backgrounds.stories.js',
            hash: '39d5848ce98baa075b82e95517777caee1bba77a',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/stories/addon-controls.stories.js',
            hash: '3b934114c3835bda34c6a1cd315fc88ded4c8c03',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/stories/addon-knobs.stories.js',
            hash: '6aff81be1dbcf3b6840a3fac2bdf8fe0535a6383',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/stories/addon-links.stories.js',
            hash: '11c4ca811a08fbe65ec353c0a4ddfc69c95488fd',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/stories/index.stories.js',
            hash: '547a286c29a57e330905ce45fb998e929e05a5c0',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/stories/polyfill-example.stories.js',
            hash: '841f12358149aae507f27c3720c0226920d8c5ba',
            ext: '.js',
          },
          {
            file: 'examples/ember-cli/stories/welcome-banner.stories.js',
            hash: '1128476813e17d3accd98426d187c0fb30f9bcbb',
            ext: '.js',
          },
        ],
      },
    },
    'marko-cli': {
      name: 'marko-cli',
      type: 'lib',
      data: {
        root: 'examples/marko-cli',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          prettier: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prettier',
            },
          },
          'serve-static': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'serve-static',
            },
          },
          start: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'start',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
          test: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/marko-cli/.editorconfig',
            hash: '688ea9345443954854715cad9b2a29822a3c9370',
            ext: '',
          },
          {
            file: 'examples/marko-cli/.storybook/main.js',
            hash: '3df1d3aaadc4494166f92412de4d74897bdfc94e',
            ext: '.js',
          },
          {
            file: 'examples/marko-cli/package.json',
            hash: '5aa23099f53810304e5fefbbbc712cfcfe94c9d9',
            ext: '.json',
          },
          {
            file: 'examples/marko-cli/README.md',
            hash: '775c5099ff09b57abd53abbd3c82384b384e31ca',
            ext: '.md',
          },
          {
            file: 'examples/marko-cli/src/components/action-button/index.marko',
            hash: '45240f084cd82f9014bda3ad04b30b08790ca4eb',
            ext: '.marko',
          },
          {
            file: 'examples/marko-cli/src/components/click-count/index.marko',
            hash: 'a0c3b9b392a912aa16b3342af54cc4ce981a6275',
            ext: '.marko',
          },
          {
            file: 'examples/marko-cli/src/components/hello/index.marko',
            hash: '6164e674901599c3c34a9e0235aeb1eaea0406d4',
            ext: '.marko',
          },
          {
            file: 'examples/marko-cli/src/components/stop-watch/index.marko',
            hash: '4c354da706f5b9a513d5f34535ccfa6fe70db4c7',
            ext: '.marko',
          },
          {
            file: 'examples/marko-cli/src/components/welcome/index.marko',
            hash: '09d5824d4c0b7d59581761fbe885070e791dd58b',
            ext: '.marko',
          },
          {
            file: 'examples/marko-cli/src/components/welcome/logo.png',
            hash: '471c3ee228e3a09d658d30be813eab9be6ee9c60',
            ext: '.png',
          },
          {
            file: 'examples/marko-cli/src/stories/addon-actions.stories.js',
            hash: '9a76a79fd111e466206625742492d88fc9d5338a',
            ext: '.js',
          },
          {
            file: 'examples/marko-cli/src/stories/addon-knobs.stories.js',
            hash: 'c55067257f2acecd014be5622182c0f494e29a0c',
            ext: '.js',
          },
          {
            file: 'examples/marko-cli/src/stories/clickcount.stories.js',
            hash: 'c6557e9772cafe1ab76589de7f300d74a921e34b',
            ext: '.js',
          },
          {
            file: 'examples/marko-cli/src/stories/hello.stories.js',
            hash: '1a4ec71f57493474cd1ae42c38d2c309845f20c3',
            ext: '.js',
          },
          {
            file: 'examples/marko-cli/src/stories/stopwatch.stories.js',
            hash: '5310d01270e3b909bac20cbc4a567ffce6132a54',
            ext: '.js',
          },
          {
            file: 'examples/marko-cli/src/stories/welcome.stories.js',
            hash: '4ffce8d5dda78be7a93de44b5c03c53064a9fe37',
            ext: '.js',
          },
        ],
      },
    },
    'vue-3-cli-example': {
      name: 'vue-3-cli-example',
      type: 'lib',
      data: {
        root: 'examples/vue-3-cli',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          serve: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'serve',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/vue-3-cli/.browserslistrc',
            hash: '214388fe43cdfd7ce1c29cd3e401541ded620dba',
            ext: '',
          },
          {
            file: 'examples/vue-3-cli/.gitignore',
            hash: '403adbc1e527906a4aa59558cd582c20bcd1d738',
            ext: '',
          },
          {
            file: 'examples/vue-3-cli/.storybook/main.js',
            hash: 'f7dd8ad7b72cc14acd791dc8d680f85096f2fda5',
            ext: '.js',
          },
          {
            file: 'examples/vue-3-cli/.storybook/preview-head.html',
            hash: '940e3e42160a9f167fd60e19a0339127bcb849bd',
            ext: '.html',
          },
          {
            file: 'examples/vue-3-cli/.storybook/preview.ts',
            hash: 'effa418688b29b5e0ed6920ffebea38b368602bc',
            ext: '.ts',
          },
          {
            file: 'examples/vue-3-cli/babel.config.js',
            hash: '078c0056ff32db2c6aecd61d8b539cea2b932bc6',
            ext: '.js',
          },
          {
            file: 'examples/vue-3-cli/jest.config.js',
            hash: '495073003e70faafed5638c388ff01c8b6dd2265',
            ext: '.js',
          },
          {
            file: 'examples/vue-3-cli/package.json',
            hash: '95dca2de0c3cdfa7e7b0788cd39125c363b63677',
            ext: '.json',
          },
          {
            file: 'examples/vue-3-cli/public/favicon.ico',
            hash: 'df36fcfb72584e00488330b560ebcf34a41c64c2',
            ext: '.ico',
          },
          {
            file: 'examples/vue-3-cli/public/index.html',
            hash: '3e5a13962197105f2078d2a224cc57dfa09b4893',
            ext: '.html',
          },
          {
            file: 'examples/vue-3-cli/README.md',
            hash: '78f59e7afdf68d69750de8d2e51903acc25aaf7f',
            ext: '.md',
          },
          {
            file: 'examples/vue-3-cli/src/App.vue',
            hash: '76c1ac0b151efa9a190f578a5742924bc9451480',
            ext: '.vue',
          },
          {
            file: 'examples/vue-3-cli/src/assets/logo.png',
            hash: 'f01909909e4b1709af827c598d44e4cf063e54c0',
            ext: '.png',
          },
          {
            file: 'examples/vue-3-cli/src/components/HelloWorld.vue',
            hash: 'a351e769016f6c88115b41c889738cf02f4ff979',
            ext: '.vue',
          },
          {
            file: 'examples/vue-3-cli/src/main.ts',
            hash: '684d04215d72226542a750bb3faeea33e2a385ab',
            ext: '.ts',
          },
          {
            file: 'examples/vue-3-cli/src/shims-vue.d.ts',
            hash: '3804a43e2f31b64cd6468148621702f8af3c7858',
            ext: '.ts',
          },
          {
            file:
              'examples/vue-3-cli/src/stories/__snapshots__/Button.stories.storyshot',
            hash: 'e3fdcf076f2d0abec95afd3a25630cf786770b07',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-3-cli/src/stories/__snapshots__/Header.stories.storyshot',
            hash: '758dd4bd5a2fc2fa1063ba0312886bb3dacef725',
            ext: '.storyshot',
          },
          {
            file:
              'examples/vue-3-cli/src/stories/__snapshots__/Page.stories.storyshot',
            hash: '3a52ab9aa4cc547ac5134c29e3007aebb5bcfe64',
            ext: '.storyshot',
          },
          {
            file: 'examples/vue-3-cli/src/stories/assets/code-brackets.svg',
            hash: '73de9477600103d031de4114e20468832cfe0d78',
            ext: '.svg',
          },
          {
            file: 'examples/vue-3-cli/src/stories/assets/colors.svg',
            hash: '17d58d516e149de0fa83dc6e684ebd2901aeabf7',
            ext: '.svg',
          },
          {
            file: 'examples/vue-3-cli/src/stories/assets/comments.svg',
            hash: '6493a139f523ee8cceccfb242fd532c0fbfcb5c3',
            ext: '.svg',
          },
          {
            file: 'examples/vue-3-cli/src/stories/assets/direction.svg',
            hash: '65676ac27229460d03c6cfc929210f4773c37d45',
            ext: '.svg',
          },
          {
            file: 'examples/vue-3-cli/src/stories/assets/flow.svg',
            hash: '8ac27db403c236ff9f5db8bf023c396570dc8f6b',
            ext: '.svg',
          },
          {
            file: 'examples/vue-3-cli/src/stories/assets/plugin.svg',
            hash: '29e5c690c0a250f78a5d6f88410fbc14a268e4c2',
            ext: '.svg',
          },
          {
            file: 'examples/vue-3-cli/src/stories/assets/repo.svg',
            hash: 'f386ee902c1fe318885140acebab6aa2f8549646',
            ext: '.svg',
          },
          {
            file: 'examples/vue-3-cli/src/stories/assets/stackalt.svg',
            hash: '9b7ad2743506eb0ec12daa9a11ec2321a05d6775',
            ext: '.svg',
          },
          {
            file: 'examples/vue-3-cli/src/stories/button.css',
            hash: 'dc91dc76370b78ec277e634f8615b67ca55a5145',
            ext: '.css',
          },
          {
            file: 'examples/vue-3-cli/src/stories/Button.stories.js',
            hash: 'ac39a1fde37dbd9867d9c20e928703c811027e8d',
            ext: '.js',
          },
          {
            file: 'examples/vue-3-cli/src/stories/Button.vue',
            hash: 'bb795d041af9fd59517e64ab90b695a39ba46154',
            ext: '.vue',
          },
          {
            file: 'examples/vue-3-cli/src/stories/DynamicHeading.stories.ts',
            hash: 'a68c4f221161c2e25c0d994b33e933fa260bd7c5',
            ext: '.ts',
          },
          {
            file: 'examples/vue-3-cli/src/stories/DynamicHeading.ts',
            hash: '8d67098a4f1524aac97dce0d12b2c813f45dde18',
            ext: '.ts',
          },
          {
            file: 'examples/vue-3-cli/src/stories/GlobalUsage.stories.js',
            hash: '9bdc4aa31b7cd9e610deda1bd9efbd5fa67fbf42',
            ext: '.js',
          },
          {
            file: 'examples/vue-3-cli/src/stories/GlobalUsage.vue',
            hash: '3c4d63e3bc6570cdea9bd3946064ab73bc16a04f',
            ext: '.vue',
          },
          {
            file: 'examples/vue-3-cli/src/stories/header.css',
            hash: 'acadc9ec8c7f4e7ed196d6901c12774a60ac30c1',
            ext: '.css',
          },
          {
            file: 'examples/vue-3-cli/src/stories/Header.stories.js',
            hash: 'eb7826516b6960707d5300f4272bc0123797d345',
            ext: '.js',
          },
          {
            file: 'examples/vue-3-cli/src/stories/Header.vue',
            hash: '45322e8c3d8fe77821edf01671d16e3e03549dcd',
            ext: '.vue',
          },
          {
            file: 'examples/vue-3-cli/src/stories/Introduction.stories.mdx',
            hash: '8b959a257af299fc75dcb5161752798d89b59ec1',
            ext: '.mdx',
          },
          {
            file: 'examples/vue-3-cli/src/stories/OverrideArgs.stories.js',
            hash: '0938f82089e9b166ac1c34e6795173a27879abbf',
            ext: '.js',
          },
          {
            file: 'examples/vue-3-cli/src/stories/OverrideArgs.vue',
            hash: 'b98424b021fb97f1e6b0a84760f1b615d9918cfe',
            ext: '.vue',
          },
          {
            file: 'examples/vue-3-cli/src/stories/page.css',
            hash: '51c9d099a139397dcbd6099e08701d3774af7f38',
            ext: '.css',
          },
          {
            file: 'examples/vue-3-cli/src/stories/Page.stories.js',
            hash: '8105bb165ce191b4d532a0d159c3547e66173e44',
            ext: '.js',
          },
          {
            file: 'examples/vue-3-cli/src/stories/Page.vue',
            hash: '2a95a0763e18569fb7bf9ea1d9c554d52e2566e0',
            ext: '.vue',
          },
          {
            file: 'examples/vue-3-cli/src/stories/ThemeDecorator.stories.js',
            hash: '178fa58c3e721f11df3bc40961850c3621c6f650',
            ext: '.js',
          },
          {
            file: 'examples/vue-3-cli/tsconfig.json',
            hash: 'd07e9296062991f776ac625582a496224cb18548',
            ext: '.json',
          },
          {
            file: 'examples/vue-3-cli/vuethreeshots.test.js',
            hash: '240b717c27b5dbb8d07f1a904530cb82189f63f1',
            ext: '.js',
          },
        ],
      },
    },
    '@storybook/addon-essentials': {
      name: '@storybook/addon-essentials',
      type: 'lib',
      data: {
        root: 'addons/essentials',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/essentials/package.json',
            hash: '41bac52b98375e19727bcac9e3d259222767389b',
            ext: '.json',
          },
          {
            file: 'addons/essentials/README.md',
            hash: 'e64e1c9199c7c35329284ae2622d5616c219c1ba',
            ext: '.md',
          },
          {
            file: 'addons/essentials/src/index.ts',
            hash: 'eb21585e1c7c897cdfd933c95e57bf89e4b42061',
            ext: '.ts',
          },
          {
            file: 'addons/essentials/src/typings.d.ts',
            hash: '8cf1e5fe3055c3dae25d0c2cf8378a1b93c15190',
            ext: '.ts',
          },
          {
            file: 'addons/essentials/tsconfig.json',
            hash: 'dfc6803adda98f9ae5804ff10ec65a534f553e13',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/example-devkits': {
      name: '@storybook/example-devkits',
      type: 'lib',
      data: {
        root: 'examples/dev-kits',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          debug: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'debug',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/dev-kits/logo.svg',
            hash: '93030fe56a2f8f8d47a68814d9a4e28724c107ac',
            ext: '.svg',
          },
          {
            file: 'examples/dev-kits/main.js',
            hash: '7da240e3c7a206663e18c78debc999d526b2db71',
            ext: '.js',
          },
          {
            file: 'examples/dev-kits/manager.js',
            hash: '7ba3c1f26be4ab606e27568a28a3de6c9824e2ef',
            ext: '.js',
          },
          {
            file: 'examples/dev-kits/package.json',
            hash: '7749d76db5a1b7070aebdf61a0df1b5047611222',
            ext: '.json',
          },
          {
            file: 'examples/dev-kits/README.md',
            hash: '0df0bb6d9ebb74f681309378dbe2854a0a1dcf05',
            ext: '.md',
          },
          {
            file: 'examples/dev-kits/stories/addon-decorator.js',
            hash: 'ac4fde50d41d8c32f77cfdc40630e8e5a5b5c9b4',
            ext: '.js',
          },
          {
            file: 'examples/dev-kits/stories/addon-roundtrip.js',
            hash: '22339cb90d5eccd12aec74bd382b1c1806f58b22',
            ext: '.js',
          },
          {
            file: 'examples/dev-kits/stories/addon-useaddonstate.tsx',
            hash: '4a90b9fba26a7d189dcf0613076ddaedc9773947',
            ext: '.tsx',
          },
          {
            file: 'examples/dev-kits/stories/addon-useglobalargs.js',
            hash: '4caa563a97855614dbccadd4ff27d97d80fa600f',
            ext: '.js',
          },
        ],
      },
    },
    '@storybook/example-react-ts': {
      name: '@storybook/example-react-ts',
      type: 'lib',
      data: {
        root: 'examples/react-ts',
        type: 'library',
        targets: {
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          debug: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'debug',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/react-ts/main.ts',
            hash: '3427cbbc2528b77540993364f9415a6868ba34ed',
            ext: '.ts',
          },
          {
            file: 'examples/react-ts/package.json',
            hash: '2d74933460a7b2dc2689d04d4ef4698f04c74941',
            ext: '.json',
          },
          {
            file: 'examples/react-ts/README.md',
            hash: '70d4f2ccb02b5a44c42c44620852baeeca80aecc',
            ext: '.md',
          },
          {
            file: 'examples/react-ts/src/button.stories.tsx',
            hash: '25d1fa42d34a1930642dc99313b3f1175ffc4f54',
            ext: '.tsx',
          },
          {
            file: 'examples/react-ts/src/button.tsx',
            hash: 'f3c9ee6b83ea54aa83827815b0be4fd705756a06',
            ext: '.tsx',
          },
          {
            file: 'examples/react-ts/src/emoji-button.js',
            hash: '716afa1238c0627aa53e5617c8aec37401256fd5',
            ext: '.js',
          },
          {
            file: 'examples/react-ts/src/emoji-button.stories.js',
            hash: '1e0fd80611343aa494de876a2a1d466c9a50591a',
            ext: '.js',
          },
          {
            file: 'examples/react-ts/tsconfig.json',
            hash: '5447ee7e4d86046ddd72d6a526a72bf6208d20a3',
            ext: '.json',
          },
        ],
      },
    },
    storybook: {
      name: 'storybook',
      type: 'lib',
      data: {
        root: 'lib/cli-storybook',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/cli-storybook/index.js',
            hash: '457ff863bb477e7808ff1f5981b3cfafe34548bb',
            ext: '.js',
          },
          {
            file: 'lib/cli-storybook/package.json',
            hash: '0453388c1e35bb2a37f0fb0717fda24d53e79800',
            ext: '.json',
          },
          {
            file: 'lib/cli-storybook/README.md',
            hash: 'f31715566811d43821bbbec5620c847e5d937215',
            ext: '.md',
          },
        ],
      },
    },
    '@storybook/client-logger': {
      name: '@storybook/client-logger',
      type: 'lib',
      data: {
        root: 'lib/client-logger',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/client-logger/package.json',
            hash: '9019fe9b56958efb24438e8d4c93477659f0b646',
            ext: '.json',
          },
          {
            file: 'lib/client-logger/README.md',
            hash: '3af0e2ad195727931e6f5d2e22b735dba9197a33',
            ext: '.md',
          },
          {
            file: 'lib/client-logger/src/index.test.ts',
            hash: 'f9004a47e7b96fc3e7aacce74c79b757027107a9',
            ext: '.ts',
          },
          {
            file: 'lib/client-logger/src/index.ts',
            hash: '702ef7c4fbfc24551612d2144493e873263209e9',
            ext: '.ts',
          },
          {
            file: 'lib/client-logger/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'lib/client-logger/tsconfig.json',
            hash: 'fe6570608ad0711b918c24dd26530ac8f2053fcb',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/source-loader': {
      name: '@storybook/source-loader',
      type: 'lib',
      data: {
        root: 'lib/source-loader',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/source-loader/extract-source.d.ts',
            hash: '24981dd9f2d6650261951210b135bf63b3c0bbe3',
            ext: '.ts',
          },
          {
            file: 'lib/source-loader/extract-source.js',
            hash: 'ef81dd6905197243ddf7e4e0b1fbfb433db0aad3',
            ext: '.js',
          },
          {
            file: 'lib/source-loader/package.json',
            hash: 'f3168ffba912859811f54410a5e02cdaa27f03fc',
            ext: '.json',
          },
          {
            file: 'lib/source-loader/README.md',
            hash: 'a2c825b77e8b85150bd0437b8d1bbe448a891e5c',
            ext: '.md',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/__snapshots__/inject-decorator.csf.test.js.snap',
            hash: '43967b344215fb8ed1d388913c7a1cec45a95f1a',
            ext: '.snap',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/__snapshots__/inject-decorator.test.js.snap',
            hash: '413752f99083a47955345aa0ae6cfb0a19f7b374',
            ext: '.snap',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/default-options.js',
            hash: '65ca9c768a287131433da37102ec38f4320402ab',
            ext: '.js',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/generate-helpers.js',
            hash: '423c5a622b66314fd404668b80f38a6a68b3c592',
            ext: '.js',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/inject-decorator.csf.test.js',
            hash: 'c26acb5cb834d2a000176c53372e0589c3e5d34b',
            ext: '.js',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/inject-decorator.js',
            hash: 'b60f858f7623a319f02122f3b225740ec9b90dc5',
            ext: '.js',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/inject-decorator.test.js',
            hash: '755feb9117fdb9fcdd12eb55e4ae1f2ddcc95e00',
            ext: '.js',
          },
          {
            file: 'lib/source-loader/src/abstract-syntax-tree/parse-helpers.js',
            hash: '72c3efdc4e374e1ac9e6a9468a18842587a89c1a',
            ext: '.js',
          },
          {
            file: 'lib/source-loader/src/abstract-syntax-tree/parsers/index.js',
            hash: 'b51073b51f3b9b38b285635f9c840c7aa3c5df79',
            ext: '.js',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/parsers/parser-flow.js',
            hash: '9414659af75434088826bb492bc8385fa9777ed6',
            ext: '.js',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/parsers/parser-js.js',
            hash: '657bd8ab8ae737cd63d47b089957196d9abf50fb',
            ext: '.js',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/parsers/parser-ts.js',
            hash: 'ef4e369bb22ad4f3bf568a89e423385e3e1e6435',
            ext: '.js',
          },
          {
            file:
              'lib/source-loader/src/abstract-syntax-tree/traverse-helpers.js',
            hash: '0e542918f04cc1af57479d2119267445398c6388',
            ext: '.js',
          },
          {
            file: 'lib/source-loader/src/build.js',
            hash: '96bda39b6cd808a3670a03ba6be6818c1149a4e2',
            ext: '.js',
          },
          {
            file: 'lib/source-loader/src/dependencies-lookup/readAsObject.js',
            hash: 'f38ca06141f4cefefe2f4b9b37412db2b00edd90',
            ext: '.js',
          },
          {
            file: 'lib/source-loader/src/extract-source.ts',
            hash: '72092adadc33027365021f9de03f63c63fdfb38e',
            ext: '.ts',
          },
          {
            file: 'lib/source-loader/src/index.ts',
            hash: 'f16952c1b6b8403fda055e8d9ffae63713b3c8b9',
            ext: '.ts',
          },
          {
            file: 'lib/source-loader/src/types.ts',
            hash: '4dcacdd03714689adec16e25e8644b1a6f941f67',
            ext: '.ts',
          },
          {
            file: 'lib/source-loader/tsconfig.json',
            hash: 'd1ee4fc75941ea63fc45ba234dca37d9882e1620',
            ext: '.json',
          },
        ],
      },
    },
    'vue-cli-example': {
      name: 'vue-cli-example',
      type: 'lib',
      data: {
        root: 'examples/vue-cli',
        type: 'library',
        targets: {
          build: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build',
            },
          },
          'build-storybook': {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'build-storybook',
            },
          },
          serve: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'serve',
            },
          },
          storybook: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'storybook',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'examples/vue-cli/.storybook/main.js',
            hash: 'acebe1931046843dc352f2b824f4894b8be8600a',
            ext: '.js',
          },
          {
            file: 'examples/vue-cli/.storybook/preview.js',
            hash: '909f159e872112af41b25234b826dfa85c70b08d',
            ext: '.js',
          },
          {
            file: 'examples/vue-cli/babel.config.js',
            hash: '078c0056ff32db2c6aecd61d8b539cea2b932bc6',
            ext: '.js',
          },
          {
            file: 'examples/vue-cli/package.json',
            hash: '5672d63e546ce02bb58bc4c066d2db84dd95cc34',
            ext: '.json',
          },
          {
            file: 'examples/vue-cli/README.md',
            hash: '07e0689d2ddf0ad9988cf976d66c43442049cbe7',
            ext: '.md',
          },
          {
            file: 'examples/vue-cli/src/App.vue',
            hash: 'd45bdace644fbb5f62f0c4391f981198c0ceb517',
            ext: '.vue',
          },
          {
            file: 'examples/vue-cli/src/button/Button.stories.ts',
            hash: '0b44fcdc1746ef0bf18aed02a28ec8c2054866e0',
            ext: '.ts',
          },
          {
            file: 'examples/vue-cli/src/button/Button.vue',
            hash: '165fa9e34ba1afbb7a7b4d1b900e18602287f603',
            ext: '.vue',
          },
          {
            file: 'examples/vue-cli/src/button/types.ts',
            hash: '5f6f11053c11e60369eeb702faed2b13313ca825',
            ext: '.ts',
          },
          {
            file: 'examples/vue-cli/src/main.ts',
            hash: '4e015510bd8f9ba4b91430dd84c5a27c06399b55',
            ext: '.ts',
          },
          {
            file: 'examples/vue-cli/src/shims-vue.d.ts',
            hash: 'd9f24faa42e74d0f178759f8f085a0541db6cc7c',
            ext: '.ts',
          },
          {
            file: 'examples/vue-cli/tsconfig.json',
            hash: '826f15ec18b80311e2c7320ca7319006fa465289',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-controls': {
      name: '@storybook/addon-controls',
      type: 'lib',
      data: {
        root: 'addons/controls',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file:
              'addons/controls/docs/media/addon-controls-args-annotated.png',
            hash: 'a61dd11eba0371bc2df1a4609e42c3c21890e6fe',
            ext: '.png',
          },
          {
            file:
              'addons/controls/docs/media/addon-controls-args-background-color.png',
            hash: 'd4e0205013a82b47c30281b67c6cbeed29c89a45',
            ext: '.png',
          },
          {
            file:
              'addons/controls/docs/media/addon-controls-args-background-string.png',
            hash: '61d7fe6e34d9cf36049d53d66f897e2c38a059d5',
            ext: '.png',
          },
          {
            file: 'addons/controls/docs/media/addon-controls-args-docs.png',
            hash: 'b95babb0b6a94f7384c4883124a7a03a2802b416',
            ext: '.png',
          },
          {
            file: 'addons/controls/docs/media/addon-controls-args-logging.png',
            hash: '8ba6066bff868d9fd25739d10a75a601e2e29b0c',
            ext: '.png',
          },
          {
            file:
              'addons/controls/docs/media/addon-controls-args-no-annotation.png',
            hash: '9f742e5571c286a8f82c5c6dd1d31440b934446f',
            ext: '.png',
          },
          {
            file:
              'addons/controls/docs/media/addon-controls-args-reflow-slider.png',
            hash: '012a117fbe0d42328b2e52afa07c6c4a4a3bee4f',
            ext: '.png',
          },
          {
            file: 'addons/controls/docs/media/addon-controls-args-reflow.png',
            hash: '1b37a41d8fa5f326db7f7a89f5de2515716e020b',
            ext: '.png',
          },
          {
            file: 'addons/controls/docs/media/addon-controls-args-template.png',
            hash: '3eeb7a50d23c2dbb755fc46190e9091628a8e39c',
            ext: '.png',
          },
          {
            file: 'addons/controls/docs/media/addon-controls-expanded.png',
            hash: 'e1d2be386da2bc17a2b9195ae0651ba2d68658df',
            ext: '.png',
          },
          {
            file: 'addons/controls/docs/media/addon-controls-hero.gif',
            hash: '9633ca0730994131ad85ca6d0b64b7f55c7479c1',
            ext: '.gif',
          },
          {
            file: 'addons/controls/docs/media/addon-controls-install.png',
            hash: 'd792128d66a73b4710395ff02f63c9b46d6b3407',
            ext: '.png',
          },
          {
            file: 'addons/controls/package.json',
            hash: '6e9185a75ad9fc120040e8bd6b192b08479b6689',
            ext: '.json',
          },
          {
            file: 'addons/controls/preset.js',
            hash: '1fac913bc69ba5bebe56dff0bf8f822a932135ac',
            ext: '.js',
          },
          {
            file: 'addons/controls/README.md',
            hash: 'cd9d9fb50b57c7e4600fee56c74e8e2cced1aa67',
            ext: '.md',
          },
          {
            file: 'addons/controls/register.js',
            hash: '681a5d09dcec36cdd321729db702f7c72894ef08',
            ext: '.js',
          },
          {
            file: 'addons/controls/src/constants.ts',
            hash: 'a2360dfff87c3708c82ec36add108446c13069f6',
            ext: '.ts',
          },
          {
            file: 'addons/controls/src/ControlsPanel.tsx',
            hash: '66b052a75186beb535727703ca57979e1faf67a2',
            ext: '.tsx',
          },
          {
            file: 'addons/controls/src/index.ts',
            hash: '0fe41f8142f4bb2404c15f69b1c5a3904b6f9c88',
            ext: '.ts',
          },
          {
            file: 'addons/controls/src/preset/ensureDocsBeforeControls.test.ts',
            hash: '2bfe0c390aca454e948173e29f39562d5d72c0e8',
            ext: '.ts',
          },
          {
            file: 'addons/controls/src/preset/ensureDocsBeforeControls.ts',
            hash: 'f15c1190c6c04162c4274d0db72da1eca0cb8f68',
            ext: '.ts',
          },
          {
            file: 'addons/controls/src/register.tsx',
            hash: '0c011a7c29cb4060b0f9924f148ec9b03efdc158',
            ext: '.tsx',
          },
          {
            file: 'addons/controls/tsconfig.json',
            hash: 'dfc6803adda98f9ae5804ff10ec65a534f553e13',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-toolbars': {
      name: '@storybook/addon-toolbars',
      type: 'lib',
      data: {
        root: 'addons/toolbars',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/toolbars/docs/hero.gif',
            hash: '0a07b42c403cda404a46fbc82fead27a4831d552',
            ext: '.gif',
          },
          {
            file: 'addons/toolbars/package.json',
            hash: 'd3f8ce334718bc54c52107deeb69f75e12b7faf6',
            ext: '.json',
          },
          {
            file: 'addons/toolbars/preset.js',
            hash: '656f27562a44abc3d348ddba81207901ab898bd8',
            ext: '.js',
          },
          {
            file: 'addons/toolbars/README.md',
            hash: 'ececb83c406b49f2f278892857be496a4000a5f3',
            ext: '.md',
          },
          {
            file: 'addons/toolbars/register.js',
            hash: '681a5d09dcec36cdd321729db702f7c72894ef08',
            ext: '.js',
          },
          {
            file: 'addons/toolbars/src/components/MenuToolbar.tsx',
            hash: 'b4094b21cba400b3b82f270705c62dce7953625a',
            ext: '.tsx',
          },
          {
            file: 'addons/toolbars/src/components/ToolbarManager.tsx',
            hash: 'ce88dc7ae0397f84e1ee43a2cf8e34c3019ae202',
            ext: '.tsx',
          },
          {
            file: 'addons/toolbars/src/constants.ts',
            hash: '1be8012f12e39fff818d06a7ade6ab57a15ca6bf',
            ext: '.ts',
          },
          {
            file: 'addons/toolbars/src/register.tsx',
            hash: '552f00c81ed576733be457f1599a384a1b6e5afc',
            ext: '.tsx',
          },
          {
            file: 'addons/toolbars/src/types.ts',
            hash: '6e9b38ddf9d0982b42261b2a108363eb31e046d4',
            ext: '.ts',
          },
          {
            file: 'addons/toolbars/tsconfig.json',
            hash: '78bae36b0b1100531ffe131e79cd851693fbbcf9',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-viewport': {
      name: '@storybook/addon-viewport',
      type: 'lib',
      data: {
        root: 'addons/viewport',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/viewport/docs/viewport.png',
            hash: 'ccbbda17e76ebcca116c77a6476e0f6756558780',
            ext: '.png',
          },
          {
            file: 'addons/viewport/package.json',
            hash: 'd39304f49c6f7065a95f17bfdeb5c05324f71bb3',
            ext: '.json',
          },
          {
            file: 'addons/viewport/preset.js',
            hash: '656f27562a44abc3d348ddba81207901ab898bd8',
            ext: '.js',
          },
          {
            file: 'addons/viewport/README.md',
            hash: '1dc1240f2d58fb94d6ba6e969a7634c5af58b762',
            ext: '.md',
          },
          {
            file: 'addons/viewport/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/viewport/src/constants.ts',
            hash: 'db9c73f1976fd4e0b2eb0232f47a2954e5b0b9d9',
            ext: '.ts',
          },
          {
            file: 'addons/viewport/src/defaults.ts',
            hash: '754c6c78cbe2f3bb7f7a946ad31539444f3cf3a5',
            ext: '.ts',
          },
          {
            file: 'addons/viewport/src/models/index.ts',
            hash: '0cc15c61f9148403ae6b6ca6d763f1494652652f',
            ext: '.ts',
          },
          {
            file: 'addons/viewport/src/models/Viewport.ts',
            hash: '76a5eb096777ee3757ea0cae75b4010142b55c77',
            ext: '.ts',
          },
          {
            file: 'addons/viewport/src/models/ViewportAddonParameter.ts',
            hash: '84e278d91f9cf6afc75a9f8d92882f12639c57ff',
            ext: '.ts',
          },
          {
            file: 'addons/viewport/src/preview.ts',
            hash: '05f32144967d0ff32c987798c6d9ec10c222d0ab',
            ext: '.ts',
          },
          {
            file: 'addons/viewport/src/register.tsx',
            hash: 'fab48d369678bf022ad38497d085cf098be42593',
            ext: '.tsx',
          },
          {
            file: 'addons/viewport/src/Tool.tsx',
            hash: 'fbe90057048866dba0da73cf96c691590151109d',
            ext: '.tsx',
          },
          {
            file: 'addons/viewport/tsconfig.json',
            hash: 'd1ee4fc75941ea63fc45ba234dca37d9882e1620',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/core-client': {
      name: '@storybook/core-client',
      type: 'lib',
      data: {
        root: 'lib/core-client',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/core-client/package.json',
            hash: '39e5be3b9111264ad4061000251d34e7c5ea8d02',
            ext: '.json',
          },
          {
            file: 'lib/core-client/README.md',
            hash: '1e59a4ab13b33a2fbcc329617bdb54134a28f051',
            ext: '.md',
          },
          {
            file: 'lib/core-client/src/index.ts',
            hash: '2e0141f9cf39dc7ba593316de6a044cb924b5380',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/manager/conditional-polyfills.ts',
            hash: '3f98ebc20a17571d403c4c84ebb003d35fc2e6cb',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/manager/index.ts',
            hash: 'e63acd2424a1382d138b606e909bcf6e541f9cad',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/manager/provider.ts',
            hash: '7cccd4f39f47e238aa577edb18703b7d8fc02df4',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/index.ts',
            hash: 'ea453a5742973766dca53040f17b4fa29de11d24',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/loadCsf.test.ts',
            hash: 'ed1ec9b46e00fa8779a56187685c78f610089f77',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/loadCsf.ts',
            hash: '6d54ec2f51937912d6fa92d22f04a61daa1973bc',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/NoDocs.tsx',
            hash: 'b6932363d1ac627beb22b8d7720d285b09fa3054',
            ext: '.tsx',
          },
          {
            file: 'lib/core-client/src/preview/parseArgsParam.test.ts',
            hash: '4208791b7138c154df3919d4152a60e2d06f398c',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/parseArgsParam.ts',
            hash: 'b0e79f9aa0545ab462bfa1ab91917f305ba7cb32',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/start.test.ts',
            hash: 'a9c8b6fe9c750426c83c82447d9fa918dc61ba9d',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/start.ts',
            hash: '1de9f8e6f9091dfa331e8bb990f014dfc5cebbb6',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/StoryRenderer.test.ts',
            hash: 'f50728f39d657bdd36d03b7eca595bd7b4d69caf',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/StoryRenderer.tsx',
            hash: '262ac2b44fc8919a72fafb115a212f618484c305',
            ext: '.tsx',
          },
          {
            file: 'lib/core-client/src/preview/types.ts',
            hash: 'd964e501260948b6546b7ad1610aa60f70e9b372',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/url.test.ts',
            hash: 'f004820049dfeb63527e4343fe71e79a76b77d4c',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/preview/url.ts',
            hash: '6e4cf8c7683d7d62cf104b192e47ddd4e355998c',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/src/typings.d.ts',
            hash: '4d6c70f7c7037e9843ccbb2fa6d2cd1fbe470678',
            ext: '.ts',
          },
          {
            file: 'lib/core-client/tsconfig.json',
            hash: 'f7457fe9690c707c4ec10223fda810625743cb90',
            ext: '.json',
          },
          {
            file: 'lib/core-client/typings.d.ts',
            hash: 'faea2fff4fbe767651dac6688b02061f78f4bda4',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/core-common': {
      name: '@storybook/core-common',
      type: 'lib',
      data: {
        root: 'lib/core-common',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/core-common/package.json',
            hash: '3ac6f134d85aba4522595d4ee5570e91ccc2416d',
            ext: '.json',
          },
          {
            file: 'lib/core-common/README.md',
            hash: '3fc05c4c32c86c4d2b7f71f6b5703788c2c1452d',
            ext: '.md',
          },
          {
            file: 'lib/core-common/src/config.test.ts',
            hash: 'be68656ad1eba543f39fe7e9f6c6e7bf84a13205',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/index.ts',
            hash: '9a3d73d7e9294997081c700fd604b6d7f45a75dd',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/presets.test.ts',
            hash: '605befaea5ab40b6a9ffbb36a8a3d61a71b4ccb0',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/presets.ts',
            hash: '9782a574277ebf4bf7d6f84ee3531d3a5fc8f4e9',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/templates/base-manager-head.html',
            hash: '8141504c0f20f27708bb9cdc85e1f43d9b2ab98c',
            ext: '.html',
          },
          {
            file: 'lib/core-common/src/templates/base-preview-body.html',
            hash: '71c0b67fde9bb9211dae247545ee4c3945674cba',
            ext: '.html',
          },
          {
            file: 'lib/core-common/src/templates/base-preview-head.html',
            hash: 'f6f6f49a9e6b5c2de797b6e808f83303699e23d4',
            ext: '.html',
          },
          {
            file: 'lib/core-common/src/templates/index.ejs',
            hash: '987898611ebc9cbf6065c76897397e0b5d8d37cb',
            ext: '.ejs',
          },
          {
            file: 'lib/core-common/src/types.ts',
            hash: '104350cb708f9647086f2fa5f1c528f7307fa636',
            ext: '.ts',
          },
          {
            file:
              'lib/core-common/src/utils/__tests__/__snapshots__/merge-webpack-config.test.ts.snap',
            hash: 'ddc929b507adb3791e852cf5bd723bd0b35e45cc',
            ext: '.snap',
          },
          {
            file: 'lib/core-common/src/utils/__tests__/interpret-files.test.ts',
            hash: 'eeea6d7ce13a543e604b3611283373caa6a47e69',
            ext: '.ts',
          },
          {
            file:
              'lib/core-common/src/utils/__tests__/merge-webpack-config.test.ts',
            hash: '748bc4e1f2144c1d39f05a7449a2a95fb14102f4',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/__tests__/template.test.ts',
            hash: '94dbb8541ce077a2055c7c37ed34f0df82a2b242',
            ext: '.ts',
          },
          {
            file:
              'lib/core-common/src/utils/__tests__/to-require-context.test.ts',
            hash: '21640243daa99cc953c37a97e6cbb531f14d3503',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/babel.ts',
            hash: '9bc8d2bf3b9e741382e73bc529279b9dff7ca0d2',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/check-webpack-version.ts',
            hash: '46cbac2ca5404397cd3e8c7ab36700f0a66e75ee',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/envs.ts',
            hash: '9b12de4d8a40c85218e3893f831d70ed29e30a90',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/es6Transpiler.ts',
            hash: '06164876cf74bd69149c66cc3a0e3f9e99189de3',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/interpolate.ts',
            hash: '43e826efc35ffe255f378950b1fb04330f503345',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/interpret-files.ts',
            hash: '280c10c76a7ee76821eed06e2ab6086d2594fc95',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/interpret-require.ts',
            hash: '9f4c4dd9831c5ed926e1931a5c567540b7f8c489',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/load-custom-babel-config.ts',
            hash: '7b1faaf8c997ae6a20f088491be89b8d90ca16db',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/load-custom-presets.ts',
            hash: 'efa4499240469fc00c701db2578dda42271f81e2',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/load-custom-webpack-config.ts',
            hash: 'cf29ee712745485dbf69083425050edeac0ef78e',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/load-manager-or-addons-file.ts',
            hash: 'e89c8b04ea37af048d1a90153ab8df5717ace0b6',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/load-preview-or-config-file.ts',
            hash: 'b15e3827a053bdb819ff5c3d40cb21a7524aeb56',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/log-config.ts',
            hash: '26033f9b33d1be484a8aa852530379246b8bb4b0',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/merge-webpack-config.ts',
            hash: '96856bb57b52fae76a8adc6124aa4e6f74c34689',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/paths.ts',
            hash: 'baf20a655f95586af9da4bb8bf59272201f5becf',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/print-duration.ts',
            hash: 'b7bcad0c629575a0b38f6315addf4e30bb4641a3',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/progress-reporting.ts',
            hash: 'e6e1c60b86c5e54a90db97b0922ae50dc2523822',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/resolve-path-in-sb-cache.ts',
            hash: '7157abdc02575eedc661ef4b1f89782816f80ecf',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/template.ts',
            hash: '12a7c1c9e2b7c0e0865e88219cceac44f07b748b',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/to-require-context.ts',
            hash: 'f8f4976d67f053f3dc67b7f82f8bb5747f939449',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/src/utils/validate-configuration-files.ts',
            hash: 'b6c30a2414bd537650f8d3f427658a39d2c47ff6',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/tsconfig.json',
            hash: 'c013cb37095c41f135396b7bedca8efe585dc708',
            ext: '.json',
          },
          {
            file: 'lib/core-common/types/index.ts',
            hash: 'c4dffbd85d00924a69c858f239198528110a1169',
            ext: '.ts',
          },
          {
            file: 'lib/core-common/typings.d.ts',
            hash: '4a7f19019bcc1852316b6aa8cedcc19a53436fe7',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/core-events': {
      name: '@storybook/core-events',
      type: 'lib',
      data: {
        root: 'lib/core-events',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/core-events/package.json',
            hash: '1b16db1f35a5fd1e6b7fcd6fa3e0cabf58e156b5',
            ext: '.json',
          },
          {
            file: 'lib/core-events/src/index.test.ts',
            hash: '1ee0a9a7447f0f191525553d4395e868d35f7b64',
            ext: '.ts',
          },
          {
            file: 'lib/core-events/src/index.ts',
            hash: 'bf7850305b44173e215e1db148824d8480f2eee4',
            ext: '.ts',
          },
          {
            file: 'lib/core-events/tsconfig.json',
            hash: '61cbbd6356c3da4d4cfe0d110704238935c617ae',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/core-server': {
      name: '@storybook/core-server',
      type: 'lib',
      data: {
        root: 'lib/core-server',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/core-server/package.json',
            hash: '9189c8ba7f0a6db537ffcacfccce76a33b3ef856',
            ext: '.json',
          },
          {
            file: 'lib/core-server/README.md',
            hash: '6cd081ce92fc6e354855d263fc40f06d035e6d7a',
            ext: '.md',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/cra-ts-essentials_manager-dev',
            hash: 'cf5bf2f46f79be61a9dd472e38ab8480f54746ca',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/cra-ts-essentials_manager-prod',
            hash: '859cd50c56b6d20c122379417cf047a83d62a8b7',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/cra-ts-essentials_preview-dev',
            hash: '10c1527074673ecbbbff22827962568d0372396f',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/cra-ts-essentials_preview-prod',
            hash: '45e3985451a9e48be5fa260d74b9508dfebe5cf3',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/html-kitchen-sink_manager-dev',
            hash: 'b2de2e9886f74c2fa6f25ed86bac65c5e62ad9dc',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/html-kitchen-sink_manager-prod',
            hash: '6d453d4947b83fe06d6fd93661770786a87fe1c6',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/html-kitchen-sink_preview-dev',
            hash: '0922eaa22744665efc29776d8773dceeddf4fa00',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/html-kitchen-sink_preview-prod',
            hash: '4c89968b72e4db57edf7ffae17c3bcbb517b5b84',
            ext: '',
          },
          {
            file: 'lib/core-server/src/__snapshots__/vue-3-cli_manager-dev',
            hash: 'd1f03ab069e4c24e92eae37b09f5c12672617707',
            ext: '',
          },
          {
            file: 'lib/core-server/src/__snapshots__/vue-3-cli_manager-prod',
            hash: '12a989f3291efb84d46b8e48140c7648e3f9e6a9',
            ext: '',
          },
          {
            file: 'lib/core-server/src/__snapshots__/vue-3-cli_preview-dev',
            hash: '67f1955285c9916b84177019d1185d651e86d63c',
            ext: '',
          },
          {
            file: 'lib/core-server/src/__snapshots__/vue-3-cli_preview-prod',
            hash: '9496cef9cc219e4ed93c6c7650fa609667a4d9a5',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/web-components-kitchen-sink_manager-dev',
            hash: 'f0ad29fdbedb270cd4ae597f27314f4e93c54e1f',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/web-components-kitchen-sink_manager-prod',
            hash: '539dcebbf28e589697a6227b55b1f23b0d661dd2',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/web-components-kitchen-sink_preview-dev',
            hash: '6678d7fb441adf7a99bd2c2f408cd56de99e6d2a',
            ext: '',
          },
          {
            file:
              'lib/core-server/src/__snapshots__/web-components-kitchen-sink_preview-prod',
            hash: 'e89fc5cfd4fad415273bbc7967e521a89b0fceaa',
            ext: '',
          },
          {
            file: 'lib/core-server/src/build-dev.test.ts',
            hash: '3e3545a0c50deb99c52b5a003ef19b346ae01f9b',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/build-dev.ts',
            hash: '7d2b6f7c779a27950c96cffab156d0eb8b79e935',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/build-static.ts',
            hash: 'ae86deb7b16159b6e74589f1e69ea4fd2518e25b',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/cli/dev.ts',
            hash: 'c0f7a60b27e0b54948fab8e9b6a8074fb3d8385f',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/cli/index.ts',
            hash: '825ba73331d0d139b96f0c4cddad4d224a0cdd23',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/cli/prod.ts',
            hash: '205032b8473b52c712c36db670d525b53f2fc1e6',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/cli/utils.ts',
            hash: '03e1baae0d336a0efadd043f57785111fb3643f0',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/core-presets.test.ts',
            hash: 'e3e763d50c371993b364a97db0fca2fe2a9d97f4',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/dev-server.ts',
            hash: 'ebc4517ab5ed98bac7ad09faf3de73238962ced4',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/globals/globals.ts',
            hash: 'eeac02b862229aaff4b0879a0ff1e634189baec5',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/globals/polyfills.ts',
            hash: '23015707ef0b10c7529d4d7e0be7523018769cae',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/index.ts',
            hash: '945498c31c8d8e24beec2373ea7af49956b282b6',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/manager/babel-loader-manager.ts',
            hash: 'd5837ce290929368e9498a7e5eae80042d6ed018',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/manager/builder.ts',
            hash: '96e28564491a571e9d9a1f044690b9b57b08f84c',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/manager/manager-config.ts',
            hash: '8695a337bf55439a1832eb1cfe2d921c9fc568a3',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/manager/manager-webpack.config.ts',
            hash: '7e30ac15aa5b79f656471ab0e2866fc1ca76e103',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/manager/virtualModuleRef.template.js',
            hash: 'a7ac896f4197470557ead056bcd33bb2a7ab5cb5',
            ext: '.js',
          },
          {
            file: 'lib/core-server/src/presets/babel-cache-preset.ts',
            hash: '02c200c33d235c1f5b7f72c22e9713c0812a89b2',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/presets/common-preset.ts',
            hash: 'f89e72bcda3961b37c3cdc4bdb7a37cf264aaf97',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/presets/manager-preset.ts',
            hash: '6ed50054964480a6cc8c047f63f9a6d5c3724a2d',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/public/favicon.ico',
            hash: '428500fde188122fe8a6b07197f4c03f4e93640a',
            ext: '.ico',
          },
          {
            file: 'lib/core-server/src/standalone.ts',
            hash: 'f3452eb6c6af8e3e83be77c029883d04196efa66',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/__tests__/server-address.test.ts',
            hash: '351061347db9a7944afcb1ee8d463ec99e5a0c02',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/__tests__/server-statics.test.ts',
            hash: '411511ce0b0574590e87e3875e1414373c7fe63d',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/cache.ts',
            hash: 'ccfe3da4ef8b5a89a1987b1a17322fc68abf564d',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/copy-all-static-files.ts',
            hash: '68d9eabe7e7a63bdbfc2ec6df991ea8f4dccdd6d',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/get-preview-builder.ts',
            hash: '55eacbbf83f6b84c7429424864a73a67f3901850',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/manager-cache.ts',
            hash: '5bc88fde3672f213fe0ea46585fad073ecd138e6',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/middleware.ts',
            hash: '132847cd692e56f9687fdd7f4ca7032eec2a6e3e',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/open-in-browser.ts',
            hash: '24498bc880b81c47b71a8f26f46f46f38715cad3',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/output-startup-information.ts',
            hash: '1190edf17d319cc42f8054dcf18df8d2fee26db1',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/output-stats.ts',
            hash: '0f8cbc07dd67cf67d17456189553e19db1c61ede',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/prebuilt-manager.ts',
            hash: '44757bb3a16ddec8132d84930f2826bf19489c0c',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/release-notes.ts',
            hash: '0de1ccb2bd19b47ec119a70132a2169e25129cfa',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/server-address.ts',
            hash: '7b0fee2c9aa827f63551674a22962dbe6681941d',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/server-init.ts',
            hash: '8ef8f646343bbb81338398d6d88de695b99d93b5',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/server-statics.ts',
            hash: 'b7ad357beb2f0bc44878406b0124e239b1be3161',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/src/utils/update-check.ts',
            hash: 'd68af6d304c0e97e0e416f359bc64a2c05aed35a',
            ext: '.ts',
          },
          {
            file: 'lib/core-server/standalone.js',
            hash: 'eed7976ad61755e42ae45abf46ea95160b8e33d9',
            ext: '.js',
          },
          {
            file: 'lib/core-server/tsconfig.json',
            hash: 'c013cb37095c41f135396b7bedca8efe585dc708',
            ext: '.json',
          },
          {
            file: 'lib/core-server/typings.d.ts',
            hash: '94f3fdaa25380be2708271677cb185ff06c56acc',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/node-logger': {
      name: '@storybook/node-logger',
      type: 'lib',
      data: {
        root: 'lib/node-logger',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/node-logger/package.json',
            hash: '775149c98b15a63eae51359631efbb3c0aeccfbc',
            ext: '.json',
          },
          {
            file: 'lib/node-logger/README.md',
            hash: '8950dedc4516147c2f39b2d42bbcbba6382f6216',
            ext: '.md',
          },
          {
            file: 'lib/node-logger/src/index.test.ts',
            hash: '40188dbc8cebe25386dcf81df294003fce26aab7',
            ext: '.ts',
          },
          {
            file: 'lib/node-logger/src/index.ts',
            hash: '07beaa620bbbc3d8c4d0c7be16cbb08d521cf51d',
            ext: '.ts',
          },
          {
            file: 'lib/node-logger/tsconfig.json',
            hash: '61cbbd6356c3da4d4cfe0d110704238935c617ae',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/postinstall': {
      name: '@storybook/postinstall',
      type: 'lib',
      data: {
        root: 'lib/postinstall',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/postinstall/package.json',
            hash: '1d964231637667a3dfc8c2056d230661cdd1168a',
            ext: '.json',
          },
          {
            file: 'lib/postinstall/README.md',
            hash: 'bee84e17f8d2536df0c1fd21387661373c8400f1',
            ext: '.md',
          },
          {
            file:
              'lib/postinstall/src/__testfixtures__/presets-add-preset-options/basic.input.js',
            hash: '40a844e905a515464e7d5a13a76a3a9650ee7dc7',
            ext: '.js',
          },
          {
            file:
              'lib/postinstall/src/__testfixtures__/presets-add-preset-options/basic.output.snapshot',
            hash: '4a3d8bd7e284c305696b30b77651921d841438cc',
            ext: '.snapshot',
          },
          {
            file:
              'lib/postinstall/src/__testfixtures__/presets-add-preset-options/empty.input.js',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.js',
          },
          {
            file:
              'lib/postinstall/src/__testfixtures__/presets-add-preset-options/empty.output.snapshot',
            hash: 'a28c9e8e64197629a8de83241545d7f5020e76b5',
            ext: '.snapshot',
          },
          {
            file:
              'lib/postinstall/src/__testfixtures__/presets-add-preset/basic.input.js',
            hash: '40a844e905a515464e7d5a13a76a3a9650ee7dc7',
            ext: '.js',
          },
          {
            file:
              'lib/postinstall/src/__testfixtures__/presets-add-preset/basic.output.snapshot',
            hash: 'aaf16d58b3d82bdf0f56a215d75f6eda5a878b25',
            ext: '.snapshot',
          },
          {
            file:
              'lib/postinstall/src/__testfixtures__/presets-add-preset/empty.input.js',
            hash: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
            ext: '.js',
          },
          {
            file:
              'lib/postinstall/src/__testfixtures__/presets-add-preset/empty.output.snapshot',
            hash: '9acaaca175c27c77b873769b7226df8cca4f02f5',
            ext: '.snapshot',
          },
          {
            file:
              'lib/postinstall/src/__testtransforms__/presets-add-preset-options.js',
            hash: 'aacd83f2f86e21e384a1a32cb2833d5f800f012d',
            ext: '.js',
          },
          {
            file:
              'lib/postinstall/src/__testtransforms__/presets-add-preset.js',
            hash: '76b5fa60fb214ced0e507879db634e51b640238d',
            ext: '.js',
          },
          {
            file: 'lib/postinstall/src/codemods.test.ts',
            hash: 'dd7b4273aca610467611a648a698460b5375de5d',
            ext: '.ts',
          },
          {
            file: 'lib/postinstall/src/frameworks.test.ts',
            hash: '32192dacfca1271d4824a343a5fa1a94d6678a10',
            ext: '.ts',
          },
          {
            file: 'lib/postinstall/src/frameworks.ts',
            hash: 'ee9260e2c230e30fc5bb0ae2bf2b21b6c7f30a7e',
            ext: '.ts',
          },
          {
            file: 'lib/postinstall/src/index.ts',
            hash: 'e9b7c48ca0478825a40cc07284708b48f8a67269',
            ext: '.ts',
          },
          {
            file: 'lib/postinstall/src/presets.ts',
            hash: 'fe6c61f75b198eefcabe8ed4d77b80bc43d6f753',
            ext: '.ts',
          },
          {
            file: 'lib/postinstall/tsconfig.json',
            hash: 'a24ec6393862ab12a636f0c2abadae82bf1f9428',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-actions': {
      name: '@storybook/addon-actions',
      type: 'lib',
      data: {
        root: 'addons/actions',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/actions/ADVANCED.md',
            hash: '2ef8719e282daf588f8a450881b5ad2e09976069',
            ext: '.md',
          },
          {
            file: 'addons/actions/docs/screenshot.png',
            hash: '361e9556427b48f3a4ea6613ef5185b2e676dbe6',
            ext: '.png',
          },
          {
            file: 'addons/actions/package.json',
            hash: 'e3488e5fe6256afa90ae2c8f54b749d7d6ee89d3',
            ext: '.json',
          },
          {
            file: 'addons/actions/preset.js',
            hash: 'ba70abe968e6e3cc90492c8d9342570621e971c7',
            ext: '.js',
          },
          {
            file: 'addons/actions/README.md',
            hash: 'e01d797eba23c9b1648b0978c4d084c42388b981',
            ext: '.md',
          },
          {
            file: 'addons/actions/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/actions/src/components/ActionLogger/index.tsx',
            hash: 'e2cd0c6fc44a0a1b728184524757009c7227caae',
            ext: '.tsx',
          },
          {
            file: 'addons/actions/src/components/ActionLogger/style.tsx',
            hash: '4ffe870286c89e34a9d08f3bb2acd0d2f0358849',
            ext: '.tsx',
          },
          {
            file: 'addons/actions/src/constants.ts',
            hash: '9bc6f11ef5c4e7be170eb31cf44757579ee53c30',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/containers/ActionLogger/index.tsx',
            hash: '2de6c68f9ad9ff294429ec2d3804169b40103af0',
            ext: '.tsx',
          },
          {
            file: 'addons/actions/src/index.ts',
            hash: '8eeba5a84f1038db418e0854d611f2282706873e',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/models/ActionDisplay.ts',
            hash: 'c3039db325fe568182367fee2962e8677eb871d1',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/models/ActionOptions.ts',
            hash: 'c4a838b17c25da569309cdc461be059484e1404c',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/models/ActionsFunction.ts',
            hash: '8c870cdf5ad18daac99eef8f38cb8733a8107f1d',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/models/ActionsMap.ts',
            hash: '7dde0c7c0ddd3490ac685239592eb6dcc400f36f',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/models/DecoratorFunction.ts',
            hash: '9ea17af0ec5def73098552cc07eeb5860cb47a85',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/models/HandlerFunction.ts',
            hash: 'fc96f4d2af5918c680fda6323ece94990909fa7a',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/models/index.ts',
            hash: 'd8c7de6271d0445bf557dc83db2ae1b7c990d8d9',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preset/addArgs.ts',
            hash: '6b65f3e3dd1b5115e1244e3e791d68409ccf5305',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preset/addArgsHelpers.test.ts',
            hash: '09593ec4a2f02ab6c3a3ac99e6a57dd8f9b12832',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preset/addArgsHelpers.ts',
            hash: '91cbf930a86f72983759a54bd3d7337d5a2bfeea',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preset/addDecorator.ts',
            hash: 'f0044588cc2f493004f0a855050cd91b3dc0920c',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preview/__tests__/action.test.js',
            hash: 'dc1965084c924f1f485361ce518325c13db892f1',
            ext: '.js',
          },
          {
            file: 'addons/actions/src/preview/__tests__/actions.test.js',
            hash: '128d6d856ac33c917d838f45720c35a6b980d4fe',
            ext: '.js',
          },
          {
            file:
              'addons/actions/src/preview/__tests__/configureActions.test.js',
            hash: '7bebbe8a252410db9abe13c2b5c7737bf06a75d1',
            ext: '.js',
          },
          {
            file: 'addons/actions/src/preview/action.ts',
            hash: '945c94dc33a97fe57d81990a8e1f823d5fedb250',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preview/actions.ts',
            hash: '9e595ed7a1519cfd0f5c442fbeb7a16abc98a338',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preview/configureActions.ts',
            hash: '24a31b5d60b11248c6b27e72437d312a162be795',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preview/decorateAction.ts',
            hash: 'b84f49bdb20a15be21bc418993caebf098c9f096',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preview/index.ts',
            hash: 'b5358d2c4441b65d6b273e553de690b47877d6df',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/preview/withActions.ts',
            hash: '2d78b764f2f18df125f761b39a3f5d578450076e',
            ext: '.ts',
          },
          {
            file: 'addons/actions/src/register.tsx',
            hash: 'b4db8997c514f35611a03a601738dbf3205db1dd',
            ext: '.tsx',
          },
          {
            file: 'addons/actions/src/typings.d.ts',
            hash: '7361d8d2103afc524a5458fd1514ee206e67076c',
            ext: '.ts',
          },
          {
            file: 'addons/actions/tsconfig.json',
            hash: '78bae36b0b1100531ffe131e79cd851693fbbcf9',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-graphql': {
      name: '@storybook/addon-graphql',
      type: 'lib',
      data: {
        root: 'addons/graphql',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/graphql/docs/screenshot.png',
            hash: '5af5f5ba921c7cbf4a9cb54a3fef4cc5e85dfa8a',
            ext: '.png',
          },
          {
            file: 'addons/graphql/package.json',
            hash: 'bb378b27bafaf3f5aa6ef0932709a1971e84874c',
            ext: '.json',
          },
          {
            file: 'addons/graphql/preset.js',
            hash: 'bb321539dc0f5ce4929ed99717bb8665a9a0d905',
            ext: '.js',
          },
          {
            file: 'addons/graphql/README.md',
            hash: '6284a542890e7ce13ad68e036e1594b421091889',
            ext: '.md',
          },
          {
            file: 'addons/graphql/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/graphql/src/components/FullScreen/index.tsx',
            hash: '692b699be613f08bd15531fb91e94628e0844dad',
            ext: '.tsx',
          },
          {
            file: 'addons/graphql/src/components/FullScreen/style.ts',
            hash: '7ab99d2e007df6de16b22224ad1c38b3008c5d5e',
            ext: '.ts',
          },
          {
            file: 'addons/graphql/src/index.ts',
            hash: '12bf910a2982753b19aec3e1c13e582001a40e0f',
            ext: '.ts',
          },
          {
            file: 'addons/graphql/src/manager.tsx',
            hash: '7a858517da8dddd43bb569c1958fdee109c3dc80',
            ext: '.tsx',
          },
          {
            file: 'addons/graphql/src/preview.tsx',
            hash: '526aeb7788e599cc56c72a51915072c542f7aec7',
            ext: '.tsx',
          },
          {
            file: 'addons/graphql/src/register.ts',
            hash: '083dc673f6cf190ab34814bb2122f66154c066ae',
            ext: '.ts',
          },
          {
            file: 'addons/graphql/src/shared.ts',
            hash: '0f4031d74b3b892bf353a38f5022e586c682ea6d',
            ext: '.ts',
          },
          {
            file: 'addons/graphql/src/typings.d.ts',
            hash: '5f9d57c3ece1811f43a7796cd9f13177c0a4591e',
            ext: '.ts',
          },
          {
            file: 'addons/graphql/tsconfig.json',
            hash: '5b9ce3493e79151e382ae23650af762b6fd7278b',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/marionette': {
      name: '@storybook/marionette',
      type: 'lib',
      data: {
        root: 'app/marionette',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/marionette/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/marionette/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/marionette/package.json',
            hash: 'a3d202815b43f1f41a98a6aa7cfccf9deb10b438',
            ext: '.json',
          },
          {
            file: 'app/marionette/README.md',
            hash: '588aef1c04910d3d8f830cd387c8145f9ba8b2b6',
            ext: '.md',
          },
          {
            file: 'app/marionette/src/client/index.ts',
            hash: '8034a9d6433dd177a2f3a97a3e6c3c4c3cfb469b',
            ext: '.ts',
          },
          {
            file: 'app/marionette/src/client/preview/element_check.ts',
            hash: '41444e3d889b0887812ee6935e466bb90598e10e',
            ext: '.ts',
          },
          {
            file: 'app/marionette/src/client/preview/globals.ts',
            hash: '168d2f7c49ac5db7580f75ad9efffa26fe71cdc1',
            ext: '.ts',
          },
          {
            file: 'app/marionette/src/client/preview/index.ts',
            hash: 'b2505cac83b185a802d61d3b1903c26b261f7b64',
            ext: '.ts',
          },
          {
            file: 'app/marionette/src/client/preview/render.ts',
            hash: '11f3d417b5030a564daba6f7b38fec58a426e47a',
            ext: '.ts',
          },
          {
            file: 'app/marionette/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/marionette/src/server/framework-preset-marionette.ts',
            hash: '71f45f7079d22ca2cd9b2788456bd46890781365',
            ext: '.ts',
          },
          {
            file: 'app/marionette/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/marionette/src/server/options.ts',
            hash: '9cca3a60b51a7838ace290dab5be25d057d1d1b2',
            ext: '.ts',
          },
          {
            file: 'app/marionette/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'app/marionette/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/marionette/tsconfig.json',
            hash: '08bdb7764f7628be93224ed1b28b56c35990e5e0',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/client-api': {
      name: '@storybook/client-api',
      type: 'lib',
      data: {
        root: 'lib/client-api',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/client-api/package.json',
            hash: '6a18ba146223d218a1c6935f62708128df057717',
            ext: '.json',
          },
          {
            file: 'lib/client-api/README.md',
            hash: 'ad408a61069de12a34ac64f797c4ab18cf8de593',
            ext: '.md',
          },
          {
            file: 'lib/client-api/src/args.test.ts',
            hash: '559a8783d5a07496b3208b2ae07f81d36f151245',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/args.ts',
            hash: 'f2816057fead2105b2679440b7eaeb67cda8996c',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/client_api.test.ts',
            hash: 'f5162835693d2e9ce3fde1702b30dd1fcb7a5447',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/client_api.ts',
            hash: 'dd30236e773088b660a056acea9ac4b4a375ab95',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/config_api.ts',
            hash: 'ed4a6d2263815f8f6748f68d619f5d6c92bf510f',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/decorators.test.ts',
            hash: 'd7513feea95c7780270f17f5c4efad155b950256',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/decorators.ts',
            hash: '8e51b7d580d0e975c818402d2cf58dc97d45f5af',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/ensureArgTypes.ts',
            hash: 'b03aa0291a6f8775e1eeb8720a44d1ea8abc7f74',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/filterArgTypes.ts',
            hash: '60b19d7420690affb7c40fba1c03de0c276d9c94',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/hooks.test.js',
            hash: '9faf374b9ac48eb857d07052979aff7218596629',
            ext: '.js',
          },
          {
            file: 'lib/client-api/src/hooks.ts',
            hash: '69ad8b95e6918b4c3dfdc8bde269b33aff7eb632',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/index.ts',
            hash: '844d7234d529b449cc6f3f056be51a15dc688bb5',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/inferArgTypes.ts',
            hash: 'ed2a3b1cacfd395c2f9f9176b13d23e5c527a3fd',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/inferControls.ts',
            hash: 'b33c674c97750d8bf9d80273c156e15ff95c4060',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/parameters.test.ts',
            hash: 'e0ed1bc03b70fb9ce8c2ba0feeebcf8de22c313d',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/parameters.ts',
            hash: '8f3b0010dde1d1bd2d8c6854afcb906e0ed51134',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/pathToid.test.ts',
            hash: '222c9923520d7aa00a4c55e39a8e9c9943b78cf5',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/pathToId.ts',
            hash: 'fe534f5dfddf744d5a37a936ee9368a481e43cac',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/queryparams.ts',
            hash: 'cd6685f2378b298be571cf4b7963fbdff01cbb88',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/simulate-pageload.ts',
            hash: '488e33289b5e9bfed32a18e8269013af72379c85',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/story_store.test.ts',
            hash: '2d2b87068fb8fdf5512294e9e6563f5af1dc8fc6',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/story_store.ts',
            hash: '1c85fcd2ae5608459076b6dfc9d92c5620697dcc',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/storySort.test.ts',
            hash: 'ff9a06468b28cbcf91ae7d9bd5499a17f55fc75a',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/storySort.ts',
            hash: '73253c28ef6c31dd1a689a445c48d62d609e979c',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/types.ts',
            hash: 'cdd76b1180823b95e9b76170b5251c3502b08302',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'lib/client-api/tsconfig.json',
            hash: '6b79f028c19c17df4899c92e7df641019f3169c2',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/components': {
      name: '@storybook/components',
      type: 'lib',
      data: {
        root: 'lib/components',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/components/html.d.ts',
            hash: '772b510cd608b197f49e858e43914280e429d09f',
            ext: '.ts',
          },
          {
            file: 'lib/components/html.js',
            hash: '7a58bc516e1f7eec5d8014b8efe698c3e99509e9',
            ext: '.js',
          },
          {
            file: 'lib/components/package.json',
            hash: '1bd563c1612e5996a1f124a9c437dfc6cda16bb3',
            ext: '.json',
          },
          {
            file: 'lib/components/README.md',
            hash: 'd3e000fc990ab7c2c376a2c9d08f9c5765a03412',
            ext: '.md',
          },
          {
            file: 'lib/components/scripts/writeCssScript.js',
            hash: '94a718c936fc50401f592ba20b082d0958c8840a',
            ext: '.js',
          },
          {
            file: 'lib/components/src/ActionBar/ActionBar.stories.tsx',
            hash: '4e2d94751718b7e3ec49d4d8c34e69662fba2712',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/ActionBar/ActionBar.tsx',
            hash: '93ac23669cac1492302ba428e0421843a221c0b4',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/addon-panel/addon-panel.tsx',
            hash: 'a6423112b625630eec5df44aa4c80bab9fae729c',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Badge/Badge.stories.tsx',
            hash: 'be120120e6f00519cb8e89946e8cb891e0642774',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Badge/Badge.tsx',
            hash: '186d9caa8d71106cd434328459f8c2683da37254',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/bar/bar.tsx',
            hash: '95f4b3cb18e2dcd274eeb8e20f3879b95905ea0f',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/bar/button.tsx',
            hash: 'a4368349637a425cc77759da6bd27cb74ff33247',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/bar/separator.tsx',
            hash: 'c34a1d6fb2108d16fda07b729343af669992d99b',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/ArgControl.tsx',
            hash: '9140f96eaaf64cd9c6e2f262f025bee9ea9a232d',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/ArgJsDoc.tsx',
            hash: '126181d71a4bfe5f8432f4f7f3389533ec02931e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/ArgRow.stories.tsx',
            hash: 'd6ffb2b42d3dd42f2b00bdd4d0b0c77ec1b5274d',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/ArgRow.tsx',
            hash: 'fdf95425cfdf2397b27bd2d22086b5bfebd923fa',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/ArgsTable.stories.tsx',
            hash: '46f9e2ca644aef369bda39367f39202aa0b40cd7',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/ArgsTable.tsx',
            hash: 'f9e85eee1b715df3eb71b4fe00ac3a6947998407',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/ArgValue.tsx',
            hash: '5ef0d29231378d44a9a75912a0afb73aa587f5eb',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/index.ts',
            hash: '0a001b28030ef378b003cd5a153c8ee70ed6af9b',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/NoControlsWarning.tsx',
            hash: '113c6000425da699365d31dd592a961f66fe19c1',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/SectionRow.stories.tsx',
            hash: 'dfed50eb8ba156f1d94165981d349d024c67bcb7',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/SectionRow.tsx',
            hash: '3155dfc84957e932bdf6ee1e42d252ad52a0a99f',
            ext: '.tsx',
          },
          {
            file:
              'lib/components/src/blocks/ArgsTable/TabbedArgsTable.stories.tsx',
            hash: 'a64c3299424e18850a7753ec3c745828efd8a503',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/TabbedArgsTable.tsx',
            hash: 'e49baf7deb2f0ebcfd170947cec7ac1b18256d2e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ArgsTable/types.ts',
            hash: '4b8a3fa4941cf649ac1cafa0e7826746c436a6fa',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/blocks/BlockBackgroundStyles.tsx',
            hash: 'a037b5df830e6ad98f109dc215936e15f6c26251',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ColorPalette.stories.tsx',
            hash: '2f3830b98a0774dd50366aca65f71583a2683ed4',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ColorPalette.tsx',
            hash: '800469aa1d5ce5df28d60db2a46f6462ad5ee207',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Description.stories.tsx',
            hash: '14bbfaacb87260999e0138fcb41b4032762504a1',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Description.tsx',
            hash: 'd5b57f2b6d7dacb802cf6e7a4119a6847b0df9d9',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/DocsPage.stories.tsx',
            hash: 'dabf27dbd7604218fd9b632baa71d11f15b93b4d',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/DocsPage.tsx',
            hash: '2ef0df2384601051ec8f872e4e2dc8de939f3cac',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/DocsPageExampleCaption.md',
            hash: 'beb4dee3ca2531f66e7deeba9dd72633dd42f7e5',
            ext: '.md',
          },
          {
            file: 'lib/components/src/blocks/DocsPageExampleCaption.mdx',
            hash: 'beb4dee3ca2531f66e7deeba9dd72633dd42f7e5',
            ext: '.mdx',
          },
          {
            file: 'lib/components/src/blocks/EmptyBlock.stories.tsx',
            hash: '2f26f443053134b78bf4f99b526b8ab88b13a37c',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/EmptyBlock.tsx',
            hash: '06f7ba536e9b6838c90af3406c996a2dca4b77eb',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/IconGallery.stories.tsx',
            hash: 'fd6af632c91244ce199306194061f9d1cc4a25f9',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/IconGallery.tsx',
            hash: '01d4f11f5f509ebad1d9651ba3f6b5e8ebfd3062',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/IFrame.tsx',
            hash: '7329ee3c733c00e379825b738d39284400fe7497',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/index.ts',
            hash: '9866fbd5dbbbd2a048d24e9b512e0b0c6cc86eae',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/blocks/Preview.stories.tsx',
            hash: '5b3330f9bfff51eb4e2dd0dcca3406f38786f65e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Preview.tsx',
            hash: '29f2c20b69ce80e33644436813c4b5c4f4e15d44',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Source.stories.tsx',
            hash: '5af0dfe0710def4cefcdc5f3f2cef55d00c7cd01',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Source.tsx',
            hash: 'f1ffcc97270886d611a9d35e2527e3ebc0afc55d',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Story.stories.tsx',
            hash: '3d2bacc90ceccf76b6831d4bf150854896e80581',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Story.tsx',
            hash: '2a44d1b8d10b5e1f26ebe9fcda9f0f84c21162e7',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Toolbar.tsx',
            hash: 'b3e9909b24f7996cb33bc37607ba89e46d966b43',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Typeset.stories.tsx',
            hash: '9945b12555cd3fdf5eb275c3b2dd221cefb6d871',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/Typeset.tsx',
            hash: 'c4f3f26ab3df7ef7f6e757a64f2d67644be36e3a',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/blocks/ZoomContext.tsx',
            hash: 'eaf783bbae97c02aa6fb52034df6ad2cfcf063c8',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/brand/StorybookIcon.stories.tsx',
            hash: '702e6deede0869d99914127ca6816ad4085ced57',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/brand/StorybookIcon.tsx',
            hash: '1f35e0adce4f3c2d9efa290ef8d3d58d3e4228fa',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/brand/StorybookLogo.stories.tsx',
            hash: 'edbf5f1f2a57a5ed73d9285f09678dd9adc1828f',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/brand/StorybookLogo.tsx',
            hash: 'c8ff2bf7a5481f5480e60c9e7387f0b06c090e96',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Button/Button.stories.tsx',
            hash: 'da248be179cb6a861a96d4c5d3e54008d8593d6e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Button/Button.tsx',
            hash: '853d595dcb07f5a023511d5e008a0e1316231e03',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Colors/colorpalette.stories.mdx',
            hash: '89116dcf34a44062075301a1296ea0df1bb1db40',
            ext: '.mdx',
          },
          {
            file: 'lib/components/src/Colors/SideBySide.tsx',
            hash: 'e2e95e7b80dc76e6a9f57fece98045ab3e06804f',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Array.stories.tsx',
            hash: '5b75557911e5748818b850ec7b572b5896d7454a',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Array.tsx',
            hash: '4694528f5d1bb56ba77ad557b8f395b5c089c0b8',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Boolean.stories.tsx',
            hash: 'b604fec68bf0ae28c819c75520cd6d0455eec82e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Boolean.tsx',
            hash: '39be3869f45374e3df43f23a789d248b65e50705',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Color.stories.tsx',
            hash: '435dedac8565615c8b668454fccb3d2736c3cae0',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Color.tsx',
            hash: '7eec9cdfa96f5c40d2fc90a6a5459d6ee9ebc07f',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Date.stories.tsx',
            hash: '761c9a54c42faab51876d07652d842fd9db696dd',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Date.tsx',
            hash: '414f57ec3622259991b048ea3dcc4fc5f4304d74',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Files.tsx',
            hash: '0623dce48eaffc53493235e65dd8ec067a433c3a',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/index.tsx',
            hash: '5dbccdc201bc1845615bec98736ecac0f1c90d65',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Number.stories.tsx',
            hash: 'de6b0459e904ba5533c2c18bc7ccac2daff67a76',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Number.tsx',
            hash: 'f27b5efb4b30637110194a54fc774f15d513195a',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Object.stories.tsx',
            hash: '3bf1a784ec63bea71a98aed651360786d933de4e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Object.tsx',
            hash: '5d3b4e98e22f2ce556fe478fc6034351f1a9450d',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/options/Checkbox.tsx',
            hash: '5695e1b9a257a3e5897d293b3224759aaeb23608',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/options/helpers.ts',
            hash: '6bb25b3954e59d7577eda2af348ef7aef2dbc763',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/controls/options/index.ts',
            hash: '6e8a17140bbf9cf7fba5395f6e4dcca2335c593d',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/controls/options/Options.stories.tsx',
            hash: '9a20666202309e660c85c2bfe322bb515b1d34fa',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/options/Options.tsx',
            hash: '9b88795c88141da8edcba397aa377514be84f8cc',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/options/Radio.tsx',
            hash: '0078c6c43d4989d5fe3724b8b3d392f50c1b60c6',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/options/Select.tsx',
            hash: '9b066f0b9e10588f395d44d17955ec81d9a1e070',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Range.stories.tsx',
            hash: 'e06531f2fab6482000b49e28b1931e23605086cd',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Range.tsx',
            hash: '09d00a378e52f1af8823fd1b31e2dbb672084974',
            ext: '.tsx',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/components/JsonAddValue.js',
            hash: '55971aafb60fb8364f2b675d6a74131e2ffdd37a',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/components/JsonArray.js',
            hash: '61bf8240aa2f5c14933d7c3cf1e0d708810d6e34',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/components/JsonFunctionValue.js',
            hash: 'ae205834ee736e36324b677743835eee8815878c',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/components/JsonNode.js',
            hash: 'ca46745edc6ce3757d97f8090b0215922b8b8c20',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/components/JsonObject.js',
            hash: '7e3c298e97d81b56193da79dbaefb78d36692fc7',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/components/JsonValue.js',
            hash: 'f2bf4dcd056fd49af9a9fa7739d804194f0291d6',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/index.js',
            hash: 'cc55b51b9ba1802617e5f6fa89d46f4e6374ccac',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/LICENSE.md',
            hash: '387660f7f03bebb587f8cf41657a3ab728b7b2bf',
            ext: '.md',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/types/dataTypes.js',
            hash: 'dc68e5aa25c6c06ad534a0ee971650b9e59b2d3f',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/types/deltaTypes.js',
            hash: '5926294bc87ae72cc76327edf58500623c4a931f',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/types/inputUsageTypes.js',
            hash: 'db9afca8982cfb8d5e9521849b51972dbc95bbf6',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/utils/objectTypes.js',
            hash: '098f32e3b59e062df445bfb5ead90634de96995c',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/utils/parse.js',
            hash: '75238d695707d43e41ae7025d197e66530635faa',
            ext: '.js',
          },
          {
            file:
              'lib/components/src/controls/react-editable-json-tree/utils/styles.js',
            hash: 'b446bda82ab362ec132d088bd0abc64f787f66a5',
            ext: '.js',
          },
          {
            file: 'lib/components/src/controls/Text.stories.tsx',
            hash: 'da2bb52a72a50435dd5d25af9861ef17aa4d9c16',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/Text.tsx',
            hash: 'edf6e53c0b2b6273182ceaf7a31a83ff17903171',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/controls/types.ts',
            hash: '952458266fa168e3acdef9b8b272a7b32e88d7b0',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/form/field/field.tsx',
            hash: '10cf3507a93a87f9075f8b3d45eb6d305a2c06ae',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/form/form.stories.tsx',
            hash: '38124f1c9bcaf94077f2dd999db113fddf31b5e8',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/form/index.tsx',
            hash: 'e2829db35229f99ff3c2c789579391f504651f35',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/form/input/input.tsx',
            hash: 'a277dd7546c36089172478367e992d57e116a47c',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/html.tsx',
            hash: '47480e067a467b1a9fad686ca6d0f82f863c1e0f',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/icon/icon.stories.tsx',
            hash: '92892d5e9a1d3f5d2bc4ef470f472a9c66a311a7',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/icon/icon.tsx',
            hash: 'd9c27ab7f4a29329d7b301fcfeff8bcb5a45577f',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/icon/icons.tsx',
            hash: '7f47e74aeb99a88ca846c5e8c12619940255b793',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/icon/svg.tsx',
            hash: '3e2eb66254c5752cdc4e16999ef8e3ed1b7f55dc',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/index.ts',
            hash: 'f70c4bc0b622c0dacd8fbd283a3ad6d7492b6c66',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/Loader/Loader.stories.tsx',
            hash: 'a3f8db8a1cac98237e571b61e63ddf664a7aa3b7',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Loader/Loader.tsx',
            hash: 'dee0cf076ac9c9ef7136ecb4eef3d93267c0d688',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/placeholder/placeholder.stories.tsx',
            hash: '88e937254e9d685c3ae84e287096d6010354f5df',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/placeholder/placeholder.tsx',
            hash: '31e48adebb2b93503d942b70fd7d36030a57efbf',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/ScrollArea/GlobalScrollAreaStyles.tsx',
            hash: 'b53b756ed671bb9a8697f6004c6b982ce795e3de',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/ScrollArea/OverlayScrollbars.tsx',
            hash: 'fa4734e07c71a9d1fd28837c5ef98122593b871a',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/ScrollArea/ScrollArea.stories.tsx',
            hash: 'c27fac7a234c0dc0c5118f0dbba9197eba5c7369',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/ScrollArea/ScrollArea.tsx',
            hash: '1ae013a385acd535a79de898bcedfe058d51a52d',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/shared/animation.ts',
            hash: '5f178d5653bd18c850f642eb00bc9ba3dc196baf',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/spaced/Spaced.stories.tsx',
            hash: '6f3ef7b8065c876b45b403d64e5308ba361d05b3',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/spaced/Spaced.tsx',
            hash: '8ce2e6274b610b50b988c7fb0069ce6ac2f8eb22',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/syntaxhighlighter/formatter.test.js',
            hash: '9c5543fef74ff1f10b801272bbdadb3ec85a6e7e',
            ext: '.js',
          },
          {
            file: 'lib/components/src/syntaxhighlighter/formatter.ts',
            hash: 'dceeae48d0ad2e5a8d9691d5826b75ca51abe17c',
            ext: '.ts',
          },
          {
            file:
              'lib/components/src/syntaxhighlighter/lazy-syntaxhighlighter.tsx',
            hash: '60d9632e582a5e672bab96fe788d0db3585046f1',
            ext: '.tsx',
          },
          {
            file:
              'lib/components/src/syntaxhighlighter/syntaxhighlighter-types.ts',
            hash: 'e1c5cb61ec68a0cdf5183618635ffcb844c3f974',
            ext: '.ts',
          },
          {
            file:
              'lib/components/src/syntaxhighlighter/syntaxhighlighter.stories.tsx',
            hash: '7ebf87a91eb27fac320ebd814611e0e7ca1861c8',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/syntaxhighlighter/syntaxhighlighter.tsx',
            hash: '619f2369b31235dfab42601c9867819799bc3b51',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tabs/tabs.stories.tsx',
            hash: '18924fa6651595151dcab8aae073eeaf301a3aba',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tabs/tabs.tsx',
            hash: 'c238cc8279f1e216c01e415f3b4cbcf3615b431c',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/lazy-WithTooltip.tsx',
            hash: '70e6a0891dd574b1b7909e4adc88faa4d9bafd42',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/ListItem.stories.tsx',
            hash: '3809e91016739db9139e9dc8b2d141319cd5703d',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/ListItem.tsx',
            hash: '94ad70b0a281b084c2f939f74eb1b5aa065b2aa7',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/Tooltip.stories.tsx',
            hash: '65c728ff9d5c8ba09e4467203085406a6d04c7d0',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/Tooltip.tsx',
            hash: '1d258b4d4e47c68ecaad1f8553a2e8d694c78c91',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/TooltipLinkList.stories.tsx',
            hash: '3afc5dd843798481b9ae059669ca03cde4c20e8e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/TooltipLinkList.tsx',
            hash: '2096e42a4bc2cc7295d2b2b7fb65ac96c58cc208',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/TooltipMessage.stories.tsx',
            hash: '1e626b9276638f52bfb478865cbc9f8e3dc7dc2c',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/TooltipMessage.tsx',
            hash: '3e6242b37a23d4d95f9f41f44d63475143c27e2a',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/TooltipNote.stories.tsx',
            hash: '2db9aa3e54ddb6a330df2874ce22d9644625c58e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/TooltipNote.tsx',
            hash: 'bc47278f9b431f59b97b2257ce63aea76772c995',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/WithTooltip.stories.tsx',
            hash: '9f12962f9edede24851825871213f9e45a22142e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/tooltip/WithTooltip.tsx',
            hash: 'a3d7bc8a73f29df0024a3aeea5bd4be467e78882',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/typings.d.ts',
            hash: '8e5fa7a2a1476198a0ad322d2f9d985887f8cf6c',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/typography/DocumentFormatting.tsx',
            hash: '59d5a0fa9da54ab6bc5e32bdb00c2cc041aa55a2',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/typography/DocumentFormattingSample.md',
            hash: 'f7706cff5181fbedb1257e0091e0140922cc1f01',
            ext: '.md',
          },
          {
            file: 'lib/components/src/typography/DocumentWrapper.stories.tsx',
            hash: '18e7b74c463b1c6d183fc786642ad0761e5478f8',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/typography/DocumentWrapper.tsx',
            hash: '9e3eb26ad4f66eba75e86e77215c18b1f84d268b',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/typography/link/link.stories.tsx',
            hash: '10342dae39d0c052364ec158e85e80e82ba0847a',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/typography/link/link.test.tsx',
            hash: '45d4d686bf3dc59eafa63792bbb14e68a92a075e',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/typography/link/link.tsx',
            hash: '1b08faeb1ab2bb1d23a76be1457070cb5e2484b0',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/typography/shared.tsx',
            hash: '4ff39c0bf9490c23f537c95c63ff8c646874f0f8',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/typography/typography.stories.tsx',
            hash: '6429be56dbaf59800660051d0029fa03b0836541',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Zoom/browserSupportsCssZoom.ts',
            hash: 'af6519ee599861a2c15f9d6ac5a62d9764ab02ed',
            ext: '.ts',
          },
          {
            file: 'lib/components/src/Zoom/Zoom.stories.tsx',
            hash: 'd6a34819af65bceb398adec56532f8175fbb6aaf',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Zoom/Zoom.tsx',
            hash: 'fd52d843ba4262adc53c6a65cc5925a0c1b1f095',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Zoom/ZoomElement.tsx',
            hash: 'da356a04b9b135229c18e07448695605a5a5c751',
            ext: '.tsx',
          },
          {
            file: 'lib/components/src/Zoom/ZoomIFrame.tsx',
            hash: '1872cfd024c2d4010816aac71260baa205b11133',
            ext: '.tsx',
          },
          {
            file: 'lib/components/tsconfig.json',
            hash: '5878184e06a11bb8bc520370dd251e7ec64fc325',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-events': {
      name: '@storybook/addon-events',
      type: 'lib',
      data: {
        root: 'addons/events',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/events/package.json',
            hash: 'b165ba51f6846bc7e3cf2dbf31e30d7da3bdf375',
            ext: '.json',
          },
          {
            file: 'addons/events/README.md',
            hash: '1b7278e109433cfb739827690981800ea9efe27a',
            ext: '.md',
          },
          {
            file: 'addons/events/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/events/src/components/Event.tsx',
            hash: 'e1001465471ddd2968182cefcf3bdd6a51c3d23f',
            ext: '.tsx',
          },
          {
            file: 'addons/events/src/components/Panel.tsx',
            hash: '29ddc47705a04da055a7ee7bdec67d08e1b7db75',
            ext: '.tsx',
          },
          {
            file: 'addons/events/src/constants.ts',
            hash: '3d765994293b61ab98a561310a21567b07e1cf8a',
            ext: '.ts',
          },
          {
            file: 'addons/events/src/index.ts',
            hash: '9eb0633e702530d6fc6fbae44b5d1ba14a719a7e',
            ext: '.ts',
          },
          {
            file: 'addons/events/src/register.tsx',
            hash: '10acd52d69b388e4215da4be4fdb0012e74d3ac5',
            ext: '.tsx',
          },
          {
            file: 'addons/events/src/typings.d.ts',
            hash: 'd6932d989ba0703bc8110120f13f1e41905552c3',
            ext: '.ts',
          },
          {
            file: 'addons/events/tsconfig.json',
            hash: 'd1ee4fc75941ea63fc45ba234dca37d9882e1620',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-knobs': {
      name: '@storybook/addon-knobs',
      type: 'lib',
      data: {
        root: 'addons/knobs',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/knobs/docs/demo.gif',
            hash: '12206cb0653da9f3c1f7d7ce43272a3ad358da10',
            ext: '.gif',
          },
          {
            file: 'addons/knobs/docs/demo.png',
            hash: 'eb7453bd27a1cf2408957fbbff66f6646c942b38',
            ext: '.png',
          },
          {
            file: 'addons/knobs/docs/storybook-knobs-example.png',
            hash: '3175939f84180ae4754be71ed5f2211c01ac813a',
            ext: '.png',
          },
          {
            file: 'addons/knobs/package.json',
            hash: 'ba90f4247a7677cdc1b098a66e77b186eaabad15',
            ext: '.json',
          },
          {
            file: 'addons/knobs/preset.js',
            hash: '9ff1bf59baafc81e122cc2d8935390bbb254ce68',
            ext: '.js',
          },
          {
            file: 'addons/knobs/README.md',
            hash: 'ee3daace483acb9683b0109e97ef93a90f632edf',
            ext: '.md',
          },
          {
            file: 'addons/knobs/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/knobs/src/__types__/knob-test-cases.ts',
            hash: '1857fcb7ce18b514da8d106e6caf21cbf0d2d98a',
            ext: '.ts',
          },
          {
            file:
              'addons/knobs/src/components/__tests__/__snapshots__/Panel.js.snap',
            hash: 'df5db4b0130b95a0a378deffa0dc08f2099adaff',
            ext: '.snap',
          },
          {
            file: 'addons/knobs/src/components/__tests__/Options.js',
            hash: 'ac85c846c50cd28090ce6933c05763763016915d',
            ext: '.js',
          },
          {
            file: 'addons/knobs/src/components/__tests__/Panel.js',
            hash: '65f1cb163b69a415a8570c00aff1e949df4c4598',
            ext: '.js',
          },
          {
            file: 'addons/knobs/src/components/__tests__/RadioButtons.js',
            hash: '5f950cb7af81288d7baa6681597c726006ac1427',
            ext: '.js',
          },
          {
            file: 'addons/knobs/src/components/__tests__/Select.js',
            hash: '6500ce41a4f117300b0cde93cb6baf85addcd361',
            ext: '.js',
          },
          {
            file: 'addons/knobs/src/components/Panel.tsx',
            hash: 'bcb9bd3baf4213af4c7a5340d7f16de68e183031',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/PropForm.tsx',
            hash: 'de3fce7765319f7b8752e7cec26bc220a29ace9d',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Array.test.tsx',
            hash: '15c83bee81ad5f579c1d58e104ab93b2d1e2bd66',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Array.tsx',
            hash: '52aace3b71ad495f77c34dae062b42a5cc1049f0',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Boolean.tsx',
            hash: '452dbd74f15168f9a50783c5563f464755f57eda',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Button.tsx',
            hash: 'f16dca8064cb525c280bd4279f08811273200320',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Checkboxes.tsx',
            hash: '56fc40e993e048cdceb4a554c3b74f749a0d2868',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Color.tsx',
            hash: 'a7869c95bba53733a42a3a4bf13fd0ec38a4e3c3',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Date.tsx',
            hash: '87380df96fff6f95ac7052c705d11826882ca552',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Files.tsx',
            hash: 'a19738e267ac4a76996e0486198cba9015beac6d',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/index.ts',
            hash: 'c5543e7ef99827f049867c9615de15491c0e8f46',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/components/types/Number.tsx',
            hash: '53389c226dfa411fdbd1e172ef240ace37c964e4',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Object.tsx',
            hash: '8ff178d25dc29bdee7b5d21ea9eaefcb8fd0c8b9',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Options.tsx',
            hash: 'a13be29e0c2d686a7b558b7ef43511fd9dce7a9a',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Radio.tsx',
            hash: '68bff78d68c11576fe44f1f1806ec14088b0cbdf',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Select.tsx',
            hash: '0dd8e146c9899c22dd22f41b97ce909fb0bde23d',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/Text.tsx',
            hash: '8f060e7d5cd0c096e5b78852523c83656a98e3fb',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/components/types/types.ts',
            hash: '91e1f36e27ed1f1ca85f3284221c2c5ab78134f1',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/converters.ts',
            hash: 'e84b159b50cb43d38051936e84adf63b3c7e4c2b',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/index.ts',
            hash: '1e940fcb8117eb37d6e68bdb4e44b75f9a71d988',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/KnobManager.test.ts',
            hash: 'cd63accafe35a969de502645b13636b48d884258',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/KnobManager.ts',
            hash: 'db2f872572b0d12ac34ec2df726d977983a0629b',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/KnobStore.ts',
            hash: 'cc3699e3f1f2f1feaed4c9dc034724c37067f0b9',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/preset/addDecorator.ts',
            hash: '364246df26100287fe50a5d5df616172e2b54e12',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/register.tsx',
            hash: '194f53579814909c8ca7724ddad3ee3e762bd56f',
            ext: '.tsx',
          },
          {
            file: 'addons/knobs/src/registerKnobs.ts',
            hash: '40980934e736c9d4e1db1922869049c034693688',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/shared.ts',
            hash: '267862d05d107d874d48fe9e4fdcc9a5dfeee0e8',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/title.ts',
            hash: '2f86a9f15b86396dc870ce4a0cc7b197da203992',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/type-defs.ts',
            hash: '1a60879a0bb89c18dff6aad7cfe5147b5e6532b0',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'addons/knobs/tsconfig.json',
            hash: '6244e504c8feed0b4a5d7af9ff270543e576b1f2',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-links': {
      name: '@storybook/addon-links',
      type: 'lib',
      data: {
        root: 'addons/links',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/links/package.json',
            hash: '5a3cf9eee812c91e08e14f2c108efc73b02b63e3',
            ext: '.json',
          },
          {
            file: 'addons/links/preset.js',
            hash: '2b5ed5ac00d6039cb5e5dd575748885c6463bb3b',
            ext: '.js',
          },
          {
            file: 'addons/links/react.d.ts',
            hash: '1e0e42d007c9aac5bc722bf0a9a1d2a6f0a70a05',
            ext: '.ts',
          },
          {
            file: 'addons/links/react.js',
            hash: '835dd0388e2944eef6aa2b5b164f6e7b87da58ef',
            ext: '.js',
          },
          {
            file: 'addons/links/README.md',
            hash: '6ca46168c971b68062621662a746822b48ba9244',
            ext: '.md',
          },
          {
            file: 'addons/links/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/links/src/constants.ts',
            hash: '7fb1ad05b5d3ff63fbfa7c0e59783673c1341c96',
            ext: '.ts',
          },
          {
            file: 'addons/links/src/index.ts',
            hash: '239fae7ba1a8c5b03d40fd1e5040cf8ead26daea',
            ext: '.ts',
          },
          {
            file: 'addons/links/src/preset/addDecorator.ts',
            hash: 'ff68743b1a37c0ab333960c6fd0994971e4294f7',
            ext: '.ts',
          },
          {
            file: 'addons/links/src/preview.test.ts',
            hash: 'c768c224c020282b7f8595e8c82ce02430e4b3a7',
            ext: '.ts',
          },
          {
            file: 'addons/links/src/preview.ts',
            hash: '07e319cf7d9318067f9ef929ad9130c36ca8a02e',
            ext: '.ts',
          },
          {
            file: 'addons/links/src/react/components/link.test.tsx',
            hash: '40669bc6fd32aefa3631f272c61edf6d8ab6a002',
            ext: '.tsx',
          },
          {
            file: 'addons/links/src/react/components/link.tsx',
            hash: 'fccca70d04a5b93c29e8d1b9426942524d6821cf',
            ext: '.tsx',
          },
          {
            file: 'addons/links/src/react/components/RoutedLink.tsx',
            hash: '2c5ede5f1d335e3f5aefd6bdd119b9e9f585434c',
            ext: '.tsx',
          },
          {
            file: 'addons/links/src/react/index.ts',
            hash: '46c4034f33ad98f051d344a7fecea085472ae3ef',
            ext: '.ts',
          },
          {
            file: 'addons/links/src/register.ts',
            hash: '5c082e8a04fb42b2061b069235a95eac9b4dafa4',
            ext: '.ts',
          },
          {
            file: 'addons/links/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'addons/links/tsconfig.json',
            hash: '152b58ee30e17d13f0b93b33e87b290f7eedcc19',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/channels': {
      name: '@storybook/channels',
      type: 'lib',
      data: {
        root: 'lib/channels',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/channels/package.json',
            hash: 'c1ff2e7d8b9cf00a489394f03acd7141952e3fa8',
            ext: '.json',
          },
          {
            file: 'lib/channels/README.md',
            hash: '5bce6d0af6e691ce6b8c6e030bf46eb10d758435',
            ext: '.md',
          },
          {
            file: 'lib/channels/src/index.test.ts',
            hash: '0583fb3d5e29f15093642fb134ce0c4b052c423d',
            ext: '.ts',
          },
          {
            file: 'lib/channels/src/index.ts',
            hash: 'dde99806d09e6a2d41897fcad8ff728567a73930',
            ext: '.ts',
          },
          {
            file: 'lib/channels/tsconfig.json',
            hash: 'ed2d7ce12b43f312d4088ac27af392d9cf48c886',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-a11y': {
      name: '@storybook/addon-a11y',
      type: 'lib',
      data: {
        root: 'addons/a11y',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/a11y/docs/screenshot.png',
            hash: '44fbf53fdeb0dcefd6c8edc89e7bbe03cf2963b2',
            ext: '.png',
          },
          {
            file: 'addons/a11y/package.json',
            hash: '0d7d4c3b69f260c0efda6dbef08cd6e48ded6960',
            ext: '.json',
          },
          {
            file: 'addons/a11y/preset.js',
            hash: 'fc6884de55c61a63e16d4f4d2853344ef48db50b',
            ext: '.js',
          },
          {
            file: 'addons/a11y/README.md',
            hash: '018721ace706aeb730b736cce982931587ab212a',
            ext: '.md',
          },
          {
            file: 'addons/a11y/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/a11y/src/a11yHighlight.ts',
            hash: '868f94d2d01506fe75d5f1420ece252039953be1',
            ext: '.ts',
          },
          {
            file: 'addons/a11y/src/a11yRunner.test.ts',
            hash: '2efb58b2f2450b85f973faf684f30aafe185cc74',
            ext: '.ts',
          },
          {
            file: 'addons/a11y/src/a11yRunner.ts',
            hash: 'addd6c4760c67590d526deffa95c3f2844239aed',
            ext: '.ts',
          },
          {
            file: 'addons/a11y/src/addDecorator.ts',
            hash: '95dc140b157af34f3d3738093ccb2691d78c820e',
            ext: '.ts',
          },
          {
            file: 'addons/a11y/src/components/A11yContext.test.tsx',
            hash: '5d4e7003f14978dbb823f7ef07c15b15bb8d8f6e',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/A11yContext.tsx',
            hash: '5061f5623d47a8aabf463b0f25dbeca9157ca221',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/A11YPanel.test.tsx',
            hash: 'b7e77b1e51a3784996a929f0d8e110c3234ae492',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/A11YPanel.tsx',
            hash: 'a00d6178440a63ce63e07536b142bd09ef4e7390',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/ColorFilters.tsx',
            hash: '04c34088b7fdaa50daf6fa19b0bbf5ae21c088bd',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/Report/Elements.tsx',
            hash: '50e0d0779caf403c1bbd79f986c856bff124436f',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/Report/HighlightToggle.test.tsx',
            hash: 'cbfc33297db8ef1b88411a93a117fd977a2cea0c',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/Report/HighlightToggle.tsx',
            hash: '7697e0bce891001a2e51751931fd8376d48eb29f',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/Report/index.tsx',
            hash: '849c9f7a4f8482270f7b48cb747f157b2045f1f6',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/Report/Info.tsx',
            hash: '743a617c02f470f3f2b523886ed2bf503387bc8d',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/Report/Item.tsx',
            hash: 'c33058b4b4454dd844079172f871919c0bae47fc',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/Report/Rules.tsx',
            hash: '5523f07dc830df3dfcbcaa5ce0b722a4ba1ed26f',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/Report/Tags.tsx',
            hash: '1c26cd302f40af1e9abcec78223da7bc07a48be5',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/Tabs.tsx',
            hash: 'e8eb74df048f01b89a6c4cf8d7e0a023a177080b',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/components/VisionDeficiency.tsx',
            hash: 'a4680a6fb4baa37d39b77b123973b2d478ad4793',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/constants.ts',
            hash: '3c96945b4dfebc2faad2fd632a12b2c68e0b65b5',
            ext: '.ts',
          },
          {
            file: 'addons/a11y/src/highlight.ts',
            hash: '2a2b63a215f808867a2ae738400c44f31310161a',
            ext: '.ts',
          },
          {
            file: 'addons/a11y/src/index.ts',
            hash: '4728111bfae3574bb3a1a03ee88258bd5140a08a',
            ext: '.ts',
          },
          {
            file: 'addons/a11y/src/params.ts',
            hash: 'fb439ae3f342823be7f7431de030468ba9028ccf',
            ext: '.ts',
          },
          {
            file: 'addons/a11y/src/register.tsx',
            hash: 'efa7f4e397e26d2cf6a1cf1dc6fa10fa04083c70',
            ext: '.tsx',
          },
          {
            file: 'addons/a11y/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'addons/a11y/tsconfig.json',
            hash: '8319c147bd1f7c96d5bbf9aa181ab67848708737',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addon-docs': {
      name: '@storybook/addon-docs',
      type: 'lib',
      data: {
        root: 'addons/docs',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/docs/angular/index.js',
            hash: 'aab19f758f291d49c92df77edbd3c581f5efeb8c',
            ext: '.js',
          },
          {
            file: 'addons/docs/angular/README.md',
            hash: '1485fb4a48b6cae8b5aff938d9bddad28ca9b839',
            ext: '.md',
          },
          {
            file: 'addons/docs/blocks.d.ts',
            hash: '7f733a1c1a4966c6f3c0deeff4fb6e73d8f3cadc',
            ext: '.ts',
          },
          {
            file: 'addons/docs/blocks.js',
            hash: 'a694d527ac2d6716ed83061b466d10278b6e2627',
            ext: '.js',
          },
          {
            file: 'addons/docs/common-preset.js',
            hash: '462287ef422595b90bc60514c0f363f3460e62f0',
            ext: '.js',
          },
          {
            file: 'addons/docs/common/README.md',
            hash: '45f400ea2a46b000a84105a2aba0eafcce223874',
            ext: '.md',
          },
          {
            file: 'addons/docs/docs/docspage.md',
            hash: 'a2eca972f0a76d3b88e01767e5dfd8390774490a',
            ext: '.md',
          },
          {
            file: 'addons/docs/docs/faq.md',
            hash: '8030502baf126e6e52260b1d867e5d905f44e943',
            ext: '.md',
          },
          {
            file: 'addons/docs/docs/mdx.md',
            hash: '91813d6dd5315d05b9eec3b3eb258549c2513673',
            ext: '.md',
          },
          {
            file: 'addons/docs/docs/media/angular-hero.png',
            hash: '6035bdb1546fe7b4225a131c13a97aa2cc9fbe39',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/args-controls.gif',
            hash: 'c60fa68c745fba8be67eb0f6cf955f03e20d98c5',
            ext: '.gif',
          },
          {
            file: 'addons/docs/docs/media/docs-tab.png',
            hash: 'ec49eee6d6b57e620efe07de62d4749715f639a9',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/docspage-hero.png',
            hash: 'fea1cca83361c5429cd1b2153fd6c2e616c047e2',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/docspage-slots.png',
            hash: '24cb5b4a091ae164961b9c0ad4238547bb9e3a22',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/docspage-subcomponents.png',
            hash: '86d001556ffa3f022a11d710cbb1a4df2db21fac',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/faq-debug.png',
            hash: 'fd6d1e55ff416a00305e21d006ac1397ddb994b9',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/faq-devtools.png',
            hash: 'aca275b28afdddbb5ff091137922c9342ede9411',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/hero.png',
            hash: '3bcaed4a669884e9ebc42b35424521a8a168bb29',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/mdx-documentation-only.png',
            hash: '0ed39ccb9a8b7cbf4d3bde117cad2ad789f3f598',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/mdx-hero.png',
            hash: '29495a94c1314738dd11f59785bcf10600bcbb13',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/mdx-page.png',
            hash: '195b39eefda81aa12a6f3ece4878a679521b1323',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/mdx-simple.png',
            hash: '2dfaf66b4ed36e6ce00a464d589bc27ecd0769e2',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/props-tables-hero.png',
            hash: 'e1ac1decb36dd6d679f8bfc874c09f2305bd2e6f',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/media/vue-hero.png',
            hash: 'febcab377d8e9366237f791c78d5ddbf4cdd5e64',
            ext: '.png',
          },
          {
            file: 'addons/docs/docs/multiframework.md',
            hash: 'fdfb6555371dd83a4efca268c620d268a2979785',
            ext: '.md',
          },
          {
            file: 'addons/docs/docs/props-tables.md',
            hash: 'ded29254bfce0ab885ffb6cbb18f13b9037e0470',
            ext: '.md',
          },
          {
            file: 'addons/docs/docs/recipes.md',
            hash: '7fd560e95114f715f545f14978cd5ea7f5be51aa',
            ext: '.md',
          },
          {
            file: 'addons/docs/docs/theming.md',
            hash: '58424e6472803ee43fa35e80b50cf2453b8bf6a1',
            ext: '.md',
          },
          {
            file: 'addons/docs/ember/index.js',
            hash: 'edcab7e3604bfff65f67ecb5fef4d0d1b78a166f',
            ext: '.js',
          },
          {
            file: 'addons/docs/ember/README.md',
            hash: 'dce27987fe88c9da18048bfab4aaf0f0e1e93ef2',
            ext: '.md',
          },
          {
            file: 'addons/docs/jest-transform-mdx.js',
            hash: '9f62e0dcc56262362f4cfc01a4952e31428fa459',
            ext: '.js',
          },
          {
            file: 'addons/docs/mdx-compiler-plugin.js',
            hash: 'baca1eb14eaadd71632d137a779bdf78dcd26d73',
            ext: '.js',
          },
          {
            file: 'addons/docs/package.json',
            hash: '908c2e13d3cf3bfa3087c4e30600d50909c6cd5a',
            ext: '.json',
          },
          {
            file: 'addons/docs/postinstall/presets.js',
            hash: 'e503cacc83913a57442b2fa3e72073fe3a9d613c',
            ext: '.js',
          },
          {
            file: 'addons/docs/preset.js',
            hash: 'dfce06bdfda4c98251ae56464abb13d324b1f260',
            ext: '.js',
          },
          {
            file: 'addons/docs/react/README.md',
            hash: 'd8ef563331d4787c77c332e2c5ed632678cbf321',
            ext: '.md',
          },
          {
            file: 'addons/docs/README.md',
            hash: 'a293422d9f41ae9626e06cda07db341d725b9ae8',
            ext: '.md',
          },
          {
            file: 'addons/docs/register.js',
            hash: '257d32c01f8fbcac0f2e673cdf5385b4cd7d37a1',
            ext: '.js',
          },
          {
            file: 'addons/docs/src/blocks/Anchor.tsx',
            hash: '7ed1160cfd74c99ee5000503f401f50aa1ad2ae2',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/ArgsTable.tsx',
            hash: '99bcf4a048f51853145b53c2ef766b2cee38fe5e',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Canvas.tsx',
            hash: 'bff7e3b593b8272d4b89c149d3a3cd3ffd763362',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Description.tsx',
            hash: 'f8bf8e711db0190ddc23117da5007177be96033a',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/DocsContainer.tsx',
            hash: 'bba72e661a68c396f2310f059e651d31bf989e9c',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/DocsContext.ts',
            hash: '0556b6304e39192f2e4a1b05067c6e018556ac35',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/blocks/DocsPage.test.ts',
            hash: '34a120d6e90c062f7e8de431787edef536a693fc',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/blocks/DocsPage.tsx',
            hash: '291c7868ae6a58a2811fd12335c675ce13e9b496',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/DocsStory.tsx',
            hash: '68b3cd6a770feedb530c6f9a3344077c441d8af2',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/enhanceSource.test.ts',
            hash: '006463374fd051595e1ad296ce2c1e65a3a74774',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/blocks/enhanceSource.ts',
            hash: '9092bac11b054cadbbc2cd825d78ab025065adb4',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/blocks/Heading.tsx',
            hash: 'c8cde5d6638305fc7d61a074cce7fcb4917efa75',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/index.ts',
            hash: '7096967b0db366525db684821e0163761c2ff74c',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/blocks/mdx.tsx',
            hash: '9c2e86537b1f02b941ccd28180ebdd924bae2397',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Meta.tsx',
            hash: '7aae59024615318347baf647bd1d1c9e203ef8f2',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Preview.tsx',
            hash: '94bb226fa0fd9e9d0a49b83add9e9afc2e25473e',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Primary.tsx',
            hash: '242e17794876d2a476ad67ca35eabd9c6791322b',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Props.tsx',
            hash: 'f251ed3575b3922e7eac40744b3dd57f183290e2',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Source.tsx',
            hash: '1126c78403990684599349f6ff4ac9e3569ea9a8',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/SourceContainer.tsx',
            hash: 'aa4971286ed9331f1cc01fea9ce2945ed9c975b5',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Stories.tsx',
            hash: 'afb7de3e8ad89e437efe3dc48c6f070116fa0a1e',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Story.tsx',
            hash: '6e239f072ca187f1693660bbf1d814c5e077324a',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Subheading.tsx',
            hash: 'e71b50c86d9126eb9ee17163845aec876dfff00d',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Subtitle.tsx',
            hash: '3fb44a8af5a6ea6a6ea87e5ac07c2944189bd8d3',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/Title.tsx',
            hash: '36f5590c9b98ff9d04028bf893c2cb465afb9d5f',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/blocks/types.ts',
            hash: '93eabc67b867662c482508a98b7eb4a00a5892d9',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/blocks/utils.ts',
            hash: '036925af27e5aded2c3e527458b09c0131212d11',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/blocks/Wrapper.tsx',
            hash: '3c4d80435c7a23a321f37715328bacc1e9b0cb5f',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/angular/__testfixtures__/doc-button/argtypes.snapshot',
            hash: 'b7dd2508926e560088ea06c3074f58940fe595d6',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/angular/__testfixtures__/doc-button/compodoc.snapshot',
            hash: '3a1d7700b665c2996d315a9be4a1819355d78544',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/angular/__testfixtures__/doc-button/input.ts',
            hash: 'f23c9025e421f160b3529801a61b745d4c4bd034',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/angular/__testfixtures__/doc-button/properties.snapshot',
            hash: 'efd774f746b28af192ee6086432bb29cd1fdb1de',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/angular/__testfixtures__/doc-button/tsconfig.json',
            hash: 'ced6b7ae2f7c6bfad8ff483af89ce5bc5889d515',
            ext: '.json',
          },
          {
            file:
              'addons/docs/src/frameworks/angular/angular-properties.test.ts',
            hash: '39a1eb7478afca94587fd57775da2457141f191b',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/angular/compodoc.test.ts',
            hash: 'd6385dc374fa3f16c39b052c2c254eee899d729f',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/angular/compodoc.ts',
            hash: 'd9b6fe9db106315efa2000526961660a6938b3be',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/angular/config.ts',
            hash: '25f9626ec4dc711a6190248e53e89a266b695eb5',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/angular/index.ts',
            hash: '6deda6f702d342c3f280a5a9fc14d19c8c875c45',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/angular/prepareForInline.ts',
            hash: '9da32baec8e5976e8f9cee3b5fcf4b0d1bd63113',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/angular/preset.ts',
            hash: '919a2f44775f4ed752005c669ba799d7718771aa',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/angular/sourceDecorator.ts',
            hash: 'c90556da20269a3449e46b2395531c8427c6975f',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/angular/types.ts',
            hash: 'db5bd6a1a64871be444c22d022b71b9616b0197a',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/common/config.ts',
            hash: '26b8364f920dbd6a121fd9bdfbe179962a05ad1e',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/common/enhanceArgTypes.test.ts',
            hash: '252dd5cfe01d13f36ac5ccd87b72b975f4a6a492',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/common/enhanceArgTypes.ts',
            hash: 'f1ee242400e0ee56618777a71489775995cab912',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/common/normalizeArgTypes.ts',
            hash: '8af93c8e41424c70bd442d24bf1a2f97d151e4bf',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/common/preset.ts',
            hash: '4a835c890faf5285e5098ab0e0e2dbba40affef4',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/ember/config.js',
            hash: '8c2ce673d38b8f2fc3e09af08154626a4a7ad34f',
            ext: '.js',
          },
          {
            file: 'addons/docs/src/frameworks/ember/index.js',
            hash: 'fab7166db9d744e960cb6fe3bd9a6b1f35bf698a',
            ext: '.js',
          },
          {
            file: 'addons/docs/src/frameworks/ember/jsondoc.js',
            hash: 'f9e648ebc21bc13ae4c973e502377791708f9dc5',
            ext: '.js',
          },
          {
            file: 'addons/docs/src/frameworks/html/config.tsx',
            hash: '5f07f0d905474a3c84e68be7b050c36e45980bae',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/10017-ts-union/docgen.snapshot',
            hash: 'e702b18e422045f35b8d8d6d6fe3bc82b4ccee1d',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/10017-ts-union/input.tsx',
            hash: '399f8b31a632b2ef86556309e04124c6f09df34c',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/10017-ts-union/properties.snapshot',
            hash: '430e864220909aea6e966e21b5cf6169c19735ff',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/10278-ts-multiple-components/docgen.snapshot',
            hash: '3947ed35573dce8aeebff842254fb6bdb0f453fe',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/10278-ts-multiple-components/input.tsx',
            hash: 'fea6eaea664a8b1160dd02406b8693a9b0f68ae5',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/10278-ts-multiple-components/properties.snapshot',
            hash: 'f9f94045bb53fd6e0216764a1611ae263c735b1d',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8140-js-prop-types-oneof/docgen.snapshot',
            hash: '0f5ed90d714b38938bb01a1361cccb7f2ec077f7',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8140-js-prop-types-oneof/input.js',
            hash: '1eb6b30cf299242c64e3e9c2104302108c34aadb',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8140-js-prop-types-oneof/properties.snapshot',
            hash: 'ff183b16151227121693f875a7c6bd5bdd1b296e',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8143-ts-imported-types/docgen.snapshot',
            hash: '99f9c02801e35576962b2cba3c3e0e0f03f5d0b0',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8143-ts-imported-types/input.tsx',
            hash: '7e30066389a2fbf23ea97cdc33ab26b2f96b7ce6',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8143-ts-imported-types/properties.snapshot',
            hash: 'e999d6a79f28564cec094ce413be44c6a480817c',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8143-ts-imported-types/types.ts',
            hash: '156212cf95ce4bcb03619ea9a4a7b25f661c9d37',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8143-ts-react-fc-generics/docgen.snapshot',
            hash: 'cd06005f3581fd5281ba05d7138d4fd977b5734a',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8143-ts-react-fc-generics/input.tsx',
            hash: '9116328f193799eb9da17a826926b8d3fe384768',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8143-ts-react-fc-generics/properties.snapshot',
            hash: '7e70b8104795124c36a17ff483a2a404ac0777c9',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8279-js-styled-docgen/docgen.snapshot',
            hash: '670ab38ca25b085824c72f67be3f64643f9a72e9',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8279-js-styled-docgen/input.js',
            hash: '95cf14f635c88b0ad2ddd12e13304f965e0b661f',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8279-js-styled-docgen/properties.snapshot',
            hash: 'b429f083fcc0f6c158aa13282083c3c2202de8db',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8428-js-static-prop-types/docgen.snapshot',
            hash: '10a2a46836d40dd3dbbe2a7aa3fdcd5c2218ef7c',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8428-js-static-prop-types/input.js',
            hash: '20094fa268dd9e72d77241bee5424a59edad6d83',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8428-js-static-prop-types/properties.snapshot',
            hash: '343ea89137006cd9023bf60e6c9e5f1a2503faf9',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8663-js-styled-components/docgen.snapshot',
            hash: 'bf03a19e776908ebc3823ecc80a4d33f085d325a',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8663-js-styled-components/input.js',
            hash: '7eb40f01b94681b17195fc77ae80bfdd699db6dc',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8663-js-styled-components/properties.snapshot',
            hash: 'e6923faff496524278e5302e6e750d3e98d74753',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8740-ts-multi-props/docgen.snapshot',
            hash: '8c8de9f930854bfe581b3d531d04d2df67c4855d',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8740-ts-multi-props/input.tsx',
            hash: '65aba6f76e456570ce3299528d77d528f8635211',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8740-ts-multi-props/properties.snapshot',
            hash: '9877ca576ceb53397146bfc3b5c074ee98e71a3e',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8894-9511-ts-forward-ref/docgen.snapshot',
            hash: '3f60a5fc45f8b00e75ef4a9358d1691c707606d6',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8894-9511-ts-forward-ref/input.tsx',
            hash: '0878c8cd8ca3b49e115183cb429f6feac5ea6b30',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/8894-9511-ts-forward-ref/properties.snapshot',
            hash: '63a04364ae3a67269df06b2c5ba6aaf5e38f9bcf',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9023-js-hoc/docgen.snapshot',
            hash: '6755a05a5cfcc8cb8d63f6b0dfedb0acf455bf28',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9023-js-hoc/input.js',
            hash: '3c40e3472a01fd0c82c71cbe3dc25f784c1b6426',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9023-js-hoc/properties.snapshot',
            hash: '7d6c8e0a2749b689abb06a2de2f9d8165d62aff1',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9399-js-proptypes-shape/docgen.snapshot',
            hash: '97f537acf986c28ccd660b86a94e1518ffa8c536',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9399-js-proptypes-shape/input.js',
            hash: 'af120524fa8f1d4277fcc3779b5e0f3111991ecd',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9399-js-proptypes-shape/properties.snapshot',
            hash: 'e831f52c1ab154e5e71b52fd7e07841dc2a44e42',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9465-ts-type-props/docgen.snapshot',
            hash: 'eed6ac7c10e2112a2a7b440c98e77f87aeba16a6',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9465-ts-type-props/input.tsx',
            hash: 'e5627c8058faff21112da88647da7dbd169a55af',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9465-ts-type-props/properties.snapshot',
            hash: 'e2d4df1dcc0ef81a980cff2058d8bc52ce60f343',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9493-ts-display-name/docgen.snapshot',
            hash: 'c70717fe89583377bf2ee0aba5ed2446cc0f9ce8',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9493-ts-display-name/input.tsx',
            hash: '57155c790165f16beaa41506622eccd91cd67021',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9493-ts-display-name/properties.snapshot',
            hash: 'f6be2f921ecf626333d8e0516951d17d6b77c689',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9556-ts-react-default-exports/docgen.snapshot',
            hash: '3885b65757ac89c825afe218eb5cf38ff1cd38a5',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9556-ts-react-default-exports/input.tsx',
            hash: '3517870221b2b73e00e113d5fa8fdfee4ca091d7',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9556-ts-react-default-exports/properties.snapshot',
            hash: 'daa979f95c81b3cb1af6a47f9f5a3e871dba3fe2',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9575-ts-camel-case/docgen.snapshot',
            hash: '9494b9c88cd9d76d2f66fd7cb1dc85902a9bab53',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9575-ts-camel-case/input.tsx',
            hash: '20ddf073f781178a9adb97bf326d719903a7c3de',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9575-ts-camel-case/properties.snapshot',
            hash: '4ca7be31120de8c8eba6cd71e972b9777fc9dd50',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9586-js-react-memo/docgen.snapshot',
            hash: 'e31e4ae12586d8709dddad2627a906114d3ebeb6',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9586-js-react-memo/input.js',
            hash: '19f7951a337a48ae9ff86082ba2b0aef403f76dc',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9586-js-react-memo/properties.snapshot',
            hash: 'dcbf79ea55375141f72b1a1c89a5b935dc092e32',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9591-ts-import-types/Bar.tsx',
            hash: '7dee0fa7f6ec8b8e362d5e4223c05e51f8f0b981',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9591-ts-import-types/docgen.snapshot',
            hash: 'a059bf1880b05a51a084147d1822de8cc08d7a7e',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9591-ts-import-types/input.tsx',
            hash: 'f1049b4e1acb6b13b3b9f0849b016805f0c5e67b',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9591-ts-import-types/properties.snapshot',
            hash: 'cc8d448239d6a27d9a80027d090ad366ff4e2cc3',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9592-ts-styled-props/docgen.snapshot',
            hash: '867262a0c978e3f674082173d1330e9470d44462',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9592-ts-styled-props/input.tsx',
            hash: '485bad8f10b7838df21297c00511bb5a49933943',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9592-ts-styled-props/properties.snapshot',
            hash: '3298e7c6d942c9632c13e9f2f6626d6f1277bca3',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9626-js-default-values/docgen.snapshot',
            hash: '7b5b63c1440b01f12903dedaf6b9c87954bef9da',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9626-js-default-values/input.js',
            hash: '451411c1c1e4f5a97f08802ac8c8d65c5042fb98',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9626-js-default-values/properties.snapshot',
            hash: 'b1043c87f41922a9b13e72c86ba98422bc23d1c5',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9668-js-proptypes-no-jsdoc/docgen.snapshot',
            hash: '1d189717438ea2be3800d8db0bb027df8925c9f5',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9668-js-proptypes-no-jsdoc/input.js',
            hash: '2e66bdd696d2f60870224859f0577fef295a87db',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9668-js-proptypes-no-jsdoc/properties.snapshot',
            hash: '3c8760699b960ce51f7db8b04fc2c2993e4f04be',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9721-ts-deprecated-jsdoc/docgen.snapshot',
            hash: '69821e3c56b5426e2c2b1bfd47e7990d310aeb47',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9721-ts-deprecated-jsdoc/input.tsx',
            hash: '1d9fa51da82590dbdab10e40e151d430a25b35c4',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9721-ts-deprecated-jsdoc/properties.snapshot',
            hash: 'db5588270f7c54e977c2af11f43b7c14ce58bc48',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9764-ts-extend-props/docgen.snapshot',
            hash: 'af6e21ceac748f5819467417b89a5373b1ff1241',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9764-ts-extend-props/input.tsx',
            hash: '2abd61eed129c2278ae4f7cfb99ef06d457c6ff2',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9764-ts-extend-props/properties.snapshot',
            hash: '3f3b110e6ddbefa01ee3da55ab1fe91bbb87d384',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9827-ts-default-values/docgen.snapshot',
            hash: 'e029b62e2a1396aebfa1888787bbf3278f3442b9',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9827-ts-default-values/input.tsx',
            hash: '373829aac3b3d64ac25d14e4c5908728eadc8793',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9827-ts-default-values/properties.snapshot',
            hash: '5d944694e62b1898049c1858f4b1d924489a15e6',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9832-ts-enum-export/docgen.snapshot',
            hash: '2af0f01d294468b66256d1308dba54ba018a0789',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9832-ts-enum-export/input.tsx',
            hash: '3072adb5705e6e10afdb53f062d9cf1bdb8b0d5e',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9832-ts-enum-export/properties.snapshot',
            hash: '85dec505d2c504296b03b68ca1b6cd1aec8a5081',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9922-ts-component-props/docgen.snapshot',
            hash: '82936b526eefb07c2c44c28fba598f213c1ffaf6',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9922-ts-component-props/input.tsx',
            hash: '797836d2c0d5bf5f5b3b8934d0709897d83dd91f',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/9922-ts-component-props/properties.snapshot',
            hash: 'd9342f6004e250d212d523be5ade40cf21c21ec6',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/imported.js',
            hash: 'bce6a5aa3d02ef313b224f1d314863d9dd69f48f',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-class-component/docgen.snapshot',
            hash: '1db7dceec9b5947c0884bed4e5cf786cfa50fccf',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-class-component/input.js',
            hash: '2a20097cf217176a26b2755b9fc48f1b5e29cc11',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-class-component/properties.snapshot',
            hash: '08fd4d37ec0008436bebbb34ec7091d7dbc0aa1f',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-function-component-inline-defaults-no-propTypes/docgen.snapshot',
            hash: '5d6d096c94d0ba0a4cc7c52ad0c25dfd3da91394',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-function-component-inline-defaults-no-propTypes/input.js',
            hash: '1785e49cb830f68aeb0e41091841ecaac0b32415',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-function-component-inline-defaults-no-propTypes/properties.snapshot',
            hash: 'da879fbd6496a4758de8e5ad607f066bd05826c7',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-function-component-inline-defaults/docgen.snapshot',
            hash: '7f74499f960032a22a688c9a45c1d2b44d0420de',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-function-component-inline-defaults/input.js',
            hash: '8bc5c569444fd9532044bf7db0e8e66830626660',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-function-component-inline-defaults/properties.snapshot',
            hash: '82812fd3d49a8d8d935207bd92b9d56904d5982d',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-function-component/docgen.snapshot',
            hash: 'a650f756257740abc4773b734e05975e7f04e35a',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-function-component/input.js',
            hash: '42959b7b0cbd318396390af2b3f1b04e094edfd5',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/js-function-component/properties.snapshot',
            hash: '928cb8607ea08b80e6394776e03372be8f5dc65c',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/ts-function-component-inline-defaults/docgen.snapshot',
            hash: '4b89bc19b0db0310113de8484c90239534161622',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/ts-function-component-inline-defaults/input.tsx',
            hash: '06b5b62edfdcdb649c1cbdaca0308a0091f3f801',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/ts-function-component-inline-defaults/properties.snapshot',
            hash: 'dd9033fac25d4d8f6728ecd25242ee2b9359b956',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/ts-function-component/docgen.snapshot',
            hash: 'f80c3c319f3b1122d7141e1cd0e188e240d067e5',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/ts-function-component/input.tsx',
            hash: '9f0c2598ff072710386bf32b37bffa3db1385aef',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/frameworks/react/__testfixtures__/ts-function-component/properties.snapshot',
            hash: '3597a37074634f577fe9039d44a1868cb9d2747e',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/frameworks/react/config.ts',
            hash: '61a01e8a3affd3bacbcb72327c08e637d87e0b0d',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/extractArgTypes.ts',
            hash: '92ad351a8c7de1c2e14e582c8672b674a0452d8b',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/extractProps.ts',
            hash: '008aa8b26117c32a148164651dedc79e56e225ea',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/jsxDecorator.test.tsx',
            hash: '2b891411cbe5a93db8da14446a90a95bc336ff3c',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/frameworks/react/jsxDecorator.tsx',
            hash: '2fbaab94a41b0146e09648838cd402b2b041d371',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/frameworks/react/lib/captions.ts',
            hash: '83f968d2300ab106494f92b373994908b7fb63c7',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/lib/componentTypes.ts',
            hash: 'b8c14343c1ec885b5634237f129a83cd6a26572c',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/lib/defaultValues/createDefaultValue.ts',
            hash: 'c4cd930e101119d6243ce398c3ff7df4fa8be133',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/lib/defaultValues/createFromRawDefaultProp.ts',
            hash: '6ef614385b5fe35398ba14af453eac978499e925',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/lib/defaultValues/generateArray.ts',
            hash: '6956b0979313aeb0f92bc1920fb83a29efa85a3e',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/lib/defaultValues/generateObject.ts',
            hash: 'c831271d6a629bf80318b292d817ba0eb0f39151',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/lib/defaultValues/index.ts',
            hash: '0bf4b028eb1459648000c26bf31b49b4edcb0779',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/lib/defaultValues/prettyIdentifier.ts',
            hash: '8e0275109ce5af7287474eaef8afc575605ab5aa',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/lib/generateCode.ts',
            hash: 'bcf82756ca3905ad17fbf773e29484e7fad35435',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/lib/index.ts',
            hash: '05ac46600a22867d971703e0a635b4b8234cfa20',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/lib/inspection/acornParser.test.ts',
            hash: '9367f035b7084f6f36fbb38e0e65579c0f1228c5',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/lib/inspection/acornParser.ts',
            hash: '28a5a7ad22670b45cce1b63ba8c7496004bbe227',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/lib/inspection/index.ts',
            hash: 'c9590fdec3af027be7c29e40a4acb809c5b2f240',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/lib/inspection/inspectValue.ts',
            hash: 'e7c0046a28f954f0edc2133f72806e77ba5ceddd',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/lib/inspection/types.ts',
            hash: '88f23d3957f9c4bbb5dfa5665e0a3ccc4ed29505',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/lib/isHtmlTag.ts',
            hash: 'eb13de490d02dc56efb383bba8c1d15e0fe9d4c4',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/propTypes/createType.ts',
            hash: '6af9bc582898a243235725ee1cad13b10ec3a15c',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/propTypes/generateFuncSignature.test.ts',
            hash: '92f6575c93746f2d84c50c5fb7e63d6227d8be93',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/propTypes/generateFuncSignature.ts',
            hash: '0d6b6c251d86eb1a9f44661754a455c7ae47cc6f',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/propTypes/handleProp.test.tsx',
            hash: 'dcbcecb5e16d2cddb9e1125abe34822b5ecbfd5f',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/frameworks/react/propTypes/handleProp.ts',
            hash: '232c1d0cf89c75de750af9c8ad4261c768831c4d',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/propTypes/rawDefaultPropResolvers.ts',
            hash: '9433159adde6dd25e682b3112b14c39d1f1e5fef',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/propTypes/sortProps.ts',
            hash: '4cc5720a1345f877baf1d181ec5417ba2031e556',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/react/react-argtypes.stories.tsx',
            hash: 'a352e441d7c1d579cd5d1c752e4ed813124455e1',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/frameworks/react/react-properties.test.ts',
            hash: '74bbe6555091250b703508d930a9d7df4c71bede',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/react/typeScript/handleProp.test.tsx',
            hash: '1071979909c488f16c96db4d8c5c57872a0a2b62',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/frameworks/react/typeScript/handleProp.ts',
            hash: 'eeecb2db81f0561cdd7966e95c9ed519217fd54e',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/config.ts',
            hash: '033474d23f722b9effef1eb8dd66eff380aef2b9',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/extractArgTypes.test.ts',
            hash: '0af98b44bf6d34bed87a161b3a444c3cd56632d3',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/extractArgTypes.ts',
            hash: '09ea906f1f839ee8036490de97b2e443d17e2fe0',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/svelte/extractComponentDescription.test.ts',
            hash: '3e6eb3e779c31aa2fd5a35a0bce6fce2c564b404',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/svelte/extractComponentDescription.ts',
            hash: '28227129941226b9367ebe1f9f8ecb0ff40e07f9',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/HOC.svelte',
            hash: '0b6c3618701e435b311dbc2973bc64e794c34ee1',
            ext: '.svelte',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/prepareForInline.ts',
            hash: '4d5b66403633c7cc6d322f90255a837081aac61f',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/preset.ts',
            hash: '20004fc4722357173da18536df89670315706d31',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/sample/MockButton.svelte',
            hash: '776316f877dd70f62d0711653d32eb71118b65ee',
            ext: '.svelte',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/sourceDecorator.test.ts',
            hash: '6c55200e21feedf586a94e9224f6e84f1684401c',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/sourceDecorator.ts',
            hash: '40e96c0cbd1e4d6ecd053ce981a880c86fbcea16',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/svelte/svelte-docgen-loader.ts',
            hash: 'fcd09698431c3aaae069a7a7aa9b78f734bd9cb5',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue/config.ts',
            hash: 'a5e41a726139c4ec0ed008a17b4ff9471948cf13',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue/extractArgTypes.ts',
            hash: 'ca65e50f1e3edd0e2e23ef16998346248e7109a9',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue/prepareForInline.ts',
            hash: '98931991e96bb91157745506044881d682639677',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue/preset.ts',
            hash: '5650c588cc674cb55bc1363be8a6aa13c223b292',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue/sourceDecorator.test.ts',
            hash: '54695c1ea84f37e824afb017fb3c2c64010e461c',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue/sourceDecorator.ts',
            hash: '7965dd6beff1f752775972d4dfe193e2c495fb79',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue3/config.ts',
            hash: '4a4fd37a39fb42decd093fc22f57a7d414afa5da',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue3/extractArgTypes.ts',
            hash: '6a264ad6f6d78545c528c2857a533524f396aab1',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue3/prepareForInline.ts',
            hash: '096dcf1349e682f5d8677432e949e87f9ed938e8',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/frameworks/vue3/preset.ts',
            hash: 'c8e044caf8e2ad49289103c88efc9d01e7223fb4',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/web-components/__testfixtures__/lit-element-demo-card/custom-elements.snapshot',
            hash: 'cbf4b8fa425455baf4b143cd6c0c6891f966d470',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/web-components/__testfixtures__/lit-element-demo-card/input.js',
            hash: '1599966fe99ee2c434e6e2afc5cd85b19dfb0b77',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/web-components/__testfixtures__/lit-element-demo-card/properties.snapshot',
            hash: '57a2c58e8866f6b1dddaa17124cc89e5155eedc2',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/web-components/__testfixtures__/lit-html-welcome/custom-elements.snapshot',
            hash: 'c1416386b1b12d1d56061cd77a4a3737f9687d16',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/frameworks/web-components/__testfixtures__/lit-html-welcome/input.js',
            hash: '30e6edec7cf2a2f2e1a85ec571ec6f378feed978',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/web-components/__testfixtures__/lit-html-welcome/properties.snapshot',
            hash: 'a0d337eb0697f04ede61df621ee3e1ce38782d4d',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/frameworks/web-components/config.js',
            hash: '12e5c134d2c9732b46ff83cab94933b657f155c5',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/frameworks/web-components/custom-elements.ts',
            hash: '432f08cab72cda2da12f1c33e45aa216b753179b',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/frameworks/web-components/web-components-properties.test.ts',
            hash: '06d3c04f8599ddf27179370f65b6cef13322ddca',
            ext: '.ts',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/proptypes/arrays.js',
            hash: '0f1ebcdae0926852eaa1594ffcd1ea7a3302f147',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/proptypes/enums.js',
            hash: '60f51359b6f5d9de51e4359fe3d1237f0897e91a',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/proptypes/misc.js',
            hash: 'e662474d1ab16d112d2dcf1ca413c161dd239f64',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/proptypes/objects.js',
            hash: '09036cf8808851b9cb0224d88b87984bc97d0198',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/proptypes/react.js',
            hash: 'fd54e9307663c521a4943a47e2670e71c1be4086',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/proptypes/scalars.js',
            hash: '7e74151596b03c69b8d9e544a3bd1742c5ff3548',
            ext: '.js',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/aliases.tsx',
            hash: 'a5ec67cd472400d121b2c67bc840e322124bfeb7',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/arrays.tsx',
            hash: '74c8a4d56a075c3da57bf2fef9c9ad1a76158632',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/enums.tsx',
            hash: '9cf04170aab9860478fa37865cffa5d6bae13e48',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/functions.tsx',
            hash: 'cbe35a3ac0fcb7bb68c494cbdb0d2da3ba4c1ad0',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/interfaces.tsx',
            hash: '3f931b09c08786757c495964a4facb2d1347a182',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/intersections.tsx',
            hash: 'a075158cd58026d27ec299d6eea9d4a1ea77462f',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/optionals.tsx',
            hash: 'cced6cf2007c6c5ec380030f6aad47f0de40c40f',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/records.tsx',
            hash: 'b8e541f35ababffc408a515ba9cc5859a406677e',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/scalars.tsx',
            hash: '44f533a01b4975e25d5ca351e3394b4db40085bd',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/tuples.tsx',
            hash: '490fbd61aa662e7a8a69cb90fb4dd1a034e7ba1f',
            ext: '.tsx',
          },
          {
            file:
              'addons/docs/src/lib/convert/__testfixtures__/typescript/unions.tsx',
            hash: 'eb8bbfc406ff7b4de9d55cac146d2f086f9bbd37',
            ext: '.tsx',
          },
          {
            file: 'addons/docs/src/lib/convert/convert.test.ts',
            hash: '0cbdb3a324fd766256f326c368ffe17dc233e5ef',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/flow/convert.ts',
            hash: 'b9ef15867ea7e6459211131705550ac879324ed6',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/flow/index.ts',
            hash: '0ef743fdb7ef1af39984950aac915f7b107357cb',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/flow/types.ts',
            hash: 'b131ac5755263b13c071f34a6b8c29328e66daca',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/index.ts',
            hash: 'f6cd38a778503a574661128964034e8cdd6c26c1',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/proptypes/convert.ts',
            hash: 'bc4da9573401950abe9fd4f3392fb42c7b970e78',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/proptypes/index.ts',
            hash: '0ef743fdb7ef1af39984950aac915f7b107357cb',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/proptypes/types.ts',
            hash: '8f5e2aff2483380d4de1dfbfe58578e8681ac8f9',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/typescript/convert.ts',
            hash: '3affe3e70487fd0d6027f1897bc75881ff709a71',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/typescript/index.ts',
            hash: '0ef743fdb7ef1af39984950aac915f7b107357cb',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/typescript/types.ts',
            hash: 'dee016d767348398c6af1ce65e481abd14083edd',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/convert/utils.ts',
            hash: '00d59c295b7f450e4f7527aaa90086fb23d4a797',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/createPropDef.ts',
            hash: '3916a3aeff3537b20cfa31c56fe78fa40ecddca3',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/extractDocgenProps.test.ts',
            hash: '5195cf2e4b3adb6f9491a139cdb43eeb5624cd04',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/extractDocgenProps.ts',
            hash: 'c7a9090adf4f08dddcef95c4c01425d59b0e8b9d',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/flow/createDefaultValue.ts',
            hash: 'a9be5f0fe9d43e9a7c8f39d883322c529fc2d602',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/flow/createPropDef.test.ts',
            hash: '4b563e3f86dba6a07887945646e5e11ebcb1995f',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/flow/createPropDef.ts',
            hash: '74c03e280a9b38bf719846928ad484bdf239d1a3',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/flow/createType.ts',
            hash: '2e9d86a93a4fff6ff5b218bb0ef4e114b48fd82c',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/index.ts',
            hash: '4116325caa863664fc2a5e2237a70bcf6240884d',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/PropDef.ts',
            hash: 'b204085397b81ec5942061664e1e7d1f2b14eaf2',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/types.ts',
            hash: 'fcae772fa5b951c25d437db1fa1fb6358f550c6b',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/typeScript/createDefaultValue.ts',
            hash: '14bfcf67b68705667e22e2c9b3a5bdffa3297e7e',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/typeScript/createPropDef.test.ts',
            hash: 'f0536ac9fc114db3d78c1cae1c27a9e1e66bb764',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/typeScript/createPropDef.ts',
            hash: '0737004390ca7e839741d68fdc9ef81f2c99eb4d',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/typeScript/createType.ts',
            hash: 'c2022c90d4f3b27dd46e4343cb7ddd05a05c6460',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/utils/defaultValue.ts',
            hash: 'e85efb4546a2469d1f62ba7a39a6f487f99ecf48',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/utils/docgenInfo.ts',
            hash: 'da7f21f7a06d5216eb3ebf505846584aec53fdd4',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/utils/index.ts',
            hash: 'd62a105a18287b6ffa04732a590c5d18f97ce508',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/docgen/utils/string.ts',
            hash: '9accdd8d0639110f71f385b26d4070530bec0a29',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/index.ts',
            hash: '04bca77e0dec46fccb655a9203c2c8ee57ba7ed2',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/jsdocParser.test.ts',
            hash: 'e3ec359b9b9493d87c6594fbaa0c278da9a56211',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/jsdocParser.ts',
            hash: '1b9f971856e90ae642f038878fea81e8f22776f9',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/utils.test.ts',
            hash: '0cd887200ded5ce57eb5cb8a8b024253763c11df',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/lib/utils.ts',
            hash: 'b623c12e19b7c2646d2a5f8a2b935e099dcb8de2',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/component-args.mdx',
            hash: 'd9a1c2d8e8b967445c975b09e66c5424a94c2d38',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/component-args.output.snapshot',
            hash: 'a8ef36b42a5f1f6835b346e056b36c48bb11dce6',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/component-id.mdx',
            hash: 'e6ca2de9dadb293d8ea43a18bb5450dd3f72b8e0',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/component-id.output.snapshot',
            hash: 'b4917f10b89818fcf8a9ea13c712beb7cd01720a',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/csf-imports.mdx',
            hash: '3ba992d778a80a9ad02ac08c797a49a35389995b',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/csf-imports.output.snapshot',
            hash: '658be917d53d235252a444d6e4e61e659636fe28',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/decorators.mdx',
            hash: '1a38b0053aefcee0bf2bd238cd5c3b6275935e32',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/decorators.output.snapshot',
            hash: '0b1c8bc31788e4113671e6e78c42d660032710b2',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/docs-only.mdx',
            hash: '308dde0e8faf8ecb57b6bca161dfb0bed992e283',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/docs-only.output.snapshot',
            hash: '5731a848de79a06f5cf7fdf3ce0352da7e2ac326',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/loaders.mdx',
            hash: '3497a9bf25b63a56f8a144fe8fc48932daf0f723',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/loaders.output.snapshot',
            hash: 'f3ca9d474df5fd4fa6bc82ef49d1431cfc002d61',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/meta-quotes-in-title.mdx',
            hash: '83705fe692826da07ec9653820070614bdb75c24',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/meta-quotes-in-title.output.snapshot',
            hash: 'f2c7a837b36fc41187fb9575fabeb96267ca4cb1',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/non-story-exports.mdx',
            hash: '833dd03c138689a73f1dea79337e005133cc2af0',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/non-story-exports.output.snapshot',
            hash: 'a8be405025c928708e4ea671b4688be1dcd1cb00',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/parameters.mdx',
            hash: '2b2e1c6b55466a0a547d46188a38b8ec2020e718',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/parameters.output.snapshot',
            hash: '64f14f13d2eb11664295dc33504f804d855d6948',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/previews.mdx',
            hash: '36a20070f1f691102fae784b8b9838e7814fc587',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/previews.output.snapshot',
            hash: 'fe9ba13496a75ab9895f97b594bb45762a322f18',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/story-args.mdx',
            hash: '6472dbd22a3f3cb297fb82c9ceb0750cb9bf4d55',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-args.output.snapshot',
            hash: '660673694e65366189631cc8df03d8ff0ec56855',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/story-current.mdx',
            hash: 'd5b62cc6edab2350a145712a00017f836ed815c7',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-current.output.snapshot',
            hash: 'a42af6f51baf48959978b7239c129e46c92c03ae',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-def-text-only.mdx',
            hash: '78ebd50215ee19df2f4f2426296584a43ad2020c',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-def-text-only.output.snapshot',
            hash: 'c16d04e61fdcfc14bc9d177dc09627f420500a6d',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/story-definitions.mdx',
            hash: 'b50bb0df7e2cd1e591d14dc58a128a304e1c0409',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-definitions.output.snapshot',
            hash: 'db6478f54a09db5542d56af2e89cf4573ccb56e5',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/story-function-var.mdx',
            hash: '7cfbae252f7bec96f372615c6890ca1c77c3eccc',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-function-var.output.snapshot',
            hash: '4be4c0519943756ee22bc3ad3e78593945e956b7',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/story-function.mdx',
            hash: '839781dee9f8a62519cd2103752dbc70f149feeb',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-function.output.snapshot',
            hash: '242d60a066d2f58982835e0354d255d126223bc4',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-missing-props.mdx',
            hash: '0eb3137a9756196d98481834d35e4dd6825fd62c',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-multiple-children.mdx',
            hash: '02e3ebed245365fe411d72c27a5ea0081eee3d9a',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-multiple-children.output.snapshot',
            hash: '9371c021c9417150060b23d0cc9fb49e6f8b43f2',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/story-object.mdx',
            hash: 'e63d48923842606c670f44f4cd4c030554a0d116',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-object.output.snapshot',
            hash: '3f2306547be3956ad79db0a4ca05a3ced6e748df',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/story-references.mdx',
            hash: '865bd5dea49b48aa5c2c59e885caa25308942d64',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/story-references.output.snapshot',
            hash: 'cb4e3b026260e0975cdbe17b227f0a9387adb19b',
            ext: '.snapshot',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/title-template-string.mdx',
            hash: '3e41ab169fb555a7ba6ec626644dba2b90e5cf64',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/title-template-string.output.snapshot',
            hash: '0fda2e2a98c47529709c7bfab8efe3fa503010dd',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/__testfixtures__/vanilla.mdx',
            hash: '93ccac3d6bc3821c9e12af4042af540785561f90',
            ext: '.mdx',
          },
          {
            file:
              'addons/docs/src/mdx/__testfixtures__/vanilla.output.snapshot',
            hash: '1913e0b92e32d6b385922516162d4d69e75acd6d',
            ext: '.snapshot',
          },
          {
            file: 'addons/docs/src/mdx/mdx-compiler-plugin.js',
            hash: '02a8e4ae9b4d2f0d8640e943c7f072405aa6c8a3',
            ext: '.js',
          },
          {
            file: 'addons/docs/src/mdx/mdx-compiler-plugin.test.js',
            hash: '599e4b9fad6cb0ce5906c85a371413e8f72b93a3',
            ext: '.js',
          },
          {
            file: 'addons/docs/src/public_api.ts',
            hash: 'dafa948eda6c23a151531d7dec4365fe7020db22',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/register.ts',
            hash: 'b36d05086ddb483bc3196bf9e34d60d62e0e768a',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/shared.ts',
            hash: '178bf46ca387e2e96af1087fb4ef609e17664bb2',
            ext: '.ts',
          },
          {
            file: 'addons/docs/src/typings.d.ts',
            hash: '99571482f456b36ef16d9c1cd187dd9ac49c02bd',
            ext: '.ts',
          },
          {
            file: 'addons/docs/tsconfig.json',
            hash: '38e42ca13fd57af0ac3ea75ab0cfa16c3d4088c2',
            ext: '.json',
          },
          {
            file: 'addons/docs/vue/README.md',
            hash: '2a3dd63613d0cebcb69d356e732ad79d09b5b678',
            ext: '.md',
          },
          {
            file: 'addons/docs/vue3/README.md',
            hash: 'a263ffe8a2f698aebf7241e1ad4a9e7a801a821a',
            ext: '.md',
          },
        ],
      },
    },
    '@storybook/addon-jest': {
      name: '@storybook/addon-jest',
      type: 'lib',
      data: {
        root: 'addons/jest',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'addons/jest/docs/storybook-addon-jest.gif',
            hash: '4e94db960f216265c0dbbeda94c494e3d6fcb40b',
            ext: '.gif',
          },
          {
            file: 'addons/jest/package.json',
            hash: '3a08ceb37eca9927c70a1e86ddc856f5c19af12c',
            ext: '.json',
          },
          {
            file: 'addons/jest/README.md',
            hash: 'd8912bf0592a4ea6859d0c699d6f1e48d27cfaf9',
            ext: '.md',
          },
          {
            file: 'addons/jest/register.js',
            hash: 'f209c0eb3703abd57811f8c46d976d39ecb68b70',
            ext: '.js',
          },
          {
            file: 'addons/jest/src/components/Message.tsx',
            hash: 'd58451260d022a34b885edcd882fe13f6b7c5232',
            ext: '.tsx',
          },
          {
            file: 'addons/jest/src/components/Panel.tsx',
            hash: '72a1c88da02b332debd8cc712811d5f5879987bd',
            ext: '.tsx',
          },
          {
            file: 'addons/jest/src/components/Result.tsx',
            hash: '43545d03939a99b9a211066e268c11e15d7cc8d6',
            ext: '.tsx',
          },
          {
            file: 'addons/jest/src/hoc/provideJestResult.tsx',
            hash: '873274ab9f60ebbf0ef6046aa7c7325540aee8e7',
            ext: '.tsx',
          },
          {
            file: 'addons/jest/src/index.ts',
            hash: '6ab99c506410d75ae8d754c67f78c168ef3e1e55',
            ext: '.ts',
          },
          {
            file: 'addons/jest/src/register.tsx',
            hash: '4db72017ce7416e6ddadb836a248c284dc122e81',
            ext: '.tsx',
          },
          {
            file: 'addons/jest/src/shared.test.ts',
            hash: 'db9ab09050c491efb96963bd946919ea898190d8',
            ext: '.ts',
          },
          {
            file: 'addons/jest/src/shared.ts',
            hash: '1fdda0b4a24385b15b9ae6ca8203eece1a505bbd',
            ext: '.ts',
          },
          {
            file: 'addons/jest/src/typings.d.ts',
            hash: 'a41bf8a45b794eb44d6af995b21b359f2fc56f20',
            ext: '.ts',
          },
          {
            file: 'addons/jest/tsconfig.json',
            hash: '858d1aa0ffb9c7801bc308b915e1cbd4d5ea4aa9',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/angular': {
      name: '@storybook/angular',
      type: 'lib',
      data: {
        root: 'app/angular',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/angular/bin/build.js',
            hash: 'ede4f1cf128440f0a58f34ab2b5bce52e2d04bdc',
            ext: '.js',
          },
          {
            file: 'app/angular/bin/index.js',
            hash: '46d696f8a874d276f144c66627ecd72d36b454d2',
            ext: '.js',
          },
          {
            file: 'app/angular/demo.d.ts',
            hash: 'c2deaa98dbb3b158430d799d53d4e83f5e866790',
            ext: '.ts',
          },
          {
            file: 'app/angular/demo.js',
            hash: '8e9cc6c0bf4df61b0d8665ea7cb68b94849df04a',
            ext: '.js',
          },
          {
            file: 'app/angular/element-renderer.d.ts',
            hash: '83074120d822888548057f5217bcf0a6b044780a',
            ext: '.ts',
          },
          {
            file: 'app/angular/element-renderer.js',
            hash: '9c6e428015d8a15c3208716841cbb10b634d6182',
            ext: '.js',
          },
          {
            file: 'app/angular/jest.config.js',
            hash: 'd1edfe27c2d1dcea3cca06b4b8bdb5016544074d',
            ext: '.js',
          },
          {
            file: 'app/angular/package.json',
            hash: '73d7d9845b3f8efb44d87742d5b3d31793d3719f',
            ext: '.json',
          },
          {
            file: 'app/angular/README.md',
            hash: '9a0ed4814e06d9b7b3bf8a4b9f4553f1d70282e7',
            ext: '.md',
          },
          {
            file: 'app/angular/renderer.d.ts',
            hash: '7013dfb23b5eb5b64122db395a2151da9eeaca16',
            ext: '.ts',
          },
          {
            file: 'app/angular/renderer.js',
            hash: '57241c924fcd503c6e21991d3a7b8f1d518c9adb',
            ext: '.js',
          },
          {
            file: 'app/angular/setup-jest.ts',
            hash: 'a910afad90027e4d88a835e94c5ddb3c7ccb1b08',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/index.ts',
            hash: '5d2a76536cef39eb0a7e45cc88a8294d638dae59',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/__testfixtures__/input.component.ts',
            hash: '93ea8e346f5441ed3629ab184a564cfb05dd28cd',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/ComputesTemplateFromComponent.test.ts',
            hash: '4aaf6419a9b3a74fc01aa3f98be0a18138ea362c',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/ComputesTemplateFromComponent.ts',
            hash: '1e80cbdfb4f37490564683fc436f0e33fa4a4cbd',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/ElementRendererService.ts',
            hash: '7a79c9fd06ea25ab7efbf35349c0c3ad23f6419b',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/RendererService.test.ts',
            hash: '3f6dbb067b851bf84a0334f7701a37eeda77971b',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/RendererService.ts',
            hash: '16231c5f290ed446e0914d07853b571488f8b860',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/StorybookModule.test.ts',
            hash: 'd5bf4afad8ffb531d22e27dc8aacc7f15657cdb1',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/StorybookModule.ts',
            hash: 'dab78a579969ec9cf7cd723c3a82d599a8189d43',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/StorybookProvider.ts',
            hash: 'fac08eeea0823f345047237de50787a7f1c0472e',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/StorybookWrapperComponent.ts',
            hash: 'd4784a95c9016995cffa926be1bbddaec5602248',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/utils/NgComponentAnalyzer.test.ts',
            hash: '5c0ba24f95ff5e49aff9f379b5c9f7914864765c',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/utils/NgComponentAnalyzer.ts',
            hash: '80233b8756102cf48c7db27f63d3cb13fe20e406',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/utils/NgModulesAnalyzer.test.ts',
            hash: '076dff84a73035ed3ff5561cdc1ead092576b8c9',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular-beta/utils/NgModulesAnalyzer.ts',
            hash: '54e721ebea2da5204e0528ffc32608d68aa7b93b',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/angular-polyfills.ts',
            hash: 'c417d81683dd12d7a08089999f28c682597ad87b',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/angular/app.token.ts',
            hash: '19e8d438f6f98216904569dca321a7cb2a4187a5',
            ext: '.ts',
          },
          {
            file:
              'app/angular/src/client/preview/angular/components/app.component.ts',
            hash: '57bd79442abc3b05da27b132b0d9352fd003b0e5',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/angular/helpers.ts',
            hash: '2019be6d742b0de08055d239c1d1842a478873f7',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/decorateStory.test.ts',
            hash: '0788e7732f67ee7f453227c7da1f8993d435cf6b',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/decorateStory.ts',
            hash: '5d52b2b6e838dc7ec90166e651bbd68416c08c73',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/decorators.test.ts',
            hash: '5107253c2be69ef0b5b267b14b1fbe162d92d0d8',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/decorators.ts',
            hash: '9471c0d2dc647c34de88ee42ac7d19ea6079e74f',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/globals.ts',
            hash: 'f0b31005d51f164b56a7fb2a03039433568da6d7',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/index.ts',
            hash: '1f36d485fecfaf7bb2abd4d0014c9b9d2af9d208',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/render.ts',
            hash: 'fcd1e0b2b557d8d7adda6530acc1b63e5f1ebf3b',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/types-6-0.ts',
            hash: 'c2b0514ddf3a229be1f1a1dd160210a2305889b1',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/client/preview/types.ts',
            hash: '3a9d8a5320c13c0d341004afd8f428b282b64d0a',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/demo/button.component.ts',
            hash: 'da804e507b7d5f6f30cd50f619536cf596f7c1b9',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/demo/welcome.component.ts',
            hash: 'ab8309c1a5816b68e685467b846945d6e793dc57',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/element-renderer.ts',
            hash: 'e49b411e80a22d9e98a29ad222df0c508454fed0',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/public_api.ts',
            hash: 'a2a0c8493b1e41a7e674a8ef24577cee8e630310',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/renderer.ts',
            hash: 'b0d888b859847f4599d4bb090bd033c50986e32c',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/__tests__/angular-cli_config.test.ts',
            hash: 'ae09891c02090b09737a833f7ba2b8ea1e9f7ea2',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/__tests__/angular.json',
            hash: 'd703e396ff223a583888bb13e01ddb50c42fbce2',
            ext: '.json',
          },
          {
            file:
              'app/angular/src/server/__tests__/create-fork-ts-checker-plugin.test.ts',
            hash: 'e77d4746097a0a727b4e22be439cd9319803ec50',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/__tests__/ts_config.test.ts',
            hash: '1b84a549f06d86f82bceb272a5b950e999d751e4',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/angular-cli_config.ts',
            hash: 'e01dd2d047ec3fb32d0e014290895c7632cc2580',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/angular-cli_utils.ts',
            hash: 'e8797a3c489b8407c7a2c939b7f6592a6a351164',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/create-fork-ts-checker-plugin.ts',
            hash: '941dd81031a44401693ed19fe5b96df7a4833551',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/framework-preset-angular-cli.ts',
            hash: '3fac5aa5b675f7aa6eb41f4365316fdc4672c376',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/framework-preset-angular.ts',
            hash: '065ed8add6b3afd31769d1c9a0de47e0f6b8783f',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/ngx-template-loader/index.ts',
            hash: '10ff4359f5678835ebae2a0b80e1256258b925c1',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/options.ts',
            hash: '0e6db430b458637e53659796b482c14d7269c124',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/server/ts_config.ts',
            hash: '196c42fd938765023a5004d6d468166fd23d8f88',
            ext: '.ts',
          },
          {
            file: 'app/angular/src/typings.d.ts',
            hash: 'd8f7c6f660ad7acc11040fd6d2e70cb5dde4dccb',
            ext: '.ts',
          },
          {
            file: 'app/angular/standalone.js',
            hash: '3d1e5d4065be3753566d0bf3254b96687036600f',
            ext: '.js',
          },
          {
            file: 'app/angular/tsconfig.json',
            hash: '33b25f01fd549c0b0d5cfc01f5b83b4f5c65f6b1',
            ext: '.json',
          },
          {
            file: 'app/angular/tsconfig.spec.json',
            hash: 'd52945662591f16900975bd072f5de007326e20e',
            ext: '.json',
          },
          {
            file: 'app/angular/types-6-0.d.ts',
            hash: 'b5946b39a8d8e20d1c13962a519c1aeae6a25c94',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/aurelia': {
      name: '@storybook/aurelia',
      type: 'lib',
      data: {
        root: 'app/aurelia',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/aurelia/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/aurelia/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/aurelia/package.json',
            hash: 'b201af117aaf9d76a130e7940b560413ef5883a2',
            ext: '.json',
          },
          {
            file: 'app/aurelia/README.md',
            hash: '95b664252cfd2b79eaed3cd0f84d16735592a743',
            ext: '.md',
          },
          {
            file: 'app/aurelia/src/client/index.ts',
            hash: '2f61014c86b14b23f59e5a6d0dd6bdd538ace01a',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/client/preview/decorators.ts',
            hash: '25b97e3cd639f2b731c62673c3fa44f7f9be4f52',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/client/preview/globals.ts',
            hash: '7b7c2bf071359182bceae7702cc939bcbd00effa',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/client/preview/index.ts',
            hash: '2a12386306e0d4e69964d83f9f17681969d77ebf',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/client/preview/render.ts',
            hash: '64a06c1ac0c280728b1f3f47259be6e45c367e2c',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/client/preview/types.ts',
            hash: '9f399b5a9f6160b23f40146935058ca9bc4ca271',
            ext: '.ts',
          },
          {
            file:
              'app/aurelia/src/server/__tests__/create-fork-ts-checker-plugin.test.ts',
            hash: '7c49df4500e3ddb7d64f808ab0515de75fd3cb79',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/server/__tests__/ts_config.test.ts',
            hash: '046001787ad8e346508dbe2f9d03ce3c06cac76c',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/server/create-fork-ts-checker-plugin.ts',
            hash: '594fe5a25384662f39938d6b6f6d5be1fcfeded4',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/server/framework-preset-aurelia.ts',
            hash: '08cf01f6680f88e33820431ab9c439bb7e6e6871',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/server/options.ts',
            hash: 'dd40f9faa80768d8431acd4efb8c9c83927e8c80',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/src/server/ts_config.ts',
            hash: 'e26ab3f056d6e9491d19de8238b059201817622c',
            ext: '.ts',
          },
          {
            file: 'app/aurelia/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/aurelia/tsconfig.json',
            hash: 'c53104b1f372c08f01d563e08fc2c14fc96a71e0',
            ext: '.json',
          },
          {
            file: 'app/aurelia/typings.d.ts',
            hash: 'd8f7c6f660ad7acc11040fd6d2e70cb5dde4dccb',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/mithril': {
      name: '@storybook/mithril',
      type: 'lib',
      data: {
        root: 'app/mithril',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/mithril/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/mithril/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/mithril/package.json',
            hash: '54c1f27dc479c6ced76afd02074e831b77993c88',
            ext: '.json',
          },
          {
            file: 'app/mithril/README.md',
            hash: 'cd088b8ec8ef9ecb17e607f90af2bda444f40663',
            ext: '.md',
          },
          {
            file: 'app/mithril/src/client/index.ts',
            hash: '8034a9d6433dd177a2f3a97a3e6c3c4c3cfb469b',
            ext: '.ts',
          },
          {
            file: 'app/mithril/src/client/preview/globals.ts',
            hash: '30a61339d88852213958864d46ead4460c180e2e',
            ext: '.ts',
          },
          {
            file: 'app/mithril/src/client/preview/index.ts',
            hash: 'd78def9fc89dc4b192bd5fdc9fe30fe90a4871e9',
            ext: '.ts',
          },
          {
            file: 'app/mithril/src/client/preview/render.ts',
            hash: '285e68a387b9257b67b8f0355a79642e18ef9922',
            ext: '.ts',
          },
          {
            file: 'app/mithril/src/client/preview/types.ts',
            hash: '68fb14b61e12db8e33a200531f6e55552491f79b',
            ext: '.ts',
          },
          {
            file: 'app/mithril/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/mithril/src/server/framework-preset-mithril.ts',
            hash: 'f42bf4c7477858f75441355fc0a3de63515da9b2',
            ext: '.ts',
          },
          {
            file: 'app/mithril/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/mithril/src/server/options.ts',
            hash: '917bf3bef14532a826c79b8011ab328aefe66cdb',
            ext: '.ts',
          },
          {
            file: 'app/mithril/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'app/mithril/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/mithril/tsconfig.json',
            hash: 'cfa421a8c7764357aace1965addea6344143b668',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/codemod': {
      name: '@storybook/codemod',
      type: 'lib',
      data: {
        root: 'lib/codemod',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/codemod/package.json',
            hash: '51bc32e442ec9ab356733e86f54fa32b28617d93',
            ext: '.json',
          },
          {
            file: 'lib/codemod/README.md',
            hash: '0cb4f2b2794f391deb5149d6a472acee688a6feb',
            ext: '.md',
          },
          {
            file: 'lib/codemod/src/index.js',
            hash: 'fd399d05fb31e79902eb678c35440a8471f06c73',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/lib/utils.js',
            hash: 'bacb61a17328f4d436dbf71685deb92070d1c3e8',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/lib/utils.test.js',
            hash: '588ed7f3ad45340489f714b1fe4d0d120605a81e',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/add-component-parameters/add-component-parameters.input.js',
            hash: '8ec32d74ebe279a5f219bad11215f7e488b917d0',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/add-component-parameters/add-component-parameters.output.snapshot',
            hash: '5391358b11189a89a0839bf1a970a21e679c883a',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-hoist-story-annotations/basic.input.js',
            hash: '7a8a3eaa0717d140a9b3b3868f21d10e6ec8225f',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-hoist-story-annotations/basic.output.snapshot',
            hash: '3508512e0d3baaa7a4bb1b84ffcefc4715ab3053',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-hoist-story-annotations/overrides.input.js',
            hash: '76796d8c460fa4e2b9f82048585092655c2e71a3',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-hoist-story-annotations/overrides.output.snapshot',
            hash: '3ece8c67141d3bcf5e156d6437d76718cb5b541b',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-hoist-story-annotations/variable.input.js',
            hash: '2987fde2180edacb58476353c7470218da6d3321',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-hoist-story-annotations/variable.output.snapshot',
            hash: 'bdac64d15652fa8cb5b155929fcb13d154facc08',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/basic.input.js',
            hash: 'd35dd99ac6011db1c350f5d3cd50dc2f126f09e1',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/basic.output.snapshot',
            hash: 'ca833e112ac2f097bc2cf2278b2f801c596b37ca',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/component-id.input.js',
            hash: '7ae369e4101afd2aac2e5d8143306226b7dfbce1',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/component-id.output.snapshot',
            hash: 'fe3e85fb76b3a010f625e96dae407a0e6f63a83b',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/decorators.input.js',
            hash: '50d11fde87e63d88fc70fe927896562385d948cc',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/decorators.output.snapshot',
            hash: 'fde0c3de9d629f760f08952ae648933d4f17d862',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/exclude-stories.input.js',
            hash: '32f84f07054f2ac726722463026fe5ad46b5cbdb',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/exclude-stories.output.snapshot',
            hash: 'd5f889768bc323fb9914d36646c73fc7b0af6b67',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/parameters.input.js',
            hash: 'af5840e218a5a6b8ebf6101884136fc5602b34fa',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/parameters.output.snapshot',
            hash: '84f049d2cadb46af2863cf5746a6431d762bb02e',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/story-function.input.js',
            hash: 'a54471fbedb2a402dc8fc0de4e289fce99b73465',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/story-function.output.snapshot',
            hash: 'd12ec28e2ec455ab853a5249c3c2119b0b2a8826',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/story-parameters.input.js',
            hash: '4aceae77d1f18400237ab6349f0c5f5863766243',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/csf-to-mdx/story-parameters.output.snapshot',
            hash: '42810578a2062526fab3788bec84900c7f17ede5',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/basic.input.js',
            hash: 'fc45a6e58507bd52349179370d01103837d1153c',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/basic.output.snapshot',
            hash: '8f502e342d3009098a7c74b8987716027306905f',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/component-id.input.js',
            hash: 'b1c3d54da53164699b08d9d67695f48121274ec2',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/component-id.output.snapshot',
            hash: '98125c844db5d5a19ed3554b35c78e6987d48027',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/decorators.input.js',
            hash: '2c9bc768f8f44bcc7ad6f6d9b3fe260c04404628',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/decorators.output.snapshot',
            hash: '89c3d77617e211ed75ef8e5cee1225b9c7e004d6',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/exclude-stories.input.js',
            hash: '0c8ca0c6513beab188d00849191e55cdc0709cf2',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/exclude-stories.output.snapshot',
            hash: 'b5e3f960cb748e1ebd724079474e4f5c81a0e216',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/parameters.input.js',
            hash: 'bba94e8ede9adcfdd75e168c2644393481c5e623',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/parameters.output.snapshot',
            hash: '95b9c8814b2b901a2add5e83df05109dddf0168c',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/plaintext.input.js',
            hash: '0808a95fa532cb3e99703d53965a1a107958b047',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/plaintext.output.snapshot',
            hash: '58ad1ca96af812f9e0095b928a388a41d603d3e4',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/story-function.input.js',
            hash: '50756bdb2f1c70c56da8e1f81057bd0ea5fdda77',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/story-function.output.snapshot',
            hash: '41997d5facc89f74a8da91c2be551e6d328ee960',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/story-parameters.input.js',
            hash: '43e834a8f6f47f1c1d554678cf4c81855f3a72c3',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/story-parameters.output.snapshot',
            hash: 'b4e1f5c2e1912f3fc8b8fc54d3f8304b245edad6',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/story-refs.input.js',
            hash: 'b9bd1b771d2b7360c7a965d8cb2619023adb9f28',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/mdx-to-csf/story-refs.output.snapshot',
            hash: '230199df8b2fd7286685f08a3b755d1649749e0c',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/move-builtin-addons/default.input.js',
            hash: '8152a70ddd94b36f29d5eb13fd427a2835135a66',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/move-builtin-addons/default.output.snapshot',
            hash: '37a0805dcd1a4110c950d3584d385900c1f89c03',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/move-builtin-addons/with-no-change.input.js',
            hash: 'edc6a6d2e289a0c4c25157bd9e95bcea933fe5aa',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/move-builtin-addons/with-no-change.output.snapshot',
            hash: '3966fe70fb0db7bd86606396c824bf5a38b6257e',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/basic.input.js',
            hash: '17c8f6abc1a17bb0bb65ae746f3de6c801ebc90a',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/basic.output.snapshot',
            hash: '6b26bc2380447d8b3329c684a2edeb5c39c43c20',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/collision.input.js',
            hash: 'fc9108a22d292e7b6de2fb7e5e8eb774d4b5233b',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/collision.output.snapshot',
            hash: '1cde3dcf27ff7d7e58c6dce473c2224c7f17064c',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/const.input.js',
            hash: 'a3083631514163581d996dcbdbc700bbc339cabe',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/const.output.snapshot',
            hash: '3afdb3c66d2f913e652b6d0482680ce3938da140',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/decorators.input.js',
            hash: '900c47c9c05b14e25d237f8505c9e4c323258162',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/decorators.output.snapshot',
            hash: '5ef412be865d9077dd7e5f33334e7f7b83033609',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/default.input.js',
            hash: 'd242ed9a688c53034c723fba487dd722f0877187',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/default.output.snapshot',
            hash: '56f1d0ba1217d5ab5ac5fc95171166184fb462dc',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/digit.input.js',
            hash: '9931f13df1f928c47854aad06756f80bbbddd772',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/digit.output.js',
            hash: '0dfb48fb260d4fadd687296d1fb457ff578a15d7',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/digit.output.snapshot',
            hash: '258a578f683202ac8848c5931708cb4931ca25f4',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/export-destructuring.input.js',
            hash: '1c4f5faa706ea3c000f225a1e81546e17786b799',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/export-destructuring.output.snapshot',
            hash: '5225069c4651fea6c497b5fa7e34f49585da533f',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/export-function.input.js',
            hash: '94149593ab9196573f45e6c7ff570eb8be8f11ad',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/export-function.output.snapshot',
            hash: '49096c22ffd3f68a6bfe7698eba5659abe7548f9',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/export-names.input.js',
            hash: 'c87d8695b8ee2d2eb1cfdb2e668854f5c24be3c5',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/export-names.output.snapshot',
            hash: '95ddc5056ced6836e0f297b2308f4d76dc829d2d',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/exports.input.js',
            hash: '6096c9e0ae6ecb57569336c254e84fe43efe1bdc',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/exports.output.snapshot',
            hash: 'eb0839d895bae934ca7ed7ccb38cbc73482c6503',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/module.input.js',
            hash: '5cc7ce8ab842cc13582f0a2486a0e11a76c53dc4',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/module.output.snapshot',
            hash: '94a2afbacb31cbeebd7ed29449042f84b5ff2151',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/multi.input.js',
            hash: '59a06b7cd1655398d07e96c28902c04188cd08c8',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/multi.output.snapshot',
            hash: '670e9a1784cf4b3891f76b5e80458bdb3af73d5c',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/parameters-as-var.input.js',
            hash: '6d8dcc4970321604b0a7b076cc4baeccd5c76c92',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/parameters-as-var.output.snapshot',
            hash: 'b0489d3c5f3d316c5ebaa833abdc69b03458e51b',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/parameters.input.js',
            hash: '07499987fc6702a4a73b772d72240af4270e43c8',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/parameters.output.snapshot',
            hash: '8ee0083b9d1ff51bb8704f6d6b4ded5c4b26f0ba',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/storiesof-var.input.js',
            hash: '3a66045ea7b98108ac3ad6218e84ef7d95de25e7',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/storiesof-var.output.snapshot',
            hash: '4c0889c9137a779cc1000129e560c7077a5fa379',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/story-decorators.input.js',
            hash: '7468df8d9e6cfcb2e6fef1b122ccb2e97318f94f',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/story-decorators.output.snapshot',
            hash: '235b5d50e9b1b9ba6ff426b37e25be143a08d81a',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/story-parameters.input.js',
            hash: '75db6673cc1ac48aa71f2a2c2fd3559c588c55a4',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/storiesof-to-csf/story-parameters.output.snapshot',
            hash: '43d24f405ce0b8978f2e8c2f411299ae63a6f5a0',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/update-addon-info/update-addon-info.input.js',
            hash: 'ee8a6806601da0215ac078d6f166964efae70722',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/update-addon-info/update-addon-info.output.snapshot',
            hash: 'd74f4053f20efd259f30ce1f842500f5719e33c6',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/update-organisation-name/update-organisation-name.input.js',
            hash: '9b16ff958663a2395b05df93c847165cb0ed5b16',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/update-organisation-name/update-organisation-name.output.snapshot',
            hash: '9b6c6005344205550422b8542d5f06a324f6b17d',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/upgrade-hierarchy-separators/csf.input.js',
            hash: '91b0f7101d9e26f04c1f3064b5f6ec9013821aa3',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/upgrade-hierarchy-separators/csf.output.snapshot',
            hash: 'fab15740805f45b0a8bf50f3bc53c43cbc3753d9',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/upgrade-hierarchy-separators/dynamic-storiesof.input.js',
            hash: 'a861d30bf8033c65dafc490b484e430e160b2124',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/upgrade-hierarchy-separators/dynamic-storiesof.output.snapshot',
            hash: '9b3e37c379c373cc7b1727c6fafaf4e57607467f',
            ext: '.snapshot',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/upgrade-hierarchy-separators/storiesof.input.js',
            hash: 'bdf1b2ef2579375438022c9e522586a7f1829bc3',
            ext: '.js',
          },
          {
            file:
              'lib/codemod/src/transforms/__testfixtures__/upgrade-hierarchy-separators/storiesof.output.snapshot',
            hash: 'fef6c52a615af01eca5c907257f0c0d5b181f50a',
            ext: '.snapshot',
          },
          {
            file: 'lib/codemod/src/transforms/__tests__/transforms.tests.js',
            hash: 'c17cd12f762c94e7ccdd3dec453e5f6088002c4f',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/transforms/add-component-parameters.js',
            hash: 'a0eebc933a36ae1958908ac6487d29ee4638fbef',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/transforms/csf-hoist-story-annotations.js',
            hash: '340eeb3d016154fcce0001eb7decc992d33825f2',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/transforms/csf-to-mdx.js',
            hash: '533effb843b3f8d4ba0c89e63bfd2c20eada6672',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/transforms/mdx-to-csf.js',
            hash: '53dc8284260a5ef0092bebd15cf113a15a1256a3',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/transforms/move-builtin-addons.js',
            hash: '3612f07405a76b1fc3c6c11d076b2d1dce3eab1c',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/transforms/storiesof-to-csf.js',
            hash: 'a1a78aa489bc5eb8ae7b64e267effb862f026650',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/transforms/update-addon-info.js',
            hash: '443c562e6e9ef060ec86bc6d4b4eff09d67e1bae',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/transforms/update-organisation-name.js',
            hash: '699f62fb511cba34b190f0d51e718d9c24ef9f27',
            ext: '.js',
          },
          {
            file: 'lib/codemod/src/transforms/upgrade-hierarchy-separators.js',
            hash: '9b6ea87454a4f9b87811a4973ec179ee72cda44f',
            ext: '.js',
          },
        ],
      },
    },
    '@storybook/theming': {
      name: '@storybook/theming',
      type: 'lib',
      data: {
        root: 'lib/theming',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/theming/create.js',
            hash: '69e29d7f01b33e2f3b66ec7b9097ec2b40a2b5cd',
            ext: '.js',
          },
          {
            file: 'lib/theming/package.json',
            hash: '57833c7c397cb756f9235dacb73b2fe7efb4925b',
            ext: '.json',
          },
          {
            file: 'lib/theming/paths.js',
            hash: 'b356b4ae3235a87612a9397099343ec3a66ce77c',
            ext: '.js',
          },
          {
            file: 'lib/theming/README.md',
            hash: 'a91c357921d8848f60aa88d9ca81f54e754ee579',
            ext: '.md',
          },
          {
            file: 'lib/theming/src/animation.ts',
            hash: 'c92be3f7cc97831f36c43a2f6811e880e429a976',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/base.ts',
            hash: '7414922d9380431f66a9407b3a1ce6e49ebfb313',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/convert.ts',
            hash: 'c35030a6ae1dcf164c859b661534376c25aa060e',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/create.ts',
            hash: '48ca51df8f6825513c59474f6ddde3753d84b768',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/ensure.ts',
            hash: '586852e106ca5e2e2f481215d077bdd84aa99c71',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/global.ts',
            hash: '0afd3df63503b6fb5981f79d2f1e215cbbf27391',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/index.ts',
            hash: '86d514f19ad75865fc7f5844e2b96ed532a6d02e',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/modules/syntax.ts',
            hash: 'a33a073d20608a5f02f136dda20213acef25a294',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/tests/convert.test.js',
            hash: '98a4458cb1f4eacf4126af552d671084f9a71cda',
            ext: '.js',
          },
          {
            file: 'lib/theming/src/tests/create.test.js',
            hash: '4cdc2471cceb2aa6443ffda27df77ddef6748b1e',
            ext: '.js',
          },
          {
            file: 'lib/theming/src/tests/util.test.js',
            hash: 'eb65701bf9ec2f25516d04d3390201fb66ce43c4',
            ext: '.js',
          },
          {
            file: 'lib/theming/src/themes/dark.ts',
            hash: '795307eadc499358522265dd0a796a6210ab0464',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/themes/light.ts',
            hash: '49312e5e62bc855e591a8cb8a776a02f12045aff',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/types.ts',
            hash: '2ef1afa66080164109d8470b470af4b704531fa6',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/typings.d.ts',
            hash: 'ab568e12c7ace46e09f4ba276df1605b27872e23',
            ext: '.ts',
          },
          {
            file: 'lib/theming/src/utils.ts',
            hash: '91732a179015958bce62672d165d75258702c2cf',
            ext: '.ts',
          },
          {
            file: 'lib/theming/tsconfig.json',
            hash: 'a0d826f8fcf6ba21be45847c24e8f90b51139139',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/preact': {
      name: '@storybook/preact',
      type: 'lib',
      data: {
        root: 'app/preact',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/preact/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/preact/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/preact/package.json',
            hash: 'a8dbeb8786a048686d37ea8f1fc8c261eb441452',
            ext: '.json',
          },
          {
            file: 'app/preact/README.md',
            hash: '601a07a3fb545341609ad146a33107990b2abb2c',
            ext: '.md',
          },
          {
            file: 'app/preact/src/client/index.ts',
            hash: 'c679ef3a56709f65caf0391d0eda8f47a1df1017',
            ext: '.ts',
          },
          {
            file: 'app/preact/src/client/preview/globals.ts',
            hash: '84c1c3c12844df4a9ab6557a58fd63cda7320f09',
            ext: '.ts',
          },
          {
            file: 'app/preact/src/client/preview/index.ts',
            hash: '5b538fb5a8e1fea42cda994aa6f782c8e6292aa8',
            ext: '.ts',
          },
          {
            file: 'app/preact/src/client/preview/render.tsx',
            hash: 'cf4f855c1afc27eac27651421748007396ed089e',
            ext: '.tsx',
          },
          {
            file: 'app/preact/src/client/preview/types-6-0.ts',
            hash: 'efb4bc395a08c6b92655e8381b8fb598c5db9e9e',
            ext: '.ts',
          },
          {
            file: 'app/preact/src/client/preview/types.ts',
            hash: '8c18535594d0674681c90e5e18e60afef661f30b',
            ext: '.ts',
          },
          {
            file: 'app/preact/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/preact/src/server/framework-preset-preact.ts',
            hash: 'b3eaabddeffc9ace98a6130f095f42b109a198eb',
            ext: '.ts',
          },
          {
            file: 'app/preact/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/preact/src/server/options.ts',
            hash: '6132aceaae332168010fd76a6abb4bc17c702ad9',
            ext: '.ts',
          },
          {
            file: 'app/preact/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'app/preact/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/preact/tsconfig.json',
            hash: '08bdb7764f7628be93224ed1b28b56c35990e5e0',
            ext: '.json',
          },
          {
            file: 'app/preact/types-6-0.d.ts',
            hash: 'b5946b39a8d8e20d1c13962a519c1aeae6a25c94',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/server': {
      name: '@storybook/server',
      type: 'lib',
      data: {
        root: 'app/server',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/server/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/server/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/server/package.json',
            hash: '3485b84cdee17129b888a606882e4ee0f229d8d9',
            ext: '.json',
          },
          {
            file: 'app/server/README.md',
            hash: 'ea0285b5de7c49c1aa1929126cd3f7cf2a7a952c',
            ext: '.md',
          },
          {
            file: 'app/server/src/client/index.ts',
            hash: '8034a9d6433dd177a2f3a97a3e6c3c4c3cfb469b',
            ext: '.ts',
          },
          {
            file: 'app/server/src/client/preview/globals.ts',
            hash: '90dca4aa37508a20f1f3a02837413e4111704d6c',
            ext: '.ts',
          },
          {
            file: 'app/server/src/client/preview/index.ts',
            hash: '9c8154de92fcbdce6a1aae53bdccd690f3ccacaf',
            ext: '.ts',
          },
          {
            file: 'app/server/src/client/preview/render.ts',
            hash: 'b3a38490ae75fcd1104e6417806f4a4d8bbeda97',
            ext: '.ts',
          },
          {
            file: 'app/server/src/client/preview/types.ts',
            hash: '7d371f2d7fe075e01ef88e98aeca1d839cd408ba',
            ext: '.ts',
          },
          {
            file: 'app/server/src/lib/compiler/__testfixtures__/a11y.json',
            hash: 'c4496e6ab403277fface8ba737a1c4ebc2a0a89d',
            ext: '.json',
          },
          {
            file: 'app/server/src/lib/compiler/__testfixtures__/a11y.snapshot',
            hash: '07c3e8a03cb194d51c6fa4349bd17c4cb218bb7c',
            ext: '.snapshot',
          },
          {
            file: 'app/server/src/lib/compiler/__testfixtures__/actions.json',
            hash: 'ac94c3527d1fdc13d4965060fff5057d1e33be8f',
            ext: '.json',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/actions.snapshot',
            hash: 'f6631a09b3306b6b3163913fcae07bd87fcc817a',
            ext: '.snapshot',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/backgrounds.json',
            hash: '4c91c4f4c51ce2c15c0b4dfc5ebbca8651083ad7',
            ext: '.json',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/backgrounds.snapshot',
            hash: '93da5a33dd0c78e23f0315547e4539a4d224c880',
            ext: '.snapshot',
          },
          {
            file: 'app/server/src/lib/compiler/__testfixtures__/controls.json',
            hash: '88a04ee3445edc2679130391df18488a9987aad3',
            ext: '.json',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/controls.snapshot',
            hash: '1f5432ddda800c1d1afe26e15816ccabdb4deaea',
            ext: '.snapshot',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/kitchen_sink.json',
            hash: 'c7e719c6f11dce2c1ca844efec7c13a141e567b9',
            ext: '.json',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/kitchen_sink.snapshot',
            hash: 'ccf29b3f4400e6e183b734a723506949d0b1e060',
            ext: '.snapshot',
          },
          {
            file: 'app/server/src/lib/compiler/__testfixtures__/links.json',
            hash: 'ee192f0bec8164a923e644c8ab2a41ddaa8c480a',
            ext: '.json',
          },
          {
            file: 'app/server/src/lib/compiler/__testfixtures__/links.snapshot',
            hash: '6ad29b4fbc496023f1f217f857af712462644a6f',
            ext: '.snapshot',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/multiple_stories.json',
            hash: '207332142d298582daa555cf66d35a0a9f00aaed',
            ext: '.json',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/multiple_stories.snapshot',
            hash: 'ff2cb558fb578939fa92d4f419d59f6745c9faa3',
            ext: '.snapshot',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/params_override.json',
            hash: '717be13a4ad3c3c853491177bee54a933a64812b',
            ext: '.json',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/params_override.snapshot',
            hash: '81f7ea258089f792c701094150d7af04ec68c7d8',
            ext: '.snapshot',
          },
          {
            file: 'app/server/src/lib/compiler/__testfixtures__/params.json',
            hash: '60f6b720cf42eeb13fe87191946026a5d39f7566',
            ext: '.json',
          },
          {
            file:
              'app/server/src/lib/compiler/__testfixtures__/params.snapshot',
            hash: '5d6fb7dc3900ae936c20c731772fc1eba5a9e4ad',
            ext: '.snapshot',
          },
          {
            file: 'app/server/src/lib/compiler/index.ts',
            hash: 'c2afad7b8b8066a1c5abf95c45d454712492164f',
            ext: '.ts',
          },
          {
            file: 'app/server/src/lib/compiler/json-to-csf-compiler.test.ts',
            hash: 'a99dcc45a906f6358fa369ce7ca603d50827f21b',
            ext: '.ts',
          },
          {
            file: 'app/server/src/lib/compiler/stringifier.ts',
            hash: '5b4ada166b209017241652bb7d91ab7193861776',
            ext: '.ts',
          },
          {
            file: 'app/server/src/lib/compiler/types.ts',
            hash: '7b08af446bc86416352f140c9cb12625843cbbbc',
            ext: '.ts',
          },
          {
            file: 'app/server/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/server/src/server/framework-preset-server.ts',
            hash: 'e8bc1b379db4866e8fdda6ab6a71f5e8694d9f78',
            ext: '.ts',
          },
          {
            file: 'app/server/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/server/src/server/loader.ts',
            hash: '67b8aab46e0c5128a8ff4a7b0afac8ab73b9b741',
            ext: '.ts',
          },
          {
            file: 'app/server/src/server/options.ts',
            hash: 'ba3f398a38509622b6e48067d60f54a86a6d0f07',
            ext: '.ts',
          },
          {
            file: 'app/server/src/typings.d.ts',
            hash: 'd8f7c6f660ad7acc11040fd6d2e70cb5dde4dccb',
            ext: '.ts',
          },
          {
            file: 'app/server/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/server/tsconfig.json',
            hash: '13f32ad6309564ac1f4d8d0877732916ec10bdfe',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/svelte': {
      name: '@storybook/svelte',
      type: 'lib',
      data: {
        root: 'app/svelte',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/svelte/bin/build.js',
            hash: '8b8db43a6638529a7409a1fda80c9d21054d7401',
            ext: '.js',
          },
          {
            file: 'app/svelte/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/svelte/package.json',
            hash: '1d99a6ce266448bf25d0d50828451f515b5abd45',
            ext: '.json',
          },
          {
            file: 'app/svelte/README.md',
            hash: 'f77c0356f43b4c5d073ddba964362c60e82d2cfd',
            ext: '.md',
          },
          {
            file: 'app/svelte/src/client/index.ts',
            hash: '8034a9d6433dd177a2f3a97a3e6c3c4c3cfb469b',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/client/preview/decorators.ts',
            hash: '1f9af116602e418445baababd78e95b9cf42531a',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/client/preview/globals.ts',
            hash: 'ebd3e02224ccdfacc9d8ce2f0add19c8f2de77ea',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/client/preview/index.ts',
            hash: 'cbfed51c166912b60748281d0a0687366f5c85ac',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/client/preview/PreviewRender.svelte',
            hash: '40c027d6c80391f764983271d8b451ee6eb3bbe0',
            ext: '.svelte',
          },
          {
            file: 'app/svelte/src/client/preview/render.ts',
            hash: 'ba072e1400a6a054eca60c50e4beb453c5cd9dc1',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/client/preview/SlotDecorator.svelte',
            hash: 'bd51e06f4271ee785fa19c0415d6ae88815b2a07',
            ext: '.svelte',
          },
          {
            file: 'app/svelte/src/client/preview/types.ts',
            hash: '0299eb23f8e3e26dd37c0736b14dcc12a7ebcd69',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/server/framework-preset-svelte.ts',
            hash: '5bfcee4cf031ef45481e9206ac891118afc631df',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/server/options.ts',
            hash: 'ee8c399d9af31b0ba7ba3f48f31aba54f1739e55',
            ext: '.ts',
          },
          {
            file: 'app/svelte/src/typings.d.ts',
            hash: '19424af371e63373538e1ba885ac4a316b7a9fa2',
            ext: '.ts',
          },
          {
            file: 'app/svelte/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/svelte/tsconfig.json',
            hash: '08bdb7764f7628be93224ed1b28b56c35990e5e0',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/addons': {
      name: '@storybook/addons',
      type: 'lib',
      data: {
        root: 'lib/addons',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/addons/package.json',
            hash: '89dfea4e4d8e4cf4ba79c683ed0d5104ec8dbd98',
            ext: '.json',
          },
          {
            file: 'lib/addons/README.md',
            hash: '5a1127469c98d680200e6f558ac5cbc0aa103108',
            ext: '.md',
          },
          {
            file: 'lib/addons/src/hooks.ts',
            hash: '323da133e50a9ffb39237bb40207f37eb3e44586',
            ext: '.ts',
          },
          {
            file: 'lib/addons/src/index.ts',
            hash: 'c3729163fed46cd41f1276599ff0118531f92f21',
            ext: '.ts',
          },
          {
            file: 'lib/addons/src/make-decorator.test.ts',
            hash: 'e1fe7a7b00638084e6cdb7b9c0575951164102b1',
            ext: '.ts',
          },
          {
            file: 'lib/addons/src/make-decorator.ts',
            hash: '9868a3b57da111a895f418e6f41130f409ca2949',
            ext: '.ts',
          },
          {
            file: 'lib/addons/src/public_api.ts',
            hash: '7639be2ff7b8548c9457bcacaf6dac4c96cb5548',
            ext: '.ts',
          },
          {
            file: 'lib/addons/src/storybook-channel-mock.ts',
            hash: '7d43f7b025c0c0f2d5dfde4afcf7c0266f2a2f63',
            ext: '.ts',
          },
          {
            file: 'lib/addons/src/types.ts',
            hash: '445e8b5731c47499716945f54b1b199160920421',
            ext: '.ts',
          },
          {
            file: 'lib/addons/src/typings.d.ts',
            hash: 'afbc638db2fa862962fbcd6c8f3a7793ae958b92',
            ext: '.ts',
          },
          {
            file: 'lib/addons/tsconfig.json',
            hash: 'd1ee4fc75941ea63fc45ba234dca37d9882e1620',
            ext: '.json',
          },
        ],
      },
    },
    sb: {
      name: 'sb',
      type: 'lib',
      data: {
        root: 'lib/cli-sb',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/cli-sb/index.js',
            hash: '457ff863bb477e7808ff1f5981b3cfafe34548bb',
            ext: '.js',
          },
          {
            file: 'lib/cli-sb/package.json',
            hash: 'cdb9ce916da9986fa13bf9feff8853fb0849a512',
            ext: '.json',
          },
          {
            file: 'lib/cli-sb/README.md',
            hash: 'f31715566811d43821bbbec5620c847e5d937215',
            ext: '.md',
          },
        ],
      },
    },
    '@storybook/router': {
      name: '@storybook/router',
      type: 'lib',
      data: {
        root: 'lib/router',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/router/package.json',
            hash: '188c500b050bfafa9b1067442ef836c116675d6c',
            ext: '.json',
          },
          {
            file: 'lib/router/README.md',
            hash: 'e356bd469fe79bbffb2ba6a4cc79f629ab40f7ba',
            ext: '.md',
          },
          {
            file: 'lib/router/src/index.ts',
            hash: '891ee962040754ba5da0e5e6ed616a6fd972f466',
            ext: '.ts',
          },
          {
            file: 'lib/router/src/router.tsx',
            hash: 'fa9856073407b7d310e0355251ae47f4bd97d193',
            ext: '.tsx',
          },
          {
            file: 'lib/router/src/typings.d.ts',
            hash: '75b3c91658af0e5f19ce54f4fdf4e4870af160e0',
            ext: '.ts',
          },
          {
            file: 'lib/router/src/utils.test.ts',
            hash: 'e7ae39173ade91ea4d4ae912244600506956ced0',
            ext: '.ts',
          },
          {
            file: 'lib/router/src/utils.ts',
            hash: '20743e00e3a40ca7162bf30874884023204a58ec',
            ext: '.ts',
          },
          {
            file: 'lib/router/src/visibility.tsx',
            hash: '2b26cda279ba8a797905832d637092f1c9230e93',
            ext: '.tsx',
          },
          {
            file: 'lib/router/tsconfig.json',
            hash: 'a0d826f8fcf6ba21be45847c24e8f90b51139139',
            ext: '.json',
          },
          {
            file: 'lib/router/utils.d.ts',
            hash: '1d9ab0d53513666eef58ac742491042ea651f090',
            ext: '.ts',
          },
          {
            file: 'lib/router/utils.js',
            hash: '3120589b76e667e865f4ed3725f34592c9117da6',
            ext: '.js',
          },
        ],
      },
    },
    '@storybook/ember': {
      name: '@storybook/ember',
      type: 'lib',
      data: {
        root: 'app/ember',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/ember/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/ember/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/ember/package.json',
            hash: 'd4e8173b50c20f08461650a35bba1d4b5ee81fcb',
            ext: '.json',
          },
          {
            file: 'app/ember/README.md',
            hash: '635ead2f560ac05aafcefc8bc12e70455a14302f',
            ext: '.md',
          },
          {
            file: 'app/ember/src/client/index.ts',
            hash: '8034a9d6433dd177a2f3a97a3e6c3c4c3cfb469b',
            ext: '.ts',
          },
          {
            file: 'app/ember/src/client/preview/globals.ts',
            hash: '6223f56bc68e03bdda03e80572eade945ebaf2bd',
            ext: '.ts',
          },
          {
            file: 'app/ember/src/client/preview/index.ts',
            hash: '6eb84bc6140ebd5bf3745d38e36ad53202ae17a5',
            ext: '.ts',
          },
          {
            file: 'app/ember/src/client/preview/render.ts',
            hash: 'cc86ccb25fe92f15b27d921112420c0db5b244fd',
            ext: '.ts',
          },
          {
            file: 'app/ember/src/client/preview/types.ts',
            hash: 'bd3025bb11472f29384cc3880cbeda25fb09d324',
            ext: '.ts',
          },
          {
            file: 'app/ember/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/ember/src/server/framework-preset-babel-ember.ts',
            hash: 'ae9143bfdc829303263871d6f7abc1f40b08d0a4',
            ext: '.ts',
          },
          {
            file: 'app/ember/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/ember/src/server/options.ts',
            hash: 'f6656af3802e26bfd611338878f89a4ffae90db8',
            ext: '.ts',
          },
          {
            file: 'app/ember/src/typings.d.ts',
            hash: 'e05c56b846e375fcfb772719b14bed187a821a07',
            ext: '.ts',
          },
          {
            file: 'app/ember/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/ember/tsconfig.json',
            hash: 'bdf2e98ebb1e6710a99241816469c566dab97b3a',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/marko': {
      name: '@storybook/marko',
      type: 'lib',
      data: {
        root: 'app/marko',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/marko/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/marko/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/marko/package.json',
            hash: 'da3528942cf6fd97799243bfcc0b155a281a8c37',
            ext: '.json',
          },
          {
            file: 'app/marko/README.md',
            hash: '9e6f6a30afdc1bf638f26b54b5390877843c461f',
            ext: '.md',
          },
          {
            file: 'app/marko/src/client/index.ts',
            hash: '8034a9d6433dd177a2f3a97a3e6c3c4c3cfb469b',
            ext: '.ts',
          },
          {
            file: 'app/marko/src/client/preview/globals.ts',
            hash: 'cebca46f5f2891eb4a77efbaf70533baf3f7b665',
            ext: '.ts',
          },
          {
            file: 'app/marko/src/client/preview/index.ts',
            hash: '9be8c7fd599ee5dfa452b3144bdb38daa55b530e',
            ext: '.ts',
          },
          {
            file: 'app/marko/src/client/preview/render.ts',
            hash: '681e20fcc4f820cec1882dff7c489edcd9ebaffd',
            ext: '.ts',
          },
          {
            file: 'app/marko/src/demo/Button.marko',
            hash: 'adb4203f83b92ec2e69788b4c754f76127674837',
            ext: '.marko',
          },
          {
            file: 'app/marko/src/demo/Welcome.marko',
            hash: '4580889dd3b4e872619c007702ba0b9deb4a349d',
            ext: '.marko',
          },
          {
            file: 'app/marko/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/marko/src/server/framework-preset-marko.ts',
            hash: '3595ec316ff447b4e6062d804c960c37d4d0c8c0',
            ext: '.ts',
          },
          {
            file: 'app/marko/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/marko/src/server/options.ts',
            hash: '08cd2a3f7e127b33c5d91e656e19d97e436471fb',
            ext: '.ts',
          },
          {
            file: 'app/marko/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'app/marko/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/marko/tsconfig.json',
            hash: '08bdb7764f7628be93224ed1b28b56c35990e5e0',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/react': {
      name: '@storybook/react',
      type: 'lib',
      data: {
        root: 'app/react',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/react/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/react/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/react/demo.d.ts',
            hash: '3d530b3b4005046f203f51676e0bd2a6139df4e8',
            ext: '.ts',
          },
          {
            file: 'app/react/demo.js',
            hash: 'c970745f43f657db41107b728c590ac18ca01bcf',
            ext: '.js',
          },
          {
            file: 'app/react/package.json',
            hash: '4a16a7a38225840a93bd80e06323b0b6e6f691b1',
            ext: '.json',
          },
          {
            file: 'app/react/README.md',
            hash: '0a8e9e74e00b2b8c3565b40d59df2614d97ed00f',
            ext: '.md',
          },
          {
            file: 'app/react/src/client/index.ts',
            hash: '8f2cf30cc6465e93971bab7dec680fdfaed61802',
            ext: '.ts',
          },
          {
            file: 'app/react/src/client/preview/globals.ts',
            hash: '2e6e560945afc85a0110e9b8f4c576b60a3a7748',
            ext: '.ts',
          },
          {
            file: 'app/react/src/client/preview/index.test.ts',
            hash: '6bd053669e7ee269f6770d45fc2a9f5eb802f843',
            ext: '.ts',
          },
          {
            file: 'app/react/src/client/preview/index.ts',
            hash: '42dfdf3564b073aa12ace0254cf8e8235e1acc93',
            ext: '.ts',
          },
          {
            file: 'app/react/src/client/preview/render.tsx',
            hash: 'd2f5e5a05acdc9652f857788c47f17442f1a3206',
            ext: '.tsx',
          },
          {
            file: 'app/react/src/client/preview/types-6-0.ts',
            hash: '4a81e829f0c23c13afa314a2e0e4375093bcf2df',
            ext: '.ts',
          },
          {
            file: 'app/react/src/client/preview/types.ts',
            hash: '615d0cf31ec2cbab3f45c3efa95362459f1bd2e1',
            ext: '.ts',
          },
          {
            file: 'app/react/src/demo/Button.tsx',
            hash: '6a203f4f01037067fc7d0f345c52cd1f7e11f5b4',
            ext: '.tsx',
          },
          {
            file: 'app/react/src/demo/Welcome.tsx',
            hash: '2d5d35e5000a2db6bc52f8aeb8d999ade5e75204',
            ext: '.tsx',
          },
          {
            file: 'app/react/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/react/src/server/cra-config.test.ts',
            hash: 'c6b1a57c30ea2e71d48b8b192df76c41b84d311d',
            ext: '.ts',
          },
          {
            file: 'app/react/src/server/cra-config.ts',
            hash: 'ab6815c42382c2312824b2ddcd0bf949885107d0',
            ext: '.ts',
          },
          {
            file: 'app/react/src/server/framework-preset-cra.ts',
            hash: '3858f2c0c6bbf65c8f8831a0caeb9b0843527d3b',
            ext: '.ts',
          },
          {
            file: 'app/react/src/server/framework-preset-react-docgen.test.ts',
            hash: '5248be49d6dac68ce35d627bb614abbac5ac8551',
            ext: '.ts',
          },
          {
            file: 'app/react/src/server/framework-preset-react-docgen.ts',
            hash: '185c1d7aa818bd040ae45bf0cf55a93a0bcf2bba',
            ext: '.ts',
          },
          {
            file: 'app/react/src/server/framework-preset-react.test.ts',
            hash: '0d597542aa60fdda0747100a67ef0168eab60ea9',
            ext: '.ts',
          },
          {
            file: 'app/react/src/server/framework-preset-react.ts',
            hash: '2e8b75682e4b7be209399192f6172a44d5ef59b2',
            ext: '.ts',
          },
          {
            file: 'app/react/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/react/src/server/options.ts',
            hash: 'e968d7915cd501b9a9149d56875de7cbb308f412',
            ext: '.ts',
          },
          {
            file: 'app/react/src/typings.d.ts',
            hash: '26c2a8b586bfb51c5f15a88e66174ae2c2b4ce6d',
            ext: '.ts',
          },
          {
            file: 'app/react/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/react/tsconfig.json',
            hash: '08bdb7764f7628be93224ed1b28b56c35990e5e0',
            ext: '.json',
          },
          {
            file: 'app/react/types-6-0.d.ts',
            hash: 'b5946b39a8d8e20d1c13962a519c1aeae6a25c94',
            ext: '.ts',
          },
          {
            file: 'app/react/types/index.ts',
            hash: '3e1ddcf152730576643666a4fb0e5ffa1e5b9c39',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/html': {
      name: '@storybook/html',
      type: 'lib',
      data: {
        root: 'app/html',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/html/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/html/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/html/package.json',
            hash: '5fd3c9695fd1993aebbf24ce2abfebd8ebcf7cf7',
            ext: '.json',
          },
          {
            file: 'app/html/README.md',
            hash: '8c3880dbfc6a4a460a753c722ae4f6850c98e5fd',
            ext: '.md',
          },
          {
            file: 'app/html/src/client/index.ts',
            hash: '620f2fae5cd038829e555775705f75a14be35d7b',
            ext: '.ts',
          },
          {
            file: 'app/html/src/client/preview/globals.ts',
            hash: 'cefd80775e0a2bbd905cbefa7dd07fe171c50604',
            ext: '.ts',
          },
          {
            file: 'app/html/src/client/preview/index.ts',
            hash: '0f4f4020bc101f552537736b9b1b29cefd952b19',
            ext: '.ts',
          },
          {
            file: 'app/html/src/client/preview/render.ts',
            hash: '28aa86ad927c2d928b5b7884da5b909d439c0553',
            ext: '.ts',
          },
          {
            file: 'app/html/src/client/preview/types-6-0.ts',
            hash: '63dd6fbfed8f539340a59fc59e351df893b32f56',
            ext: '.ts',
          },
          {
            file: 'app/html/src/client/preview/types.ts',
            hash: '6de091931ba3c07ab9dae9fdf3d62285c401b63b',
            ext: '.ts',
          },
          {
            file: 'app/html/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/html/src/server/framework-preset-html.ts',
            hash: 'f3273c51f1b4c2f3de7d356911902a988f05b5ac',
            ext: '.ts',
          },
          {
            file: 'app/html/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/html/src/server/options.ts',
            hash: '306658e949e73997714adaeaba7754ce60ecb990',
            ext: '.ts',
          },
          {
            file: 'app/html/src/typings.d.ts',
            hash: 'd8f7c6f660ad7acc11040fd6d2e70cb5dde4dccb',
            ext: '.ts',
          },
          {
            file: 'app/html/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/html/tsconfig.json',
            hash: '13f32ad6309564ac1f4d8d0877732916ec10bdfe',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/riot': {
      name: '@storybook/riot',
      type: 'lib',
      data: {
        root: 'app/riot',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/riot/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/riot/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/riot/package.json',
            hash: '4250bd58e23f4ba2b37989eed24782d936dcf721',
            ext: '.json',
          },
          {
            file: 'app/riot/README.md',
            hash: '3dbc9197222d23a5a0bb8ff95b4077f006e5a44c',
            ext: '.md',
          },
          {
            file: 'app/riot/src/client/index.ts',
            hash: '63cdd10a4d13ef1da672e5d5e236d2ae60db20e7',
            ext: '.ts',
          },
          {
            file:
              'app/riot/src/client/preview/__snapshots__/render-riot.test.ts.snap',
            hash: 'b67db362d53c4ccb075cb601d22c6c4c04d5fac8',
            ext: '.snap',
          },
          {
            file: 'app/riot/src/client/preview/compileStageFunctions.ts',
            hash: '924ceb9354e514745b0daa5b5800f09d77d9fbe4',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/client/preview/globals.ts',
            hash: '0ec7f2b138a6c31cc4ee011bc315643358084eec',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/client/preview/index.ts',
            hash: '1d769cdcdbc448cba78a4417c12a1f0cf4756bc0',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/client/preview/render-riot.test.ts',
            hash: '8c249fc090bd9d7f6be943e3aab9a3c67d2eabdc',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/client/preview/render.ts',
            hash: 'c5338a4f2358fabf31cc5aa6d39716a56d8415f9',
            ext: '.ts',
          },
          {
            file:
              'app/riot/src/client/preview/rendering/compiledButUnmounted.ts',
            hash: '47d8f3ee3bc4b4e2cc94a6bc7a5f0f1e67242a8a',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/client/preview/rendering/index.ts',
            hash: '67bf624371ae9add452a9b38ed28fe710d2554d4',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/client/preview/rendering/raw.ts',
            hash: '8ed2fdebf320afd192de5bec6777ad993db11a4c',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/client/preview/rendering/stringified.ts',
            hash: 'fcde052b227b490192ffbcc9a4ee312601537511',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/server/framework-preset-riot.ts',
            hash: '47b0b81053446a2caa79a31d570e5fb042f96c86',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/server/options.ts',
            hash: 'e5a06e2140a4b75cc20aa5cae6c41bc98ea8644d',
            ext: '.ts',
          },
          {
            file: 'app/riot/src/typings.d.ts',
            hash: 'f5fca913e2757c975d4679d18894050539328b72',
            ext: '.ts',
          },
          {
            file: 'app/riot/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/riot/tsconfig.json',
            hash: 'bc50e94eb1859c8995d21ee7b648c5f0c2dd9688',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/vue3': {
      name: '@storybook/vue3',
      type: 'lib',
      data: {
        root: 'app/vue3',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/vue3/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/vue3/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/vue3/package.json',
            hash: '8cd1e5f59d22737633780d7ffa8a7e5e148281e1',
            ext: '.json',
          },
          {
            file: 'app/vue3/README.md',
            hash: '3582c7266b86f106d6827567fdbe4be07dbc6441',
            ext: '.md',
          },
          {
            file: 'app/vue3/src/client/index.ts',
            hash: '57d0e7c7f30e688cb6d6b79abad47eec22ee38b4',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/client/preview/globals.ts',
            hash: '8ccb267b3416730ecd76a8b84d4298941b743da5',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/client/preview/index.ts',
            hash: '8dfacbc5713354ee6c8437c6a8812277f353d551',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/client/preview/render.ts',
            hash: '6a9cf7e1e64813ffefb3e444a57ddcb5cc4b61fd',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/client/preview/types-6-0.ts',
            hash: 'fb12070637d7416be0a1264aebb0a0752c872d04',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/client/preview/types.ts',
            hash: 'b25133f953e13a41cb87918e950bf237df686df8',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/server/framework-preset-vue3.ts',
            hash: '5061efe35be272edeaaf2d823c27900b0e8f99b7',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/server/options.ts',
            hash: '539771517c8a6be03bcb2fcfa6fe403053ee5026',
            ext: '.ts',
          },
          {
            file: 'app/vue3/src/typings.d.ts',
            hash: '64a098b2547593838c7b51bb46cd909309585243',
            ext: '.ts',
          },
          {
            file: 'app/vue3/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/vue3/tsconfig.json',
            hash: '08bdb7764f7628be93224ed1b28b56c35990e5e0',
            ext: '.json',
          },
          {
            file: 'app/vue3/types-6-0.d.ts',
            hash: 'b5946b39a8d8e20d1c13962a519c1aeae6a25c94',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/core': {
      name: '@storybook/core',
      type: 'lib',
      data: {
        root: 'lib/core',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/core/client.d.ts',
            hash: '7097d9f9c3a6245751acccd0e40a0442ab154982',
            ext: '.ts',
          },
          {
            file: 'lib/core/client.js',
            hash: '0cea520ec68bf8801f89276cebfb0d38c5a72b88',
            ext: '.js',
          },
          {
            file: 'lib/core/docs/standalone.md',
            hash: 'd7005c1a284da37f9492522ee2dd5f98a4dcdfdf',
            ext: '.md',
          },
          {
            file: 'lib/core/docs/storiesOf.md',
            hash: '64ead5a3de33f3d6414c96454ce83f138d825894',
            ext: '.md',
          },
          {
            file: 'lib/core/package.json',
            hash: '2240a752a9d7c20a8b592a06bb09d1f258f213b8',
            ext: '.json',
          },
          {
            file: 'lib/core/README.md',
            hash: 'd83f6469542b16089f3551c5e7a298386c60afde',
            ext: '.md',
          },
          {
            file: 'lib/core/server.d.ts',
            hash: '932dd8ba27d9a453afb29062c95f64ffdcb84cdf',
            ext: '.ts',
          },
          {
            file: 'lib/core/server.js',
            hash: 'b67233ee30a2fda31326960b0f84e265a5ee2b13',
            ext: '.js',
          },
          {
            file: 'lib/core/src/index.ts',
            hash: '7097d9f9c3a6245751acccd0e40a0442ab154982',
            ext: '.ts',
          },
          {
            file: 'lib/core/src/server.ts',
            hash: '932dd8ba27d9a453afb29062c95f64ffdcb84cdf',
            ext: '.ts',
          },
          {
            file: 'lib/core/standalone.js',
            hash: 'eeebda0b567ea28e4a3ecde520db045c9eb77f23',
            ext: '.js',
          },
          {
            file: 'lib/core/tsconfig.json',
            hash: '2dfc208de492fa452d4dc677e6f9dd090ec1e198',
            ext: '.json',
          },
          {
            file: 'lib/core/typings.d.ts',
            hash: 'faea2fff4fbe767651dac6688b02061f78f4bda4',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/rax': {
      name: '@storybook/rax',
      type: 'lib',
      data: {
        root: 'app/rax',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/rax/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/rax/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/rax/package.json',
            hash: '78c76890580c0f108a17c47e22013eff44d86af7',
            ext: '.json',
          },
          {
            file: 'app/rax/README.md',
            hash: '137faed65c724edd2ea0730470becc53304c30c8',
            ext: '.md',
          },
          {
            file: 'app/rax/src/client/index.ts',
            hash: '21d3f4bf39c9da14ebe50cd6eed65cb6802e58b8',
            ext: '.ts',
          },
          {
            file: 'app/rax/src/client/preview/globals.ts',
            hash: 'd4be24eaaceb9a947c300c83c9e0810f2521838c',
            ext: '.ts',
          },
          {
            file: 'app/rax/src/client/preview/index.ts',
            hash: 'b198c52c606c8bd2cac930be5d26ef1949b82775',
            ext: '.ts',
          },
          {
            file: 'app/rax/src/client/preview/render.ts',
            hash: 'f791ccfff75bbb0b85663eda97658c27e6846bd1',
            ext: '.ts',
          },
          {
            file: 'app/rax/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/rax/src/server/framework-preset-rax.ts',
            hash: '73fb93058e10abb7a4652f0445fd57666d08c93c',
            ext: '.ts',
          },
          {
            file: 'app/rax/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/rax/src/server/options.ts',
            hash: '105f6457446dd2ffb9ec95bed785bf507999f36e',
            ext: '.ts',
          },
          {
            file: 'app/rax/src/typings.d.ts',
            hash: '2f4eb9cf4fd9526e33ad6f5c0f4ad969a5726c24',
            ext: '.ts',
          },
          {
            file: 'app/rax/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/rax/tsconfig.json',
            hash: 'f1429a324345f6b524fd2db21d3b4d99997a4e6e',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/vue': {
      name: '@storybook/vue',
      type: 'lib',
      data: {
        root: 'app/vue',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'app/vue/bin/build.js',
            hash: '6ef07a26a9fca1c7939af8db5cf2661bb80f4c7a',
            ext: '.js',
          },
          {
            file: 'app/vue/bin/index.js',
            hash: '8aab7bbceb2bcd39775231935847c2f87b9b5b54',
            ext: '.js',
          },
          {
            file: 'app/vue/package.json',
            hash: 'b659abbdd37ccb99c69587bc6683817ec414c489',
            ext: '.json',
          },
          {
            file: 'app/vue/README.md',
            hash: 'f3b3af4d1a391d0539c0ebeb77734fce2e0df0a3',
            ext: '.md',
          },
          {
            file: 'app/vue/src/client/index.ts',
            hash: '620f2fae5cd038829e555775705f75a14be35d7b',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/client/preview/globals.ts',
            hash: '81b7d6a8b65cfde27fd9f2758cfdd37efa2945b0',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/client/preview/index.ts',
            hash: '06b5202bb693f89ff26b797466cf597f8adda270',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/client/preview/render.ts',
            hash: '29c54bf00a2868a7e375cbf40f471513eeaa42bd',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/client/preview/types-6-0.ts',
            hash: '66dbbd4ca8ebc585f2298e38e27900a1743d3bfd',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/client/preview/types.ts',
            hash: 'b2e8b22ec0c33b527f361b95cec28d5aac209f17',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/client/preview/util.ts',
            hash: 'b44667add416217e9a2407a800b3f2617ad7ae79',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/server/build.ts',
            hash: 'd8abf06a43969c3c51dc01274da73ab1f6171f4c',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/server/framework-preset-vue.ts',
            hash: 'e81c5267681ca29ba506c28ddbdfa7d3e4029fe1',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/server/index.ts',
            hash: '774d96025a84915802df2036218567b1f18264b4',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/server/options.ts',
            hash: 'e57b0499481121ab29560feae9edca795cd41ee4',
            ext: '.ts',
          },
          {
            file: 'app/vue/src/typings.d.ts',
            hash: '87f498f04800cb2da9acb7bd23e79c4c70edfe15',
            ext: '.ts',
          },
          {
            file: 'app/vue/standalone.js',
            hash: 'd11a82f79957863458d764f73ef4ffd5b83787d8',
            ext: '.js',
          },
          {
            file: 'app/vue/tsconfig.json',
            hash: '08bdb7764f7628be93224ed1b28b56c35990e5e0',
            ext: '.json',
          },
          {
            file: 'app/vue/types-6-0.d.ts',
            hash: 'b5946b39a8d8e20d1c13962a519c1aeae6a25c94',
            ext: '.ts',
          },
        ],
      },
    },
    '@storybook/api': {
      name: '@storybook/api',
      type: 'lib',
      data: {
        root: 'lib/api',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/api/package.json',
            hash: 'eb4a1cd59e82fb869eb50303b6b21689bc5e03fc',
            ext: '.json',
          },
          {
            file: 'lib/api/shortcut.d.ts',
            hash: '7d630d0109460ca6c94d623f36c3dfc7ccd037ba',
            ext: '.ts',
          },
          {
            file: 'lib/api/shortcut.js',
            hash: 'f3bdc238133b4bf7cf88b519e2a1a9d36d784862',
            ext: '.js',
          },
          {
            file: 'lib/api/src/context.ts',
            hash: 'faf94497fe32c911195eb304b8c795e2fb493900',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/index.tsx',
            hash: '98253b2aad0f5d524dce759eb3b7bf95424ec58f',
            ext: '.tsx',
          },
          {
            file: 'lib/api/src/initial-state.ts',
            hash: '0dbb1381205e0dd218e18551c845386a13401b32',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/lib/events.ts',
            hash: 'ed53a10104b83afea952bdee23b7e68e6816532b',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/lib/merge.ts',
            hash: '31bd61cd3ce2147215f3adfe0c7e4f8fc39177f1',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/lib/shortcut.ts',
            hash: '057dd5a2193048bfc2eeb9b4b97938ee6f01b0c0',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/lib/store-setup.ts',
            hash: '3ee481a35013d1fa6db39e0a455661d8beac1853',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/lib/stories.ts',
            hash: 'd567380dfd022ca8fbec4bb77f2808f942ab8cb7',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/addons.ts',
            hash: 'a74a007da24f924f6059417ff96b1734f7119d5d',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/channel.ts',
            hash: '1ae00729620b92399c58f556afa3055dc550ebc6',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/globals.ts',
            hash: '172aaafa0934ce704f9d7c803fc39f1dbed9e78d',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/layout.ts',
            hash: '41c4a16bdae0461c75dd357d98568ee155029bf1',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/notifications.ts',
            hash: '32972b6d603831bb29b347fbaf57b1fb447918c6',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/provider.ts',
            hash: '298546b1dcddaae8cc2a4124ef952010599fa920',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/refs.ts',
            hash: 'c8f10f78b4298635b5cf88d60486dbdb0f8ff046',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/release-notes.ts',
            hash: '907744ccedae61c69fabedce44d9b3015f1023f8',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/settings.ts',
            hash: '713393a26fbdd29bb797959da7875fc509fe448d',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/shortcuts.ts',
            hash: '702a5490fed3e3bab9e9f75ab32cf7a2a47a3168',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/stories.ts',
            hash: 'dd72ad0beecfb2c38a151492e21f8bf3db9bfe62',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/url.ts',
            hash: '8a0ae66e13dd4d744ba0d364738be2b37b8915f4',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/modules/versions.ts',
            hash: '25f2e0c5cd0da6828fc5aadc784fcea3c95c2bf2',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/store.ts',
            hash: '499bf62fc1fb981644c52ac2578802f579382528',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/tests/addons.test.js',
            hash: 'c63a0751fadc342596a1d77158d98fee17ce8ee8',
            ext: '.js',
          },
          {
            file: 'lib/api/src/tests/events.test.ts',
            hash: '98be6a2729c4e65f0c5afeb63503f6fafa96b185',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/tests/globals.test.ts',
            hash: '1f8cec960295e2f97f9d15eff4a90d18360e0144',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/tests/layout.test.js',
            hash: '30acdf9abcd688de18ffa74234c7892d544b84e1',
            ext: '.js',
          },
          {
            file: 'lib/api/src/tests/notifications.test.js',
            hash: 'ffa2a1eec86b5a50680467b70d40e92f430c7ae2',
            ext: '.js',
          },
          {
            file: 'lib/api/src/tests/ref-mockdata.login-required.json',
            hash: '64c19b486fc85a8d9c4f6deb6afbdad1078f7cc8',
            ext: '.json',
          },
          {
            file: 'lib/api/src/tests/ref-mockdata.success.json',
            hash: 'fc09107287254181718377bc207282499e959a73',
            ext: '.json',
          },
          {
            file: 'lib/api/src/tests/refs.test.js',
            hash: 'd578afbae1c38e23cb9500869deb643cad15f202',
            ext: '.js',
          },
          {
            file: 'lib/api/src/tests/shortcut.test.js',
            hash: '3a617332a37a64960faae8346d51e68c73c1deae',
            ext: '.js',
          },
          {
            file: 'lib/api/src/tests/shortcuts.test.js',
            hash: '41678e0f872ed86f647b8fb16a1627e2a7c88dbc',
            ext: '.js',
          },
          {
            file: 'lib/api/src/tests/store.test.js',
            hash: '4d555d74f9f0cca8b6fd361e32021b679ef5f127',
            ext: '.js',
          },
          {
            file: 'lib/api/src/tests/stories.test.js',
            hash: 'd76257575a9c77787606bdf81ab6c44b31d76667',
            ext: '.js',
          },
          {
            file: 'lib/api/src/tests/url.test.js',
            hash: '2a77a44c30df7ca3d2f814dd2fb93be53f6d8e33',
            ext: '.js',
          },
          {
            file: 'lib/api/src/tests/versions.test.js',
            hash: 'aa7147be62e7ceceb336b03a5c36109985e97098',
            ext: '.js',
          },
          {
            file: 'lib/api/src/typings.d.ts',
            hash: 'a6dac5aaeff87a6f388674d54227529adf886592',
            ext: '.ts',
          },
          {
            file: 'lib/api/src/version.ts',
            hash: 'ce08c4e5e05e66cb32d9b582d9b955a3a4055018',
            ext: '.ts',
          },
          {
            file: 'lib/api/tsconfig.json',
            hash: '61cbbd6356c3da4d4cfe0d110704238935c617ae',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/cli': {
      name: '@storybook/cli',
      type: 'lib',
      data: {
        root: 'lib/cli',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
          test: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'test',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/cli/.babelrc.json',
            hash: 'ffec5b09f395391032645a535447a67a2e5da30a',
            ext: '.json',
          },
          {
            file: 'lib/cli/bin/index.js',
            hash: 'e69e5879453c3e1495a0d589e015b50ab993470d',
            ext: '.js',
          },
          {
            file: 'lib/cli/docs/getstorybook.png',
            hash: '90dd790ee92d740b95f47de3497db93e3a776b1c',
            ext: '.png',
          },
          {
            file: 'lib/cli/package.json',
            hash: '98ea65ccc7de7d19ce56515d7183d4a5f803de4e',
            ext: '.json',
          },
          {
            file: 'lib/cli/README.md',
            hash: 'c8c0ceb3d054e523c89e4cba6295df0b45ed405f',
            ext: '.md',
          },
          {
            file: 'lib/cli/scripts/generate-sb-packages-versions.js',
            hash: '069d9359627e89e9e6a59571775ba1b189e2cc05',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/.eslintrc.js',
            hash: '5eff5c56025efa17215cc875e64b573168e7c2aa',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/add.test.ts',
            hash: '261c6626b11b3a02354794d8440cf8b3137db7db',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/add.ts',
            hash: '300a2303966811fca89e59401a5daa388ae311f4',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/detect.test.ts',
            hash: '03fb67f56132550d876ccc1865908b55e85d7264',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/detect.ts',
            hash: 'a3eaa416f8eb3f7a3809f4d804589954f96dddae',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/extract.ts',
            hash: '5826c15d5b4eb1fd1294a1fb1c9c8562786781cf',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/angular/button.component.ts',
            hash: '3d0efd6af2f340d77ed07a779e21f1b6aa3a8026',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/angular/Button.stories.ts',
            hash: 'db896b7f510be4563c5d7912aec65a65efae072f',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/angular/header.component.ts',
            hash: '7be2696926a535e7cf8ad4c00f52d92df5c73141',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/angular/Header.stories.ts',
            hash: '7ad12ed8877c718476090d4376bac09d7ef3e201',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/angular/page.component.ts',
            hash: 'd5b8b2ec9367126322a2e93ef8f2d13d7eec8fc1',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/angular/Page.stories.ts',
            hash: '88049fe8ca4991dad63fc52de448f570476c3477',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/aurelia/1-Button.stories.ts',
            hash: '34b329040d65d428a259ec6fc399781dbe474fb9',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/aurelia/button.ts',
            hash: '86cac656b57c7b07bff54a5b1e3aa02611558806',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/common/assets/code-brackets.svg',
            hash: '73de9477600103d031de4114e20468832cfe0d78',
            ext: '.svg',
          },
          {
            file: 'lib/cli/src/frameworks/common/assets/colors.svg',
            hash: '17d58d516e149de0fa83dc6e684ebd2901aeabf7',
            ext: '.svg',
          },
          {
            file: 'lib/cli/src/frameworks/common/assets/comments.svg',
            hash: '6493a139f523ee8cceccfb242fd532c0fbfcb5c3',
            ext: '.svg',
          },
          {
            file: 'lib/cli/src/frameworks/common/assets/direction.svg',
            hash: '65676ac27229460d03c6cfc929210f4773c37d45',
            ext: '.svg',
          },
          {
            file: 'lib/cli/src/frameworks/common/assets/flow.svg',
            hash: '8ac27db403c236ff9f5db8bf023c396570dc8f6b',
            ext: '.svg',
          },
          {
            file: 'lib/cli/src/frameworks/common/assets/plugin.svg',
            hash: '29e5c690c0a250f78a5d6f88410fbc14a268e4c2',
            ext: '.svg',
          },
          {
            file: 'lib/cli/src/frameworks/common/assets/repo.svg',
            hash: 'f386ee902c1fe318885140acebab6aa2f8549646',
            ext: '.svg',
          },
          {
            file: 'lib/cli/src/frameworks/common/assets/stackalt.svg',
            hash: '9b7ad2743506eb0ec12daa9a11ec2321a05d6775',
            ext: '.svg',
          },
          {
            file: 'lib/cli/src/frameworks/common/button.css',
            hash: 'dc91dc76370b78ec277e634f8615b67ca55a5145',
            ext: '.css',
          },
          {
            file: 'lib/cli/src/frameworks/common/header.css',
            hash: 'acadc9ec8c7f4e7ed196d6901c12774a60ac30c1',
            ext: '.css',
          },
          {
            file: 'lib/cli/src/frameworks/common/Introduction.stories.mdx',
            hash: '8b959a257af299fc75dcb5161752798d89b59ec1',
            ext: '.mdx',
          },
          {
            file: 'lib/cli/src/frameworks/common/page.css',
            hash: '51c9d099a139397dcbd6099e08701d3774af7f38',
            ext: '.css',
          },
          {
            file: 'lib/cli/src/frameworks/ember/1-Button.stories.js',
            hash: '4ed1d267badb1183fffbda76e4c973b475ea3aab',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/html/js/Button.js',
            hash: 'c6c6bd6462bf26198a6a81c9085cc463346f57c4',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/html/js/Button.stories.js',
            hash: '60f9d5f8ec52107946f1a67f58322f0e1aa7d446',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/html/js/Header.js',
            hash: '80c413d022d5b87348cc61674851530ff68654b4',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/html/js/Header.stories.js',
            hash: 'f5f9ce67b81dbaf4e0d3b3ddc6e062a6bb4775f2',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/html/js/Page.js',
            hash: '1ea39188f2efec8500a83e4f6521548c3bf50b43',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/html/js/Page.stories.js',
            hash: '93a482997508050b6b7da8f01a313ea26471db5f',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/html/ts/Button.stories.ts',
            hash: '50d2aa30b17e2fea74cddca450354744080b9ada',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/html/ts/Button.ts',
            hash: 'e55ec3dd3b85544067c71e4d97ca6212ca05b535',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/html/ts/Header.stories.ts',
            hash: '476dfd5b89c43c37a2439772aa9bb58c1ab59ea5',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/html/ts/Header.ts',
            hash: 'f7ec96862742493d3b1c8a296c39641f5f84431a',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/html/ts/Page.stories.ts',
            hash: '14318d63fca0572f11be3fbd85c5b18320eac52b',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/html/ts/Page.ts',
            hash: 'bbccd64ada59146ccfbcfe141edc4bced4be9462',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/marionette/index.stories.js',
            hash: 'a21a55194725d28c57d9aa2977b53fa5958e1bda',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/marko/1-Button.stories.js',
            hash: 'e82bebc4555a1f4ffda2257eeab7082fb3204373',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/marko/Button.marko',
            hash: '01f96c2475bc913481b92f3862255dc5916a6bb6',
            ext: '.marko',
          },
          {
            file: 'lib/cli/src/frameworks/mithril/Button.js',
            hash: '734c5b1065278118fac2c76e485cda4893a566a8',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/mithril/Button.stories.js',
            hash: '0a78c35925b66451a3e42b6491debea938d24e5e',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/mithril/Header.js',
            hash: 'fed4b72c7cdb6a5e665daf49582f3f97e79fee9a',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/mithril/Header.stories.js',
            hash: 'fce05950e12137aab63401859293ba91ab8417b0',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/mithril/Page.js',
            hash: '199957740cf4f640a1104c4a31931f458be97abd',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/mithril/Page.stories.js',
            hash: 'c4113766f7bcd8cfd41ce66764fd6dcf4c532512',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/preact/Button.js',
            hash: '83ee57533ddca019312c1a89fa71233a1f862941',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/preact/Button.stories.js',
            hash: '6e88f084c944858c32bd5d29f87d1acb7d60ff50',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/preact/Header.js',
            hash: 'f425ec15286d9625b60be17c1d34e03f89658038',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/preact/Header.stories.js',
            hash: '6b580f9631afcf1788cc2f3ee3837383042b5bee',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/preact/Page.js',
            hash: '76d40dcee73d775a76d39c5c50330268118d0e82',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/preact/Page.stories.js',
            hash: 'c01b13d2fed40d4f946eb529a976330fe00af670',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/rax/Button.js',
            hash: '8ad47a2d04f8b7d4530d05b3b820d6c323a5d82f',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/rax/Button.stories.js',
            hash: 'dbde7f7c2f0c0a3b2f80302928c9573765a0c65e',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/rax/Header.js',
            hash: '5d6b9a7d3e911bd2445e054213861c8eda591e96',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/rax/Header.stories.js',
            hash: '707c8aa123ec3c966b3d2047524fe84041bf6d36',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/rax/Page.js',
            hash: '0bda5cae9e9fe2d7b5ad75a0739665feb8a66bb0',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/rax/Page.stories.js',
            hash: '0f57d32ca576a46502180f7e2fbe39a5d82ec3e0',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/react/js/Button.js',
            hash: '15dde3920956629afece469d38c5e2e4fdcd9572',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/react/js/Button.stories.js',
            hash: '7fee217c191111f4cc7287d5c570977bc180a4f2',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/react/js/Header.js',
            hash: '30afca379c75d53f367bff33a1b9d2d02c760b29',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/react/js/Header.stories.js',
            hash: '16f41aa37c5a8da6c779499910f896e543d03ae2',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/react/js/Page.js',
            hash: '1534d1c0b68382bf015459e9a6a5c06e32ede105',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/react/js/Page.stories.js',
            hash: 'd44848ad05efe858532686723120694b9241e30e',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/react/ts/Button.stories.tsx',
            hash: '2da2caf98dfebe2c6fcfa6ada88132f3fb14804d',
            ext: '.tsx',
          },
          {
            file: 'lib/cli/src/frameworks/react/ts/Button.tsx',
            hash: '6d397b7494922fa314ac6ccc9eb33a2bf004dada',
            ext: '.tsx',
          },
          {
            file: 'lib/cli/src/frameworks/react/ts/Header.stories.tsx',
            hash: '6481ec565478d307403435131dad2df8044d770b',
            ext: '.tsx',
          },
          {
            file: 'lib/cli/src/frameworks/react/ts/Header.tsx',
            hash: 'c331705ec544b498bfd49e9276cb219c5bafcde7',
            ext: '.tsx',
          },
          {
            file: 'lib/cli/src/frameworks/react/ts/Page.stories.tsx',
            hash: '6d8e20fe21c0c5f946dcbae6a08297935e36aba8',
            ext: '.tsx',
          },
          {
            file: 'lib/cli/src/frameworks/react/ts/Page.tsx',
            hash: 'ab4ce27c4ccc024453313595ca75e022a11c3c00',
            ext: '.tsx',
          },
          {
            file: 'lib/cli/src/frameworks/riot/1-Button.stories.js',
            hash: 'c89dbee3d0a342586ce2cd496399584b568224c6',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/riot/MyButton.tag',
            hash: '5a8862b42e5424d2700bdfa5fc82eb62b38a498b',
            ext: '.tag',
          },
          {
            file: 'lib/cli/src/frameworks/svelte/Button.stories.svelte',
            hash: 'a8d77d4b2162829377000d24cb25c38fab1f9f28',
            ext: '.svelte',
          },
          {
            file: 'lib/cli/src/frameworks/svelte/Button.svelte',
            hash: 'ee2d74d81f65129824ddff28be0257a647e8cea3',
            ext: '.svelte',
          },
          {
            file: 'lib/cli/src/frameworks/svelte/Header.stories.svelte',
            hash: 'edd67627b1fd7cd593613b19ba33f6b2b05eca74',
            ext: '.svelte',
          },
          {
            file: 'lib/cli/src/frameworks/svelte/Header.svelte',
            hash: '7ee94494a923fd1fc25fd85cab6086598da34921',
            ext: '.svelte',
          },
          {
            file: 'lib/cli/src/frameworks/svelte/Page.stories.svelte',
            hash: '336a64ac62ea15ead4cc8cf35ff12a534bb71024',
            ext: '.svelte',
          },
          {
            file: 'lib/cli/src/frameworks/svelte/Page.svelte',
            hash: 'e976d8800fe6f1081995177d33069b093712d597',
            ext: '.svelte',
          },
          {
            file: 'lib/cli/src/frameworks/vue/Button.stories.js',
            hash: 'af6f4e9809e26f09a24f67f725842e5ecee03962',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/vue/Button.vue',
            hash: '864a2638ac5fbd69675ef94c2c5a02f545f61c83',
            ext: '.vue',
          },
          {
            file: 'lib/cli/src/frameworks/vue/Header.stories.js',
            hash: '007b7f7cb5c5842d3beffbf8cb87bbca9c8bab44',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/vue/Header.vue',
            hash: '3e704f9bf900a4c7f1344640c8e59c9520367bac',
            ext: '.vue',
          },
          {
            file: 'lib/cli/src/frameworks/vue/Page.stories.js',
            hash: 'c051b0d41c75ffb2a653f93d9f19bbddb8582e01',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/vue/Page.vue',
            hash: '987b8b9f318fac1e74aa1b864a2871699f4f593f',
            ext: '.vue',
          },
          {
            file: 'lib/cli/src/frameworks/vue3/Button.stories.js',
            hash: 'ac39a1fde37dbd9867d9c20e928703c811027e8d',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/vue3/Button.vue',
            hash: '664f48cb3f063e3118044830be6f6462fcecf63c',
            ext: '.vue',
          },
          {
            file: 'lib/cli/src/frameworks/vue3/Header.stories.js',
            hash: 'eb7826516b6960707d5300f4272bc0123797d345',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/vue3/Header.vue',
            hash: 'eec3f73b605763a8bf1cb8e0c650f928bf9b3add',
            ext: '.vue',
          },
          {
            file: 'lib/cli/src/frameworks/vue3/Page.stories.js',
            hash: 'f4acfa2d044081ed950855c15a3ee1ec6c39da37',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/vue3/Page.vue',
            hash: 'f7f2384223703d13123a8215de5b7b9208b5a164',
            ext: '.vue',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/js/Button.js',
            hash: '3cc631f9e91e303705b8239c92c243688879178c',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/js/Button.stories.js',
            hash: 'e45e0a06f279c674a3a3a7fbe4282ec6a390c7e9',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/js/Header.js',
            hash: 'b742e61ce0797256bab599f0efbc50396aab1986',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/js/Header.stories.js',
            hash: '6045ac91d89d77f335adaa1b88d549719e718868',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/js/Page.js',
            hash: 'e6c5181fe36ef8ca80e27cf328d5d1b95bcd15ea',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/js/Page.stories.js',
            hash: '10ba4b44d374a6de2ca43a50e6bd9487b08dab8b',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/ts/Button.stories.ts',
            hash: '96dc28377cb4f05fec9438cb23eb2e77a49036b9',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/ts/Button.ts',
            hash: '58312f93918fafe0820065bc1f7dec1d5bcfacc9',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/ts/Header.stories.ts',
            hash: '32e482fc159fd8f2a3d8dc5869193879cf98dfac',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/ts/Header.ts',
            hash: 'c9c6d0fbdbe3ec684e4726e2c086db38f14fc630',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/ts/Page.stories.ts',
            hash: '25c49ba36e7c03768da3a73a1ca353bb1cfd027e',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/frameworks/web-components/ts/Page.ts',
            hash: 'db59099e9524878d1471e97cd592d125874b3b04',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generate.ts',
            hash: '1c9f88922e036a1b3bbbd398e884fc1f8fe825a7',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/ANGULAR/angular-helpers.ts',
            hash: 'bd9eecfa2babd93f882d7960b9ac426e69892219',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/ANGULAR/index.ts',
            hash: '57a4758a41ad6a56fd66134dd376cc0367d91bc3',
            ext: '.ts',
          },
          {
            file:
              'lib/cli/src/generators/ANGULAR/template-csf/.storybook/tsconfig.json',
            hash: '28aadc68fd9a81b016d346d63017cfedc5f6f5ca',
            ext: '.json',
          },
          {
            file:
              'lib/cli/src/generators/ANGULAR/template-csf/.storybook/typings.d.ts',
            hash: 'f73d61b396c9c45ae43f02fbd587629524173156',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/AURELIA/index.ts',
            hash: '61e21ac8985f0cf5b57089db1deffdade85b4650',
            ext: '.ts',
          },
          {
            file:
              'lib/cli/src/generators/AURELIA/template-csf/.storybook/tsconfig.json',
            hash: '28aadc68fd9a81b016d346d63017cfedc5f6f5ca',
            ext: '.json',
          },
          {
            file:
              'lib/cli/src/generators/AURELIA/template-csf/.storybook/typings.d.ts',
            hash: 'f73d61b396c9c45ae43f02fbd587629524173156',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/baseGenerator.ts',
            hash: '85a270f8235ccb7fdc188b86e04cac9b2c569def',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/configure.ts',
            hash: '1cca8936ee07c4e8848e816b86e941bf5af8e67a',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/EMBER/index.ts',
            hash: 'de4d2e9ef3e9e930caa7adaee82a620a23162c9d',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/HTML/index.ts',
            hash: '4781087d32bbc2a5ab78f55c5207d5afb6a5e8f3',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/MARIONETTE/index.ts',
            hash: '55e1bec59c212f4e05617c0a7fd13a145640f164',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/MARKO/index.ts',
            hash: 'd2f509b238c6585a509840e6653fe4fe63abcbd3',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/METEOR/index.ts',
            hash: 'c7894ddab8a1f5b59d72eb19deb47c909034aae2',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/MITHRIL/index.ts',
            hash: 'a693fddcd42551157b240de4fd6accb9a0d23382',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/PREACT/index.ts',
            hash: '2971849f2230f1f6a6a7211974b8628b187d569a',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/RAX/index.ts',
            hash: 'ddada20fe72735b38a53b2e90fdd93d618c7bd33',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/REACT_NATIVE/index.ts',
            hash: '135b385853530ad34007830c33b45412fabb765f',
            ext: '.ts',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/addons.js',
            hash: 'bc646c943eb4a8f39b896ba98d12c9cf9fa21a03',
            ext: '.js',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/index.js',
            hash: 'f6a30232e53b8a979daad3c9abb0bb8555f56d6b',
            ext: '.js',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/rn-addons.js',
            hash: '4d30f923173b31e485e7c355ad189ac8352aad46',
            ext: '.js',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/stories/Button/Button.stories.js',
            hash: '8f17adc8664f909caf4f3cf16a68d4c38070a08c',
            ext: '.js',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/stories/Button/index.js',
            hash: '37c8437e72e41966bd3f574c61358c7fe821e3f6',
            ext: '.js',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/stories/CenterView/index.js',
            hash: '29732b27ab24ee13ed467987543908cd7f08b246',
            ext: '.js',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/stories/CenterView/style.js',
            hash: 'ff347fd9841f4c629ec2c18a71c6747ef351492d',
            ext: '.js',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/stories/index.js',
            hash: '5c9079ab2b004b3d7ce6cc423dcc5a5bfacea21d',
            ext: '.js',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/stories/Welcome/index.js',
            hash: '4256f15972020b0e78ca4c90679489810db8cc9f',
            ext: '.js',
          },
          {
            file:
              'lib/cli/src/generators/REACT_NATIVE/template-csf/storybook/stories/Welcome/Welcome.stories.js',
            hash: '98a964bc71460d73123dcd3ba7ea62e7e075ccdf',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/generators/REACT_SCRIPTS/index.ts',
            hash: '650c4396d0f685c853689b8749229530c96e125d',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/REACT/index.ts',
            hash: 'e7833641b92ff7740b12d2918377d8c5c12eb83f',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/RIOT/index.ts',
            hash: '2c5c7f0ab5f9352b3c25ae2542e77ef0663adcdd',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/SFC_VUE/index.ts',
            hash: '6bdc4a274dd762dc8b33c1f2db72b739b96ea3a9',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/SVELTE/index.ts',
            hash: 'f4f380870f4c36d4f72faefd173b36d45a0cae39',
            ext: '.ts',
          },
          {
            file:
              'lib/cli/src/generators/UPDATE_PACKAGE_ORGANIZATIONS/index.ts',
            hash: 'a78e467e8f5844262e93a062b23dfc4f910dc55b',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/VUE/index.ts',
            hash: 'c7a2549b812877ce9a41d3965052598ede663d19',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/VUE3/index.ts',
            hash: 'db9e4e4cab94ce69cffbff1f2e599658c49272d3',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/generators/WEB-COMPONENTS/index.ts',
            hash: '32bb5355c769761eed2d370cfca687e62c3e0438',
            ext: '.ts',
          },
          {
            file:
              'lib/cli/src/generators/WEB-COMPONENTS/template-csf/.storybook/preview.js',
            hash: '08bb9bc215d98e8471a1d01d31c8c7e71695dbc4',
            ext: '.js',
          },
          {
            file: 'lib/cli/src/generators/WEBPACK_REACT/index.ts',
            hash: '89494372f4b2a3b1e9c77b43e7024c1dc74b8003',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/helpers.test.ts',
            hash: '7f9a768fd53215076aafabf87bcd4c6440c551e7',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/helpers.ts',
            hash: 'b80dbfeb9fd7f5e76d18d6c6acb352a164e277d2',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/initiate.ts',
            hash: '026e34e5091d4f787e86f4cfb846395d93fc42d5',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/index.ts',
            hash: '13cc52f4ed04313c32b29f95ed74272a98339cab',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/JsPackageManager.ts',
            hash: '2b6c97339623e22d40b1b5ef9f5e76074049a93c',
            ext: '.ts',
          },
          {
            file:
              'lib/cli/src/js-package-manager/JsPackageManagerFactory.test.ts',
            hash: '8bbe8481ecc76842aee3a07277588438e5623b80',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/JsPackageManagerFactory.ts',
            hash: '6a7c9d38840ba3c94962dd19dba2844651834237',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/NPMProxy.test.ts',
            hash: '24eed3b06d1e0f395231efb23fcbf2d39fa219d1',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/NPMProxy.ts',
            hash: '56c2a70ea466bec8aa31faa8f1d1af16ae0f92da',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/PackageJson.ts',
            hash: 'ccc96e6f9279f44900ce79fcd1474bdd02ea14b6',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/PackageJsonHelper.ts',
            hash: '17fa72935f0ed86eb66d09dc1faad9f5368d9322',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/Yarn1Proxy.test.ts',
            hash: 'b89c8b96543021284ea4c2b0dd5d7710167b2018',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/Yarn1Proxy.ts',
            hash: '345a96a25991e62b5e682411e06a1b15604508bd',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/Yarn2Proxy.test.ts',
            hash: '7cfa265277498b5c6e359d9bb7e05a122e001db6',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/js-package-manager/Yarn2Proxy.ts',
            hash: 'adae2865dbce1ce64032415773805c8b1a038e30',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/migrate.ts',
            hash: '89e3e6759fa94eea1de7af4144d946fadda9cf74',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/NpmOptions.ts',
            hash: '1f21141446235c75f9be31902c84415c17865b40',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/project_types.test.ts',
            hash: '5fb59f45b98c14dc6de6bc3ab1a2db166e2eb157',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/project_types.ts',
            hash: '67be0f80176244a99b82a17647dab36ee3980465',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/typings.d.ts',
            hash: 'c368af0c4fa083e1922d0330f097f45e95bf789e',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/upgrade.test.ts',
            hash: '0c5c13998d14f263e87a48266e7f1cd080366d9e',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/upgrade.ts',
            hash: '47992a7daaf0925994512391f6dc0c9dea773ffe',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/versions.json',
            hash: '3a2a3193748780103363cd93db5acf08a29abb40',
            ext: '.json',
          },
          {
            file: 'lib/cli/src/warn.test.ts',
            hash: '7ce18679f218c259a647a74741c5c08a0cf76797',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/warn.ts',
            hash: 'a0614112ac871350c1bf82c4c15b5f7e64e9e7c8',
            ext: '.ts',
          },
          {
            file: 'lib/cli/src/window.d.ts',
            hash: '420d0c9916c066d9391171b80098ce2b5efb5b59',
            ext: '.ts',
          },
          {
            file: 'lib/cli/story.js',
            hash: '2a64488eda1992ddf0b3301ad2aa91ff6a299824',
            ext: '.js',
          },
          {
            file: 'lib/cli/test/default/cli.test.js',
            hash: 'b7ead3851c9e6e566d22c5291ba56f3a7df7a993',
            ext: '.js',
          },
          {
            file: 'lib/cli/test/helpers.js',
            hash: 'a3a2d9a23a5b36c434be4ee5223f1304c42cae98',
            ext: '.js',
          },
          {
            file: 'lib/cli/tsconfig.json',
            hash: '02ed347850bcf859c1d3fe9f425ea3fbbd88bdf4',
            ext: '.json',
          },
        ],
      },
    },
    '@storybook/ui': {
      name: '@storybook/ui',
      type: 'lib',
      data: {
        root: 'lib/ui',
        type: 'library',
        targets: {
          prepare: {
            executor: '@nrwl/workspace:run-script',
            options: {
              script: 'prepare',
            },
          },
        },
        tags: [],
        files: [
          {
            file: 'lib/ui/package.json',
            hash: 'bbe3cd2d2275b8d3480af2c7de0cfcb2fd27106c',
            ext: '.json',
          },
          {
            file: 'lib/ui/paths.js',
            hash: '935886acba6c3d0bafc4a2f7564d592758cd19ee',
            ext: '.js',
          },
          {
            file: 'lib/ui/README.md',
            hash: '92d6ce188024a52bd4064e7bba4a8583ea5610e3',
            ext: '.md',
          },
          {
            file: 'lib/ui/src/__tests__/index.js',
            hash: '7f21cdc5d851be39cf2c404116540f42cf200af6',
            ext: '.js',
          },
          {
            file: 'lib/ui/src/app.stories.tsx',
            hash: 'dcede85e012b33c84acbe359b244233c9e1ee6f1',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/app.tsx',
            hash: '865a60c2ac0d7120677edeadad8655e84bf83370',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/layout/app.mockdata.tsx',
            hash: '3b81ed8c5e86cc052253f2749f590315d8ef5341',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/layout/container.tsx',
            hash: '942018c3b8ea921a3b93e8ae13f21f826b309b0c',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/layout/desktop.stories.tsx',
            hash: '506ca6c4a2c73a9de8b7013bbe9632c3a4eb9b75',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/layout/desktop.tsx',
            hash: '5164c73b24daf29fbc595d61e87e3933a7eeb4bb',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/layout/draggers.tsx',
            hash: '90211fd46bc1bb0b05630f58f460d7b1ff6a6a82',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/layout/mobile.stories.tsx',
            hash: '159a75f96ec615d06c40c63fc8a0f333ffcacdca',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/layout/mobile.tsx',
            hash: '7b148862513cba4a4a559637ec67f79ed12133be',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/layout/persist.ts',
            hash: '1a304438cdfa600cf40e50804ee908dd7140c155',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/components/layout/Root.tsx',
            hash: '9a940b999f8d9a65c4aa850f1f4e31bec1de25b6',
            ext: '.tsx',
          },
          {
            file:
              'lib/ui/src/components/notifications/NotificationItem.stories.js',
            hash: '2fc9ac07bcb03d5d8bc29b3840ae02d0e00a3165',
            ext: '.js',
          },
          {
            file: 'lib/ui/src/components/notifications/NotificationItem.tsx',
            hash: '6fe48a7796bcf8c95b93f4886ea85f9f8d7f920e',
            ext: '.tsx',
          },
          {
            file:
              'lib/ui/src/components/notifications/NotificationList.stories.js',
            hash: '943ab0f985d127438a1da73ec0b5f4173002d3e9',
            ext: '.js',
          },
          {
            file: 'lib/ui/src/components/notifications/NotificationList.tsx',
            hash: '07a810eff8b1fde3c1d5c3bcbf230fbb8ff0c6bf',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/panel/panel.stories.tsx',
            hash: 'ffe5de78dd7264878b5c2696fbd29eb12b3202ba',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/panel/panel.tsx',
            hash: '60b23b6c3fb462beaa0c53db6514c0e1f9bff574',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/FramesRenderer.tsx',
            hash: 'f441a74bd8c32071dde5a4399518b3b6bae16063',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/iframe.stories.tsx',
            hash: 'c613e5eba277c2addbd106fa67ebe73fa6d75bea',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/iframe.tsx',
            hash: '9c9e69742d4f74787664505baf8651596b765dde',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/preview.mockdata.tsx',
            hash: '746898b4751d5fa610247fc7ca81668da71d2a77',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/preview.stories.tsx',
            hash: '2fa71df12706548e20fdc16f421f86d7956b20a2',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/preview.tsx',
            hash: 'ed988509a25123c4512a34f2e5290f5fd3506c69',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/toolbar.tsx',
            hash: '66f5c74897051ae9f4a066b4aafd5516d95c4a8b',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/tools/copy.tsx',
            hash: '1dcd0225973121e1e3f1096a24fd6b595afdba5a',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/tools/eject.tsx',
            hash: 'ff6f7ea447b9e13e2de4d22d9cdda53e35ca36cd',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/tools/zoom.tsx',
            hash: 'f03a6a4f451a9057b455aa052906c8d23ddbd0dd',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/utils/components.ts',
            hash: '2d8e80a302267e80240f0fe3258a9be991549820',
            ext: '.ts',
          },
          {
            file:
              'lib/ui/src/components/preview/utils/stringifyQueryParams.tsx',
            hash: '4175503808bb132f67e58939347692a940384b96',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/utils/types.tsx',
            hash: '5148c54211f559db3f530c7082afb1fa2bb8070f',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/preview/wrappers.tsx',
            hash: 'b0680262341ac185ccd713f3ea07da02ad3f30dc',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Brand.tsx',
            hash: '3d08654da09bcfb624c81c5216a7586581ee505f',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/data.test.ts',
            hash: '366338d251de8574d45e913ea4776a6263b02fc6',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/components/sidebar/data.ts',
            hash: '4a3d529f469aa99bc9576d45b471a7c72193b42f',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/components/sidebar/Explorer.stories.tsx',
            hash: 'd576069ac47dd305a1baff2a4335fd2f989c143e',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Explorer.tsx',
            hash: '7c027ac6d263da2b91677b9fc5a1fc2314326901',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Heading.stories.tsx',
            hash: 'a0f2f1243a070bc555105029d650417c6ab52e02',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Heading.tsx',
            hash: '4aeb4c1dc11ed931b8c07fca9ab871c901e35782',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/HighlightStyles.tsx',
            hash: 'c1f8269e37b20503adaf79f903b8e2700cbc1330',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Loader.tsx',
            hash: '4b2fec13034a54b9986ca4c43928bd9ad55c0dd3',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Menu.stories.tsx',
            hash: 'b8e2d5b928140918d8e03be4e3f5e4853a613bfd',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Menu.tsx',
            hash: 'b1d20f9748aa2760e33512f0019ddb17b00e2422',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/mockdata.large.ts',
            hash: '3ee99a3fb304ebd531b7a92d120c934a53138024',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/components/sidebar/mockdata.ts',
            hash: '61bed943ac4e805b91f30a03a4fa70dc918ae265',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/components/sidebar/RefBlocks.tsx',
            hash: '6c772cd84d8cfc914fb05782f6f1c83b42191793',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/RefIndicator.tsx',
            hash: '97f188dd529eb0551675f594b247f65e2bddd00d',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Refs.stories.tsx',
            hash: '61eceb006f396f9c742344abeec56a61c73a0018',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Refs.tsx',
            hash: '3e92178489fdb36a35f61d2f5f2882557a684fe3',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Search.stories.tsx',
            hash: 'e455be783db05023a4c70b717ee612bb5b51b776',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Search.tsx',
            hash: '4090972a81b644ebd0f341af7b8335185640b138',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/SearchResults.stories.tsx',
            hash: '75ea27ecbd954cff2ad5a948e5d56a1208a3cc01',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/SearchResults.tsx',
            hash: '8cdf13ffd7072dd5af122b12bfcbc70064ddcd9d',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Sidebar.stories.tsx',
            hash: '664105b7690764e33b49700f10347830ad43d23d',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Sidebar.tsx',
            hash: '43c981604929e665927972cc2a41cd87b7e69ce6',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Tree.stories.tsx',
            hash: '40d7fa161c0a5f57ff49a596ba382f7bb9088630',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/Tree.tsx',
            hash: '68160b6282b27b4cdf280e2d18184edfdb253927',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/TreeNode.stories.tsx',
            hash: '9ef79f3c46841b9ac6816c7c614ed11ca06c7690',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/TreeNode.tsx',
            hash: 'f745f38274b571a2acf14340e62b242d21903a18',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/components/sidebar/types.ts',
            hash: '29f14743004a1c315c0bccf202ad4004394c3012',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/components/sidebar/useExpanded.ts',
            hash: '9ebab6f0577f0abe7912aa30251d771ca795f946',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/components/sidebar/useHighlighted.ts',
            hash: '79e17605ba05b876615e362c4bbe8cb297cc4d17',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/components/sidebar/useLastViewed.ts',
            hash: 'aef8865fb3330aeee250239fff90e78fba0fb756',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/components/sidebar/utils.test.js',
            hash: '93462a57ccf018cd150626f0ed068eefbda36ab9',
            ext: '.js',
          },
          {
            file: 'lib/ui/src/components/sidebar/utils.ts',
            hash: '8b5f156efc533e2b4378bf93ab81d35f25636238',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/containers/menu.tsx',
            hash: 'dd42693a2659084c4963166473ca6e5e8a3c6b29',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/containers/notifications.tsx',
            hash: '25910ca1687169c2c1d0c13af9f84d348393a950',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/containers/panel.stories.tsx',
            hash: '982ee395f56e86554a4421b889aec14fb3e0e5bc',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/containers/panel.tsx',
            hash: '5e0d09d3020c10744281d71458fd9a4b1aed901d',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/containers/preview.tsx',
            hash: 'e6d9c7d9b31d8017e226244ba3bd4e42ee237683',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/containers/sidebar.tsx',
            hash: '6c9403f699a77c98d923918ecb3ecafd22815962',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/FakeProvider.tsx',
            hash: '8aa3c68cdb854f3dda4ccc1633bbaf66f19d58f4',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/index.tsx',
            hash: '1a670e47cecdcb0f702798019c481ed149052ba0',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/keybinding.ts',
            hash: 'f66ee3cfc3445347ba9907f5c8c89264918c5deb',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/provider.ts',
            hash: '66355d8aa4b33603c0fc8ef9b4d1fddf255209cc',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/settings/about_page.tsx',
            hash: 'd4eb96a2dc9d09c589fe74aed14a4c574274d147',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/about.stories.js',
            hash: '552bf4b2cd1d25fe90b65055069f94d96cfeba2b',
            ext: '.js',
          },
          {
            file: 'lib/ui/src/settings/about.tsx',
            hash: '30d12b3b1e3f6751582d59451cf56a2cf748a4e0',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/index.tsx',
            hash: '75a263c861218102807d0a2f393fde3ed449db46',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/release_notes_page.tsx',
            hash: 'd7b6e603d8bcdb0424189d4b888e101c725a318c',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/release_notes.stories.tsx',
            hash: '15728504762460d3bdf0dd4bb016b79924f47e3a',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/release_notes.tsx',
            hash: '76b17bb33760f9fa3ad017e4a597bb8d794e2276',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/SettingsFooter.stories.tsx',
            hash: '8be7f130cd12a949357227cf079cf65c283fb0e2',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/SettingsFooter.tsx',
            hash: 'b09ea94d4c1599886290c7d4979dd7caf061ad46',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/shortcuts_page.tsx',
            hash: 'bfcf313d3c04d70e1f701640ac155a890f9c7caa',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/shortcuts.stories.tsx',
            hash: 'eb152f01bf84271411b8a81508ce4afa3b91fb68',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/shortcuts.test.js',
            hash: '4bc9b1577cddd4fa59ef72d0294efe20e5d2489e',
            ext: '.js',
          },
          {
            file: 'lib/ui/src/settings/shortcuts.tsx',
            hash: '303dfe1a4a3095c01feedfb0c776cb3cfeb2df34',
            ext: '.tsx',
          },
          {
            file: 'lib/ui/src/settings/typings.d.ts',
            hash: 'e388e48d9c303c1e3541f6926efd6169a30e7a99',
            ext: '.ts',
          },
          {
            file: 'lib/ui/src/typings.d.ts',
            hash: '07c732cbb184ec44721ff263c30ec9c159cd1be2',
            ext: '.ts',
          },
          {
            file: 'lib/ui/tsconfig.json',
            hash: '038c99b67ac0163ed5b781e07b752ef33e46b827',
            ext: '.json',
          },
        ],
      },
    },
    'npm:@babel/cli': {
      type: 'npm',
      name: 'npm:@babel/cli',
      data: {
        version: '^7.12.10',
        packageName: '@babel/cli',
        files: [],
      },
    },
    'npm:@babel/core': {
      type: 'npm',
      name: 'npm:@babel/core',
      data: {
        version: '^7.12.10',
        packageName: '@babel/core',
        files: [],
      },
    },
    'npm:@babel/plugin-proposal-class-properties': {
      type: 'npm',
      name: 'npm:@babel/plugin-proposal-class-properties',
      data: {
        version: '^7.12.1',
        packageName: '@babel/plugin-proposal-class-properties',
        files: [],
      },
    },
    'npm:@babel/plugin-proposal-decorators': {
      type: 'npm',
      name: 'npm:@babel/plugin-proposal-decorators',
      data: {
        version: '^7.12.12',
        packageName: '@babel/plugin-proposal-decorators',
        files: [],
      },
    },
    'npm:@babel/plugin-proposal-export-default-from': {
      type: 'npm',
      name: 'npm:@babel/plugin-proposal-export-default-from',
      data: {
        version: '^7.12.1',
        packageName: '@babel/plugin-proposal-export-default-from',
        files: [],
      },
    },
    'npm:@babel/plugin-proposal-object-rest-spread': {
      type: 'npm',
      name: 'npm:@babel/plugin-proposal-object-rest-spread',
      data: {
        version: '^7.12.1',
        packageName: '@babel/plugin-proposal-object-rest-spread',
        files: [],
      },
    },
    'npm:@babel/plugin-proposal-private-methods': {
      type: 'npm',
      name: 'npm:@babel/plugin-proposal-private-methods',
      data: {
        version: '^7.12.1',
        packageName: '@babel/plugin-proposal-private-methods',
        files: [],
      },
    },
    'npm:@babel/plugin-syntax-dynamic-import': {
      type: 'npm',
      name: 'npm:@babel/plugin-syntax-dynamic-import',
      data: {
        version: '^7.8.3',
        packageName: '@babel/plugin-syntax-dynamic-import',
        files: [],
      },
    },
    'npm:@babel/preset-env': {
      type: 'npm',
      name: 'npm:@babel/preset-env',
      data: {
        version: '^7.12.11',
        packageName: '@babel/preset-env',
        files: [],
      },
    },
    'npm:@babel/preset-flow': {
      type: 'npm',
      name: 'npm:@babel/preset-flow',
      data: {
        version: '^7.12.1',
        packageName: '@babel/preset-flow',
        files: [],
      },
    },
    'npm:@babel/preset-react': {
      type: 'npm',
      name: 'npm:@babel/preset-react',
      data: {
        version: '^7.12.10',
        packageName: '@babel/preset-react',
        files: [],
      },
    },
    'npm:@babel/preset-typescript': {
      type: 'npm',
      name: 'npm:@babel/preset-typescript',
      data: {
        version: '^7.12.7',
        packageName: '@babel/preset-typescript',
        files: [],
      },
    },
    'npm:@babel/runtime': {
      type: 'npm',
      name: 'npm:@babel/runtime',
      data: {
        version: '^7.12.5',
        packageName: '@babel/runtime',
        files: [],
      },
    },
    'npm:@emotion/snapshot-serializer': {
      type: 'npm',
      name: 'npm:@emotion/snapshot-serializer',
      data: {
        version: '^0.8.2',
        packageName: '@emotion/snapshot-serializer',
        files: [],
      },
    },
    'npm:@nicolo-ribaudo/chokidar-2': {
      type: 'npm',
      name: 'npm:@nicolo-ribaudo/chokidar-2',
      data: {
        version: '^2.1.8',
        packageName: '@nicolo-ribaudo/chokidar-2',
        files: [],
      },
    },
    'npm:@storybook/eslint-config-storybook': {
      type: 'npm',
      name: 'npm:@storybook/eslint-config-storybook',
      data: {
        version: '^2.4.0',
        packageName: '@storybook/eslint-config-storybook',
        files: [],
      },
    },
    'npm:@storybook/linter-config': {
      type: 'npm',
      name: 'npm:@storybook/linter-config',
      data: {
        version: '^2.5.0',
        packageName: '@storybook/linter-config',
        files: [],
      },
    },
    'npm:@storybook/semver': {
      type: 'npm',
      name: 'npm:@storybook/semver',
      data: {
        version: '^7.3.2',
        packageName: '@storybook/semver',
        files: [],
      },
    },
    'npm:@testing-library/dom': {
      type: 'npm',
      name: 'npm:@testing-library/dom',
      data: {
        version: '^7.29.4',
        packageName: '@testing-library/dom',
        files: [],
      },
    },
    'npm:@testing-library/jest-dom': {
      type: 'npm',
      name: 'npm:@testing-library/jest-dom',
      data: {
        version: '^5.11.9',
        packageName: '@testing-library/jest-dom',
        files: [],
      },
    },
    'npm:@testing-library/react': {
      type: 'npm',
      name: 'npm:@testing-library/react',
      data: {
        version: '^11.2.2',
        packageName: '@testing-library/react',
        files: [],
      },
    },
    'npm:@testing-library/user-event': {
      type: 'npm',
      name: 'npm:@testing-library/user-event',
      data: {
        version: '^12.6.0',
        packageName: '@testing-library/user-event',
        files: [],
      },
    },
    'npm:@types/detect-port': {
      type: 'npm',
      name: 'npm:@types/detect-port',
      data: {
        version: '^1.3.0',
        packageName: '@types/detect-port',
        files: [],
      },
    },
    'npm:@types/doctrine': {
      type: 'npm',
      name: 'npm:@types/doctrine',
      data: {
        version: '^0.0.3',
        packageName: '@types/doctrine',
        files: [],
      },
    },
    'npm:@types/enzyme': {
      type: 'npm',
      name: 'npm:@types/enzyme',
      data: {
        version: '^3.10.8',
        packageName: '@types/enzyme',
        files: [],
      },
    },
    'npm:@types/escodegen': {
      type: 'npm',
      name: 'npm:@types/escodegen',
      data: {
        version: '^0.0.6',
        packageName: '@types/escodegen',
        files: [],
      },
    },
    'npm:@types/express': {
      type: 'npm',
      name: 'npm:@types/express',
      data: {
        version: '^4.17.11',
        packageName: '@types/express',
        files: [],
      },
    },
    'npm:@types/fs-extra': {
      type: 'npm',
      name: 'npm:@types/fs-extra',
      data: {
        version: '^9.0.6',
        packageName: '@types/fs-extra',
        files: [],
      },
    },
    'npm:@types/jest': {
      type: 'npm',
      name: 'npm:@types/jest',
      data: {
        version: '^26.0.16',
        packageName: '@types/jest',
        files: [],
      },
    },
    'npm:@types/js-yaml': {
      type: 'npm',
      name: 'npm:@types/js-yaml',
      data: {
        version: '^3.12.6',
        packageName: '@types/js-yaml',
        files: [],
      },
    },
    'npm:@types/lodash': {
      type: 'npm',
      name: 'npm:@types/lodash',
      data: {
        version: '^4.14.167',
        packageName: '@types/lodash',
        files: [],
      },
    },
    'npm:@types/node': {
      type: 'npm',
      name: 'npm:@types/node',
      data: {
        version: '^14.14.20',
        packageName: '@types/node',
        files: [],
      },
    },
    'npm:@types/node-cleanup': {
      type: 'npm',
      name: 'npm:@types/node-cleanup',
      data: {
        version: '^2.1.1',
        packageName: '@types/node-cleanup',
        files: [],
      },
    },
    'npm:@types/prompts': {
      type: 'npm',
      name: 'npm:@types/prompts',
      data: {
        version: '^2.0.9',
        packageName: '@types/prompts',
        files: [],
      },
    },
    'npm:@types/semver': {
      type: 'npm',
      name: 'npm:@types/semver',
      data: {
        version: '^7.3.4',
        packageName: '@types/semver',
        files: [],
      },
    },
    'npm:@types/serve-static': {
      type: 'npm',
      name: 'npm:@types/serve-static',
      data: {
        version: '^1.13.8',
        packageName: '@types/serve-static',
        files: [],
      },
    },
    'npm:@types/shelljs': {
      type: 'npm',
      name: 'npm:@types/shelljs',
      data: {
        version: '^0.8.7',
        packageName: '@types/shelljs',
        files: [],
      },
    },
    'npm:@types/webpack-dev-middleware': {
      type: 'npm',
      name: 'npm:@types/webpack-dev-middleware',
      data: {
        version: '^3.7.3',
        packageName: '@types/webpack-dev-middleware',
        files: [],
      },
    },
    'npm:@types/webpack-env': {
      type: 'npm',
      name: 'npm:@types/webpack-env',
      data: {
        version: '^1.16.0',
        packageName: '@types/webpack-env',
        files: [],
      },
    },
    'npm:babel-core': {
      type: 'npm',
      name: 'npm:babel-core',
      data: {
        version: '^7.0.0-bridge.0',
        packageName: 'babel-core',
        files: [],
      },
    },
    'npm:babel-eslint': {
      type: 'npm',
      name: 'npm:babel-eslint',
      data: {
        version: '^10.1.0',
        packageName: 'babel-eslint',
        files: [],
      },
    },
    'npm:babel-jest': {
      type: 'npm',
      name: 'npm:babel-jest',
      data: {
        version: '^26.6.3',
        packageName: 'babel-jest',
        files: [],
      },
    },
    'npm:babel-loader': {
      type: 'npm',
      name: 'npm:babel-loader',
      data: {
        version: '^8.2.2',
        packageName: 'babel-loader',
        files: [],
      },
    },
    'npm:babel-plugin-add-react-displayname': {
      type: 'npm',
      name: 'npm:babel-plugin-add-react-displayname',
      data: {
        version: '^0.0.5',
        packageName: 'babel-plugin-add-react-displayname',
        files: [],
      },
    },
    'npm:babel-plugin-dynamic-import-node': {
      type: 'npm',
      name: 'npm:babel-plugin-dynamic-import-node',
      data: {
        version: '^2.3.3',
        packageName: 'babel-plugin-dynamic-import-node',
        files: [],
      },
    },
    'npm:babel-plugin-emotion': {
      type: 'npm',
      name: 'npm:babel-plugin-emotion',
      data: {
        version: '^10.0.33',
        packageName: 'babel-plugin-emotion',
        files: [],
      },
    },
    'npm:babel-plugin-macros': {
      type: 'npm',
      name: 'npm:babel-plugin-macros',
      data: {
        version: '^3.0.1',
        packageName: 'babel-plugin-macros',
        files: [],
      },
    },
    'npm:babel-plugin-require-context-hook': {
      type: 'npm',
      name: 'npm:babel-plugin-require-context-hook',
      data: {
        version: '^1.0.0',
        packageName: 'babel-plugin-require-context-hook',
        files: [],
      },
    },
    'npm:chalk': {
      type: 'npm',
      name: 'npm:chalk',
      data: {
        version: '^4.1.0',
        packageName: 'chalk',
        files: [],
      },
    },
    'npm:chromatic': {
      type: 'npm',
      name: 'npm:chromatic',
      data: {
        version: '^5.6.0',
        packageName: 'chromatic',
        files: [],
      },
    },
    'npm:codecov': {
      type: 'npm',
      name: 'npm:codecov',
      data: {
        version: '^3.8.1',
        packageName: 'codecov',
        files: [],
      },
    },
    'npm:commander': {
      type: 'npm',
      name: 'npm:commander',
      data: {
        version: '^6.2.1',
        packageName: 'commander',
        files: [],
      },
    },
    'npm:concurrently': {
      type: 'npm',
      name: 'npm:concurrently',
      data: {
        version: '^5.3.0',
        packageName: 'concurrently',
        files: [],
      },
    },
    'npm:core-js': {
      type: 'npm',
      name: 'npm:core-js',
      data: {
        version: '^3.8.2',
        packageName: 'core-js',
        files: [],
      },
    },
    'npm:cross-env': {
      type: 'npm',
      name: 'npm:cross-env',
      data: {
        version: '^7.0.3',
        packageName: 'cross-env',
        files: [],
      },
    },
    'npm:danger': {
      type: 'npm',
      name: 'npm:danger',
      data: {
        version: '^10.6.2',
        packageName: 'danger',
        files: [],
      },
    },
    'npm:detect-port': {
      type: 'npm',
      name: 'npm:detect-port',
      data: {
        version: '^1.3.0',
        packageName: 'detect-port',
        files: [],
      },
    },
    'npm:downlevel-dts': {
      type: 'npm',
      name: 'npm:downlevel-dts',
      data: {
        version: '^0.6.0',
        packageName: 'downlevel-dts',
        files: [],
      },
    },
    'npm:enquirer': {
      type: 'npm',
      name: 'npm:enquirer',
      data: {
        version: '^2.3.6',
        packageName: 'enquirer',
        files: [],
      },
    },
    'npm:enzyme': {
      type: 'npm',
      name: 'npm:enzyme',
      data: {
        version: '^3.11.0',
        packageName: 'enzyme',
        files: [],
      },
    },
    'npm:enzyme-adapter-react-16': {
      type: 'npm',
      name: 'npm:enzyme-adapter-react-16',
      data: {
        version: '^1.15.5',
        packageName: 'enzyme-adapter-react-16',
        files: [],
      },
    },
    'npm:eslint': {
      type: 'npm',
      name: 'npm:eslint',
      data: {
        version: '^7.17.0',
        packageName: 'eslint',
        files: [],
      },
    },
    'npm:eslint-plugin-cypress': {
      type: 'npm',
      name: 'npm:eslint-plugin-cypress',
      data: {
        version: '^2.11.2',
        packageName: 'eslint-plugin-cypress',
        files: [],
      },
    },
    'npm:eslint-plugin-import': {
      type: 'npm',
      name: 'npm:eslint-plugin-import',
      data: {
        version: '^2.22.1',
        packageName: 'eslint-plugin-import',
        files: [],
      },
    },
    'npm:eslint-plugin-react': {
      type: 'npm',
      name: 'npm:eslint-plugin-react',
      data: {
        version: '^7.22.0',
        packageName: 'eslint-plugin-react',
        files: [],
      },
    },
    'npm:eslint-teamcity': {
      type: 'npm',
      name: 'npm:eslint-teamcity',
      data: {
        version: '^3.0.1',
        packageName: 'eslint-teamcity',
        files: [],
      },
    },
    'npm:esm': {
      type: 'npm',
      name: 'npm:esm',
      data: {
        version: '^3.2.25',
        packageName: 'esm',
        files: [],
      },
    },
    'npm:express': {
      type: 'npm',
      name: 'npm:express',
      data: {
        version: '^4.17.1',
        packageName: 'express',
        files: [],
      },
    },
    'npm:fs-extra': {
      type: 'npm',
      name: 'npm:fs-extra',
      data: {
        version: '^9.0.1',
        packageName: 'fs-extra',
        files: [],
      },
    },
    'npm:github-release-from-changelog': {
      type: 'npm',
      name: 'npm:github-release-from-changelog',
      data: {
        version: '^2.1.1',
        packageName: 'github-release-from-changelog',
        files: [],
      },
    },
    'npm:glob': {
      type: 'npm',
      name: 'npm:glob',
      data: {
        version: '^7.1.6',
        packageName: 'glob',
        files: [],
      },
    },
    'npm:http-server': {
      type: 'npm',
      name: 'npm:http-server',
      data: {
        version: '^0.12.3',
        packageName: 'http-server',
        files: [],
      },
    },
    'npm:husky': {
      type: 'npm',
      name: 'npm:husky',
      data: {
        version: '^4.3.7',
        packageName: 'husky',
        files: [],
      },
    },
    'npm:jest': {
      type: 'npm',
      name: 'npm:jest',
      data: {
        version: '^26.6.3',
        packageName: 'jest',
        files: [],
      },
    },
    'npm:jest-emotion': {
      type: 'npm',
      name: 'npm:jest-emotion',
      data: {
        version: '^10.0.32',
        packageName: 'jest-emotion',
        files: [],
      },
    },
    'npm:jest-environment-jsdom': {
      type: 'npm',
      name: 'npm:jest-environment-jsdom',
      data: {
        version: '^26.6.2',
        packageName: 'jest-environment-jsdom',
        files: [],
      },
    },
    'npm:jest-environment-jsdom-thirteen': {
      type: 'npm',
      name: 'npm:jest-environment-jsdom-thirteen',
      data: {
        version: '^1.0.1',
        packageName: 'jest-environment-jsdom-thirteen',
        files: [],
      },
    },
    'npm:jest-enzyme': {
      type: 'npm',
      name: 'npm:jest-enzyme',
      data: {
        version: '^7.1.2',
        packageName: 'jest-enzyme',
        files: [],
      },
    },
    'npm:jest-image-snapshot': {
      type: 'npm',
      name: 'npm:jest-image-snapshot',
      data: {
        version: '^4.3.0',
        packageName: 'jest-image-snapshot',
        files: [],
      },
    },
    'npm:jest-jasmine2': {
      type: 'npm',
      name: 'npm:jest-jasmine2',
      data: {
        version: '^26.6.3',
        packageName: 'jest-jasmine2',
        files: [],
      },
    },
    'npm:jest-raw-loader': {
      type: 'npm',
      name: 'npm:jest-raw-loader',
      data: {
        version: '^1.0.1',
        packageName: 'jest-raw-loader',
        files: [],
      },
    },
    'npm:jest-serializer-html': {
      type: 'npm',
      name: 'npm:jest-serializer-html',
      data: {
        version: '^7.0.0',
        packageName: 'jest-serializer-html',
        files: [],
      },
    },
    'npm:jest-teamcity': {
      type: 'npm',
      name: 'npm:jest-teamcity',
      data: {
        version: '^1.9.0',
        packageName: 'jest-teamcity',
        files: [],
      },
    },
    'npm:jest-watch-typeahead': {
      type: 'npm',
      name: 'npm:jest-watch-typeahead',
      data: {
        version: '^0.6.1',
        packageName: 'jest-watch-typeahead',
        files: [],
      },
    },
    'npm:js-yaml': {
      type: 'npm',
      name: 'npm:js-yaml',
      data: {
        version: '^3.14.1',
        packageName: 'js-yaml',
        files: [],
      },
    },
    'npm:lerna': {
      type: 'npm',
      name: 'npm:lerna',
      data: {
        version: '^3.22.1',
        packageName: 'lerna',
        files: [],
      },
    },
    'npm:lint-staged': {
      type: 'npm',
      name: 'npm:lint-staged',
      data: {
        version: '^10.5.4',
        packageName: 'lint-staged',
        files: [],
      },
    },
    'npm:lodash': {
      type: 'npm',
      name: 'npm:lodash',
      data: {
        version: '^4.17.20',
        packageName: 'lodash',
        files: [],
      },
    },
    'npm:mocha-list-tests': {
      type: 'npm',
      name: 'npm:mocha-list-tests',
      data: {
        version: '^1.0.5',
        packageName: 'mocha-list-tests',
        files: [],
      },
    },
    'npm:node-cleanup': {
      type: 'npm',
      name: 'npm:node-cleanup',
      data: {
        version: '^2.1.2',
        packageName: 'node-cleanup',
        files: [],
      },
    },
    'npm:node-fetch': {
      type: 'npm',
      name: 'npm:node-fetch',
      data: {
        version: '^2.6.1',
        packageName: 'node-fetch',
        files: [],
      },
    },
    'npm:npmlog': {
      type: 'npm',
      name: 'npm:npmlog',
      data: {
        version: '^4.1.2',
        packageName: 'npmlog',
        files: [],
      },
    },
    'npm:p-limit': {
      type: 'npm',
      name: 'npm:p-limit',
      data: {
        version: '^3.1.0',
        packageName: 'p-limit',
        files: [],
      },
    },
    'npm:postcss-loader': {
      type: 'npm',
      name: 'npm:postcss-loader',
      data: {
        version: '^4.2.0',
        packageName: 'postcss-loader',
        files: [],
      },
    },
    'npm:prettier': {
      type: 'npm',
      name: 'npm:prettier',
      data: {
        version: '~2.2.1',
        packageName: 'prettier',
        files: [],
      },
    },
    'npm:prompts': {
      type: 'npm',
      name: 'npm:prompts',
      data: {
        version: '^2.4.0',
        packageName: 'prompts',
        files: [],
      },
    },
    'npm:raf': {
      type: 'npm',
      name: 'npm:raf',
      data: {
        version: '^3.4.1',
        packageName: 'raf',
        files: [],
      },
    },
    'npm:regenerator-runtime': {
      type: 'npm',
      name: 'npm:regenerator-runtime',
      data: {
        version: '^0.13.7',
        packageName: 'regenerator-runtime',
        files: [],
      },
    },
    'npm:remark': {
      type: 'npm',
      name: 'npm:remark',
      data: {
        version: '^13.0.0',
        packageName: 'remark',
        files: [],
      },
    },
    'npm:remark-cli': {
      type: 'npm',
      name: 'npm:remark-cli',
      data: {
        version: '^9.0.0',
        packageName: 'remark-cli',
        files: [],
      },
    },
    'npm:remark-lint': {
      type: 'npm',
      name: 'npm:remark-lint',
      data: {
        version: '^8.0.0',
        packageName: 'remark-lint',
        files: [],
      },
    },
    'npm:remark-preset-lint-recommended': {
      type: 'npm',
      name: 'npm:remark-preset-lint-recommended',
      data: {
        version: '^5.0.0',
        packageName: 'remark-preset-lint-recommended',
        files: [],
      },
    },
    'npm:riot-jest-transformer': {
      type: 'npm',
      name: 'npm:riot-jest-transformer',
      data: {
        version: '^2.0.0',
        packageName: 'riot-jest-transformer',
        files: [],
      },
    },
    'npm:serve-static': {
      type: 'npm',
      name: 'npm:serve-static',
      data: {
        version: '^1.14.1',
        packageName: 'serve-static',
        files: [],
      },
    },
    'npm:shelljs': {
      type: 'npm',
      name: 'npm:shelljs',
      data: {
        version: '^0.8.4',
        packageName: 'shelljs',
        files: [],
      },
    },
    'npm:shx': {
      type: 'npm',
      name: 'npm:shx',
      data: {
        version: '^0.3.2',
        packageName: 'shx',
        files: [],
      },
    },
    'npm:sort-package-json': {
      type: 'npm',
      name: 'npm:sort-package-json',
      data: {
        version: '^1.48.1',
        packageName: 'sort-package-json',
        files: [],
      },
    },
    'npm:teamcity-service-messages': {
      type: 'npm',
      name: 'npm:teamcity-service-messages',
      data: {
        version: '^0.1.11',
        packageName: 'teamcity-service-messages',
        files: [],
      },
    },
    'npm:trash': {
      type: 'npm',
      name: 'npm:trash',
      data: {
        version: '^7.0.0',
        packageName: 'trash',
        files: [],
      },
    },
    'npm:ts-dedent': {
      type: 'npm',
      name: 'npm:ts-dedent',
      data: {
        version: '^2.0.0',
        packageName: 'ts-dedent',
        files: [],
      },
    },
    'npm:ts-jest': {
      type: 'npm',
      name: 'npm:ts-jest',
      data: {
        version: '^26.4.4',
        packageName: 'ts-jest',
        files: [],
      },
    },
    'npm:ts-node': {
      type: 'npm',
      name: 'npm:ts-node',
      data: {
        version: '^9.1.0',
        packageName: 'ts-node',
        files: [],
      },
    },
    'npm:typescript': {
      type: 'npm',
      name: 'npm:typescript',
      data: {
        version: '^3.9.7',
        packageName: 'typescript',
        files: [],
      },
    },
    'npm:wait-on': {
      type: 'npm',
      name: 'npm:wait-on',
      data: {
        version: '^5.2.1',
        packageName: 'wait-on',
        files: [],
      },
    },
    'npm:webpack': {
      type: 'npm',
      name: 'npm:webpack',
      data: {
        version: '4',
        packageName: 'webpack',
        files: [],
      },
    },
    'npm:webpack-dev-middleware': {
      type: 'npm',
      name: 'npm:webpack-dev-middleware',
      data: {
        version: '^3.7.3',
        packageName: 'webpack-dev-middleware',
        files: [],
      },
    },
    'npm:window-size': {
      type: 'npm',
      name: 'npm:window-size',
      data: {
        version: '^1.1.1',
        packageName: 'window-size',
        files: [],
      },
    },
    'npm:@nrwl/workspace': {
      type: 'npm',
      name: 'npm:@nrwl/workspace',
      data: {
        version: '^11.6.1',
        packageName: '@nrwl/workspace',
        files: [],
      },
    },
    'npm:@nrwl/cli': {
      type: 'npm',
      name: 'npm:@nrwl/cli',
      data: {
        version: '^11.6.1',
        packageName: '@nrwl/cli',
        files: [],
      },
    },
    'npm:@nrwl/tao': {
      type: 'npm',
      name: 'npm:@nrwl/tao',
      data: {
        version: '^11.6.1',
        packageName: '@nrwl/tao',
        files: [],
      },
    },
    'npm:@nrwl/nx-cloud': {
      type: 'npm',
      name: 'npm:@nrwl/nx-cloud',
      data: {
        version: '^11.2.0',
        packageName: '@nrwl/nx-cloud',
        files: [],
      },
    },
  },
  dependencies: {
    '@storybook/addon-storyshots-puppeteer': [
      {
        type: 'static',
        source: '@storybook/addon-storyshots-puppeteer',
        target: 'npm:jest-image-snapshot',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots-puppeteer',
        target: '@storybook/node-logger',
      },
    ],
    'web-components-kitchen-sink': [
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/web-components',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-events',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-jest',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: 'web-components-kitchen-sink',
        target: '@storybook/source-loader',
      },
    ],
    '@storybook/addon-storyshots': [
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: 'npm:glob',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: '@storybook/angular',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: '@storybook/core-common',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: 'npm:babel-plugin-require-context-hook',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: 'npm:enzyme',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: 'npm:jest-emotion',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: '@storybook/vue',
      },
      {
        type: 'static',
        source: '@storybook/addon-storyshots',
        target: '@storybook/vue3',
      },
    ],
    '@storybook/addon-preview-wrapper': [
      {
        type: 'static',
        source: '@storybook/addon-preview-wrapper',
        target: '@storybook/addons',
      },
    ],
    'aurelia-kitchen-sink': [
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/aurelia',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addon-jest',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'aurelia-kitchen-sink',
        target: '@storybook/source-loader',
      },
    ],
    'mithril-example': [
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/mithril',
      },
      {
        type: 'static',
        source: 'mithril-example',
        target: '@storybook/source-loader',
      },
    ],
    'cra-ts-kitchen-sink': [
      {
        type: 'static',
        source: 'cra-ts-kitchen-sink',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'cra-ts-kitchen-sink',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: 'cra-ts-kitchen-sink',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: 'cra-ts-kitchen-sink',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'cra-ts-kitchen-sink',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'cra-ts-kitchen-sink',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'cra-ts-kitchen-sink',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'cra-ts-kitchen-sink',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'cra-ts-kitchen-sink',
        target: '@storybook/builder-webpack4',
      },
    ],
    'preact-example': [
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/preact',
      },
      {
        type: 'static',
        source: 'preact-example',
        target: '@storybook/source-loader',
      },
    ],
    'server-kitchen-sink': [
      {
        type: 'static',
        source: 'server-kitchen-sink',
        target: 'npm:express',
      },
      {
        type: 'static',
        source: 'server-kitchen-sink',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: 'server-kitchen-sink',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'server-kitchen-sink',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'server-kitchen-sink',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'server-kitchen-sink',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: 'server-kitchen-sink',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'server-kitchen-sink',
        target: '@storybook/server',
      },
    ],
    'svelte-example': [
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/svelte',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'svelte-example',
        target: '@storybook/source-loader',
      },
    ],
    'official-storybook': [
      {
        type: 'static',
        source: 'official-storybook',
        target: 'npm:express',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: 'npm:chromatic',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-cssresources',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-design-assets',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-events',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-graphql',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-jest',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-queryparams',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-storyshots-puppeteer',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-toolbars',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/cli',
      },
      {
        type: 'static',
        source: 'official-storybook',
        target: '@storybook/source-loader',
      },
    ],
    'standalone-preview': [
      {
        type: 'static',
        source: 'standalone-preview',
        target: '@storybook/react',
      },
    ],
    'cra-ts-essentials': [
      {
        type: 'static',
        source: 'cra-ts-essentials',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: 'cra-ts-essentials',
        target: '@storybook/addon-essentials',
      },
      {
        type: 'static',
        source: 'cra-ts-essentials',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'cra-ts-essentials',
        target: '@storybook/builder-webpack4',
      },
    ],
    'html-kitchen-sink': [
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/html',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-events',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-jest',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: 'html-kitchen-sink',
        target: '@storybook/source-loader',
      },
    ],
    '@storybook/example-react-ts-webpack4': [
      {
        type: 'static',
        source: '@storybook/example-react-ts-webpack4',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/example-react-ts-webpack4',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: '@storybook/example-react-ts-webpack4',
        target: '@storybook/addon-essentials',
      },
      {
        type: 'static',
        source: '@storybook/example-react-ts-webpack4',
        target: '@storybook/builder-webpack4',
      },
    ],
    'riot-example': [
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/riot',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'riot-example',
        target: '@storybook/source-loader',
      },
    ],
    'cra-kitchen-sink': [
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addon-events',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addon-jest',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'cra-kitchen-sink',
        target: '@storybook/builder-webpack4',
      },
    ],
    'rax-kitchen-sink': [
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-events',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-jest',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/rax',
      },
      {
        type: 'static',
        source: 'rax-kitchen-sink',
        target: '@storybook/source-loader',
      },
    ],
    'vue-example': [
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/vue',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'vue-example',
        target: '@storybook/source-loader',
      },
    ],
    '@storybook/addon-decorator': [
      {
        type: 'static',
        source: '@storybook/addon-decorator',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/addon-decorator',
        target: '@storybook/addons',
      },
    ],
    '@storybook/addon-parameter': [
      {
        type: 'static',
        source: '@storybook/addon-parameter',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-parameter',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-parameter',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-parameter',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-parameter',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-parameter',
        target: '@storybook/theming',
      },
    ],
    '@storybook/addon-roundtrip': [
      {
        type: 'static',
        source: '@storybook/addon-roundtrip',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/addon-roundtrip',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-roundtrip',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-roundtrip',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-roundtrip',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-roundtrip',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-roundtrip',
        target: '@storybook/theming',
      },
    ],
    '@storybook/addon-google-analytics': [
      {
        type: 'static',
        source: '@storybook/addon-google-analytics',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-google-analytics',
        target: '@storybook/core-events',
      },
    ],
    '@storybook/channel-postmessage': [
      {
        type: 'static',
        source: '@storybook/channel-postmessage',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/channel-postmessage',
        target: '@storybook/channels',
      },
      {
        type: 'static',
        source: '@storybook/channel-postmessage',
        target: '@storybook/client-logger',
      },
    ],
    '@storybook/channel-websocket': [
      {
        type: 'static',
        source: '@storybook/channel-websocket',
        target: '@storybook/channels',
      },
    ],
    '@storybook/addon-design-assets': [
      {
        type: 'static',
        source: '@storybook/addon-design-assets',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-design-assets',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-design-assets',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-design-assets',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-design-assets',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-design-assets',
        target: '@storybook/core-events',
      },
    ],
    'angular-cli': [
      {
        type: 'static',
        source: 'angular-cli',
        target: 'npm:babel-plugin-require-context-hook',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: 'npm:ts-node',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/angular',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-jest',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-storyshots',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'angular-cli',
        target: '@storybook/source-loader',
      },
    ],
    'cra-react15': [
      {
        type: 'static',
        source: 'cra-react15',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: 'cra-react15',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'cra-react15',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: 'cra-react15',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'cra-react15',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'cra-react15',
        target: '@storybook/builder-webpack4',
      },
    ],
    '@storybook/builder-webpack4': [
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: 'npm:webpack-dev-middleware',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/core-common',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/channel-postmessage',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/channels',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/router',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack4',
        target: '@storybook/ui',
      },
    ],
    '@storybook/builder-webpack5': [
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: 'npm:webpack-dev-middleware',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/core-common',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/channel-postmessage',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/channels',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/builder-webpack5',
        target: '@storybook/router',
      },
    ],
    '@storybook/addon-cssresources': [
      {
        type: 'static',
        source: '@storybook/addon-cssresources',
        target: 'npm:@testing-library/user-event',
      },
      {
        type: 'static',
        source: '@storybook/addon-cssresources',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: '@storybook/addon-cssresources',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-cssresources',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-cssresources',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-cssresources',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-cssresources',
        target: '@storybook/addons',
      },
    ],
    '@storybook/addon-backgrounds': [
      {
        type: 'static',
        source: '@storybook/addon-backgrounds',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-backgrounds',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-backgrounds',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-backgrounds',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-backgrounds',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-backgrounds',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/addon-backgrounds',
        target: '@storybook/core-events',
      },
    ],
    '@storybook/addon-queryparams': [
      {
        type: 'static',
        source: '@storybook/addon-queryparams',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-queryparams',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-queryparams',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-queryparams',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-queryparams',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-queryparams',
        target: '@storybook/theming',
      },
    ],
    '@storybook/addon-storysource': [
      {
        type: 'static',
        source: '@storybook/addon-storysource',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-storysource',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-storysource',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-storysource',
        target: '@storybook/router',
      },
      {
        type: 'static',
        source: '@storybook/addon-storysource',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-storysource',
        target: '@storybook/source-loader',
      },
      {
        type: 'static',
        source: '@storybook/addon-storysource',
        target: '@storybook/client-logger',
      },
    ],
    '@storybook/web-components': [
      {
        type: 'static',
        source: '@storybook/web-components',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/web-components',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/web-components',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/web-components',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/web-components',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/web-components',
        target: '@storybook/core-common',
      },
    ],
    'ember-example': [
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/ember',
      },
      {
        type: 'static',
        source: 'ember-example',
        target: '@storybook/source-loader',
      },
    ],
    'marko-cli': [
      {
        type: 'static',
        source: 'marko-cli',
        target: '@storybook/addon-a11y',
      },
      {
        type: 'static',
        source: 'marko-cli',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'marko-cli',
        target: '@storybook/addon-knobs',
      },
      {
        type: 'static',
        source: 'marko-cli',
        target: '@storybook/addon-storysource',
      },
      {
        type: 'static',
        source: 'marko-cli',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: 'marko-cli',
        target: '@storybook/marko',
      },
      {
        type: 'static',
        source: 'marko-cli',
        target: '@storybook/source-loader',
      },
    ],
    'vue-3-cli-example': [
      {
        type: 'static',
        source: 'vue-3-cli-example',
        target: '@storybook/vue3',
      },
      {
        type: 'static',
        source: 'vue-3-cli-example',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: 'vue-3-cli-example',
        target: '@storybook/addon-essentials',
      },
      {
        type: 'static',
        source: 'vue-3-cli-example',
        target: '@storybook/addon-links',
      },
      {
        type: 'static',
        source: 'vue-3-cli-example',
        target: '@storybook/addon-storyshots',
      },
    ],
    '@storybook/addon-essentials': [
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/addon-actions',
      },
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/addon-backgrounds',
      },
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/addon-docs',
      },
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/addon-toolbars',
      },
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/addon-viewport',
      },
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-essentials',
        target: '@storybook/vue',
      },
    ],
    '@storybook/example-devkits': [
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/addon-roundtrip',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/addon-decorator',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/addon-parameter',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/addon-preview-wrapper',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/example-devkits',
        target: '@storybook/node-logger',
      },
    ],
    '@storybook/example-react-ts': [
      {
        type: 'static',
        source: '@storybook/example-react-ts',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/example-react-ts',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: '@storybook/example-react-ts',
        target: '@storybook/addon-essentials',
      },
    ],
    storybook: [
      {
        type: 'static',
        source: 'storybook',
        target: '@storybook/cli',
      },
    ],
    '@storybook/client-logger': [],
    '@storybook/source-loader': [
      {
        type: 'static',
        source: '@storybook/source-loader',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/source-loader',
        target: 'npm:prettier',
      },
      {
        type: 'static',
        source: '@storybook/source-loader',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/source-loader',
        target: '@storybook/client-logger',
      },
    ],
    'vue-cli-example': [
      {
        type: 'static',
        source: 'vue-cli-example',
        target: '@storybook/vue',
      },
      {
        type: 'static',
        source: 'vue-cli-example',
        target: '@storybook/addon-controls',
      },
      {
        type: 'static',
        source: 'vue-cli-example',
        target: '@storybook/addon-essentials',
      },
      {
        type: 'static',
        source: 'vue-cli-example',
        target: '@storybook/source-loader',
      },
    ],
    '@storybook/addon-controls': [
      {
        type: 'static',
        source: '@storybook/addon-controls',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-controls',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-controls',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-controls',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/addon-controls',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-controls',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/addon-controls',
        target: '@storybook/theming',
      },
    ],
    '@storybook/addon-toolbars': [
      {
        type: 'static',
        source: '@storybook/addon-toolbars',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-toolbars',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-toolbars',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-toolbars',
        target: '@storybook/client-api',
      },
    ],
    '@storybook/addon-viewport': [
      {
        type: 'static',
        source: '@storybook/addon-viewport',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-viewport',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-viewport',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-viewport',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-viewport',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-viewport',
        target: '@storybook/core-events',
      },
    ],
    '@storybook/core-client': [
      {
        type: 'static',
        source: '@storybook/core-client',
        target: '@storybook/ui',
      },
      {
        type: 'static',
        source: '@storybook/core-client',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/core-client',
        target: '@storybook/channel-postmessage',
      },
      {
        type: 'static',
        source: '@storybook/core-client',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/core-client',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/core-client',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/core-client',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/core-client',
        target: 'npm:lodash',
      },
    ],
    '@storybook/core-common': [
      {
        type: 'static',
        source: '@storybook/core-common',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/core-common',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/core-common',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/core-common',
        target: 'npm:@babel/core',
      },
      {
        type: 'static',
        source: '@storybook/core-common',
        target: 'npm:express',
      },
      {
        type: 'static',
        source: '@storybook/core-common',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: '@storybook/core-common',
        target: 'npm:@storybook/semver',
      },
      {
        type: 'static',
        source: '@storybook/core-common',
        target: 'npm:chalk',
      },
      {
        type: 'static',
        source: '@storybook/core-common',
        target: 'npm:glob',
      },
    ],
    '@storybook/core-events': [],
    '@storybook/core-server': [
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/core-common',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:prompts',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:chalk',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:commander',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/builder-webpack4',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/vue3',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/html',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/web-components',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:express',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:regenerator-runtime',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:webpack-dev-middleware',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:node-fetch',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/ui',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:@storybook/semver',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: 'npm:detect-port',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/core-client',
      },
      {
        type: 'static',
        source: '@storybook/core-server',
        target: '@storybook/builder-webpack5',
      },
    ],
    '@storybook/node-logger': [
      {
        type: 'static',
        source: '@storybook/node-logger',
        target: 'npm:npmlog',
      },
      {
        type: 'static',
        source: '@storybook/node-logger',
        target: 'npm:chalk',
      },
    ],
    '@storybook/postinstall': [],
    '@storybook/addon-actions': [
      {
        type: 'static',
        source: '@storybook/addon-actions',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-actions',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-actions',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-actions',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-actions',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-actions',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/addon-actions',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/addon-actions',
        target: 'npm:ts-dedent',
      },
    ],
    '@storybook/addon-graphql': [
      {
        type: 'static',
        source: '@storybook/addon-graphql',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/addon-graphql',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-graphql',
        target: '@storybook/addons',
      },
    ],
    '@storybook/marionette': [
      {
        type: 'static',
        source: '@storybook/marionette',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/marionette',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/marionette',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/client-api': [
      {
        type: 'static',
        source: '@storybook/client-api',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/client-api',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/client-api',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/client-api',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/client-api',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/client-api',
        target: '@storybook/channel-postmessage',
      },
      {
        type: 'static',
        source: '@storybook/client-api',
        target: '@storybook/channels',
      },
    ],
    '@storybook/components': [
      {
        type: 'static',
        source: '@storybook/components',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/components',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/components',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/components',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/components',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/components',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/components',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: '@storybook/components',
        target: 'npm:@testing-library/user-event',
      },
    ],
    '@storybook/addon-events': [
      {
        type: 'static',
        source: '@storybook/addon-events',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/addon-events',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-events',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-events',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-events',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-events',
        target: '@storybook/client-api',
      },
    ],
    '@storybook/addon-knobs': [
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: 'npm:enzyme',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: 'npm:@testing-library/user-event',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: '@storybook/channels',
      },
      {
        type: 'static',
        source: '@storybook/addon-knobs',
        target: 'npm:lodash',
      },
    ],
    '@storybook/addon-links': [
      {
        type: 'static',
        source: '@storybook/addon-links',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/addon-links',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-links',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-links',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-links',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: '@storybook/addon-links',
        target: 'npm:@testing-library/user-event',
      },
      {
        type: 'static',
        source: '@storybook/addon-links',
        target: '@storybook/router',
      },
    ],
    '@storybook/channels': [
      {
        type: 'static',
        source: '@storybook/channels',
        target: 'npm:ts-dedent',
      },
    ],
    '@storybook/addon-a11y': [
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: '@storybook/channels',
      },
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/addon-a11y',
        target: '@storybook/client-logger',
      },
    ],
    '@storybook/addon-docs': [
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/postinstall',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/source-loader',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/angular',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: 'npm:prettier',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: 'npm:@babel/core',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/core-common',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/vue3',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/web-components',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/builder-webpack4',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/addon-docs',
        target: '@storybook/vue',
      },
    ],
    '@storybook/addon-jest': [
      {
        type: 'static',
        source: '@storybook/addon-jest',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/addon-jest',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/addon-jest',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addon-jest',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addon-jest',
        target: '@storybook/addons',
      },
    ],
    '@storybook/angular': [
      {
        type: 'static',
        source: '@storybook/angular',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/angular',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/angular',
        target: 'npm:core-js',
      },
      {
        type: 'static',
        source: '@storybook/angular',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/angular',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/angular',
        target: 'npm:typescript',
      },
      {
        type: 'static',
        source: '@storybook/angular',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/angular',
        target: 'npm:@nrwl/workspace',
      },
      {
        type: 'static',
        source: '@storybook/angular',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/angular',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/aurelia': [
      {
        type: 'static',
        source: '@storybook/aurelia',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/aurelia',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/aurelia',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/aurelia',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/aurelia',
        target: '@storybook/core-common',
      },
      {
        type: 'static',
        source: '@storybook/aurelia',
        target: '@storybook/addon-knobs',
      },
    ],
    '@storybook/mithril': [
      {
        type: 'static',
        source: '@storybook/mithril',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/mithril',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/mithril',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/mithril',
        target: 'npm:@babel/core',
      },
      {
        type: 'static',
        source: '@storybook/mithril',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/codemod': [
      {
        type: 'static',
        source: '@storybook/codemod',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/codemod',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/codemod',
        target: 'npm:prettier',
      },
      {
        type: 'static',
        source: '@storybook/codemod',
        target: '@storybook/node-logger',
      },
    ],
    '@storybook/theming': [
      {
        type: 'static',
        source: '@storybook/theming',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/theming',
        target: 'npm:ts-dedent',
      },
    ],
    '@storybook/preact': [
      {
        type: 'static',
        source: '@storybook/preact',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/preact',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/preact',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/preact',
        target: 'npm:@babel/core',
      },
      {
        type: 'static',
        source: '@storybook/preact',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/server': [
      {
        type: 'static',
        source: '@storybook/server',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/server',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/server',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/server',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/server',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/server',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: '@storybook/server',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/server',
        target: '@storybook/core-common',
      },
      {
        type: 'static',
        source: '@storybook/server',
        target: '@storybook/node-logger',
      },
    ],
    '@storybook/svelte': [
      {
        type: 'static',
        source: '@storybook/svelte',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/svelte',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/svelte',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/svelte',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/addons': [
      {
        type: 'static',
        source: '@storybook/addons',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/addons',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/addons',
        target: '@storybook/channels',
      },
      {
        type: 'static',
        source: '@storybook/addons',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/addons',
        target: '@storybook/router',
      },
      {
        type: 'static',
        source: '@storybook/addons',
        target: '@storybook/theming',
      },
    ],
    sb: [
      {
        type: 'static',
        source: 'sb',
        target: '@storybook/cli',
      },
    ],
    '@storybook/router': [
      {
        type: 'static',
        source: '@storybook/router',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/router',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/router',
        target: 'npm:ts-dedent',
      },
    ],
    '@storybook/ember': [
      {
        type: 'static',
        source: '@storybook/ember',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/ember',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/ember',
        target: 'npm:@babel/core',
      },
      {
        type: 'static',
        source: '@storybook/ember',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/marko': [
      {
        type: 'static',
        source: '@storybook/marko',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/marko',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/marko',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/marko',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/marko',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/react': [
      {
        type: 'static',
        source: '@storybook/react',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/react',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/react',
        target: 'npm:@storybook/semver',
      },
      {
        type: 'static',
        source: '@storybook/react',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/react',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/react',
        target: '@storybook/core-common',
      },
      {
        type: 'static',
        source: '@storybook/react',
        target: 'npm:@babel/core',
      },
      {
        type: 'static',
        source: '@storybook/react',
        target: '@storybook/client-api',
      },
    ],
    '@storybook/html': [
      {
        type: 'static',
        source: '@storybook/html',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/html',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/html',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/html',
        target: '@storybook/client-api',
      },
      {
        type: 'static',
        source: '@storybook/html',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/html',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/riot': [
      {
        type: 'static',
        source: '@storybook/riot',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/riot',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/riot',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/riot',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/vue3': [
      {
        type: 'static',
        source: '@storybook/vue3',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/vue3',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/vue3',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/vue3',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/vue3',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/core': [
      {
        type: 'static',
        source: '@storybook/core',
        target: '@storybook/core-client',
      },
      {
        type: 'static',
        source: '@storybook/core',
        target: '@storybook/core-server',
      },
    ],
    '@storybook/rax': [
      {
        type: 'static',
        source: '@storybook/rax',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/rax',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/rax',
        target: 'npm:@babel/core',
      },
      {
        type: 'static',
        source: '@storybook/rax',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/vue': [
      {
        type: 'static',
        source: '@storybook/vue',
        target: '@storybook/core',
      },
      {
        type: 'static',
        source: '@storybook/vue',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/vue',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/vue',
        target: 'npm:webpack',
      },
      {
        type: 'static',
        source: '@storybook/vue',
        target: '@storybook/core-common',
      },
    ],
    '@storybook/api': [
      {
        type: 'static',
        source: '@storybook/api',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/api',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/api',
        target: '@storybook/router',
      },
      {
        type: 'static',
        source: '@storybook/api',
        target: '@storybook/channels',
      },
      {
        type: 'static',
        source: '@storybook/api',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/api',
        target: 'npm:ts-dedent',
      },
      {
        type: 'static',
        source: '@storybook/api',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/api',
        target: 'npm:@storybook/semver',
      },
    ],
    '@storybook/cli': [
      {
        type: 'static',
        source: '@storybook/cli',
        target: 'npm:fs-extra',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: 'npm:express',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: '@storybook/node-logger',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: '@storybook/angular',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: '@storybook/html',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: '@storybook/marionette',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: '@storybook/riot',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: '@storybook/web-components',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: 'npm:commander',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: 'npm:chalk',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: 'npm:shelljs',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: '@storybook/codemod',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: 'npm:@storybook/semver',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: 'npm:prompts',
      },
      {
        type: 'static',
        source: '@storybook/cli',
        target: '@storybook/client-api',
      },
    ],
    '@storybook/ui': [
      {
        type: 'static',
        source: '@storybook/ui',
        target: '@storybook/api',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: '@storybook/components',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: '@storybook/router',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: '@storybook/theming',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: '@storybook/addons',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: '@storybook/react',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: 'npm:chromatic',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: 'npm:lodash',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: '@storybook/core-events',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: '@storybook/client-logger',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: 'npm:@storybook/semver',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: 'npm:enzyme',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: 'npm:@testing-library/react',
      },
      {
        type: 'static',
        source: '@storybook/ui',
        target: '@storybook/channels',
      },
    ],
    'npm:@babel/cli': [],
    'npm:@babel/core': [],
    'npm:@babel/plugin-proposal-class-properties': [],
    'npm:@babel/plugin-proposal-decorators': [],
    'npm:@babel/plugin-proposal-export-default-from': [],
    'npm:@babel/plugin-proposal-object-rest-spread': [],
    'npm:@babel/plugin-proposal-private-methods': [],
    'npm:@babel/plugin-syntax-dynamic-import': [],
    'npm:@babel/preset-env': [],
    'npm:@babel/preset-flow': [],
    'npm:@babel/preset-react': [],
    'npm:@babel/preset-typescript': [],
    'npm:@babel/runtime': [],
    'npm:@emotion/snapshot-serializer': [],
    'npm:@nicolo-ribaudo/chokidar-2': [],
    'npm:@storybook/eslint-config-storybook': [],
    'npm:@storybook/linter-config': [],
    'npm:@storybook/semver': [],
    'npm:@testing-library/dom': [],
    'npm:@testing-library/jest-dom': [],
    'npm:@testing-library/react': [],
    'npm:@testing-library/user-event': [],
    'npm:@types/detect-port': [],
    'npm:@types/doctrine': [],
    'npm:@types/enzyme': [],
    'npm:@types/escodegen': [],
    'npm:@types/express': [],
    'npm:@types/fs-extra': [],
    'npm:@types/jest': [],
    'npm:@types/js-yaml': [],
    'npm:@types/lodash': [],
    'npm:@types/node': [],
    'npm:@types/node-cleanup': [],
    'npm:@types/prompts': [],
    'npm:@types/semver': [],
    'npm:@types/serve-static': [],
    'npm:@types/shelljs': [],
    'npm:@types/webpack-dev-middleware': [],
    'npm:@types/webpack-env': [],
    'npm:babel-core': [],
    'npm:babel-eslint': [],
    'npm:babel-jest': [],
    'npm:babel-loader': [],
    'npm:babel-plugin-add-react-displayname': [],
    'npm:babel-plugin-dynamic-import-node': [],
    'npm:babel-plugin-emotion': [],
    'npm:babel-plugin-macros': [],
    'npm:babel-plugin-require-context-hook': [],
    'npm:chalk': [],
    'npm:chromatic': [],
    'npm:codecov': [],
    'npm:commander': [],
    'npm:concurrently': [],
    'npm:core-js': [],
    'npm:cross-env': [],
    'npm:danger': [],
    'npm:detect-port': [],
    'npm:downlevel-dts': [],
    'npm:enquirer': [],
    'npm:enzyme': [],
    'npm:enzyme-adapter-react-16': [],
    'npm:eslint': [],
    'npm:eslint-plugin-cypress': [],
    'npm:eslint-plugin-import': [],
    'npm:eslint-plugin-react': [],
    'npm:eslint-teamcity': [],
    'npm:esm': [],
    'npm:express': [],
    'npm:fs-extra': [],
    'npm:github-release-from-changelog': [],
    'npm:glob': [],
    'npm:http-server': [],
    'npm:husky': [],
    'npm:jest': [],
    'npm:jest-emotion': [],
    'npm:jest-environment-jsdom': [],
    'npm:jest-environment-jsdom-thirteen': [],
    'npm:jest-enzyme': [],
    'npm:jest-image-snapshot': [],
    'npm:jest-jasmine2': [],
    'npm:jest-raw-loader': [],
    'npm:jest-serializer-html': [],
    'npm:jest-teamcity': [],
    'npm:jest-watch-typeahead': [],
    'npm:js-yaml': [],
    'npm:lerna': [],
    'npm:lint-staged': [],
    'npm:lodash': [],
    'npm:mocha-list-tests': [],
    'npm:node-cleanup': [],
    'npm:node-fetch': [],
    'npm:npmlog': [],
    'npm:p-limit': [],
    'npm:postcss-loader': [],
    'npm:prettier': [],
    'npm:prompts': [],
    'npm:raf': [],
    'npm:regenerator-runtime': [],
    'npm:remark': [],
    'npm:remark-cli': [],
    'npm:remark-lint': [],
    'npm:remark-preset-lint-recommended': [],
    'npm:riot-jest-transformer': [],
    'npm:serve-static': [],
    'npm:shelljs': [],
    'npm:shx': [],
    'npm:sort-package-json': [],
    'npm:teamcity-service-messages': [],
    'npm:trash': [],
    'npm:ts-dedent': [],
    'npm:ts-jest': [],
    'npm:ts-node': [],
    'npm:typescript': [],
    'npm:wait-on': [],
    'npm:webpack': [],
    'npm:webpack-dev-middleware': [],
    'npm:window-size': [],
    'npm:@nrwl/workspace': [],
    'npm:@nrwl/cli': [],
    'npm:@nrwl/tao': [],
    'npm:@nrwl/nx-cloud': [],
  },
};
