import { defineMarkdocConfig, component } from '@astrojs/markdoc/config';
import starlightMarkdoc from '@astrojs/starlight-markdoc';

export default defineMarkdocConfig({
  extends: [starlightMarkdoc()],
  tags: {
    callout: {
      render: component('./src/components/markdoc/Callout.astro'),
      children: ['paragraph', 'tag', 'list'],
      attributes: {
        type: {
          type: 'String',
          default: 'note',
          matches: [
            'announcement',
            'caution',
            'check',
            'note',
            'warning',
            'deepdive',
          ],
          errorLevel: 'critical',
        },
        title: {
          type: 'String',
          required: true,
        },
        expanded: {
          type: 'Boolean',
          default: false,
        },
      },
    },
    install_nx_console: {
      render: component('./src/components/markdoc/InstallNxConsole.astro'),
      attributes: {},
    },
    youtube: {
      render: component('./src/components/markdoc/Youtube.astro'),
      attributes: {
        src: {
          type: 'String',
          required: true,
        },
        title: {
          type: 'String',
          required: true,
        },
        width: {
          type: 'String',
          default: '100%',
        },
        caption: {
          type: 'String',
          required: false,
        },
      },
    },
  },
});
