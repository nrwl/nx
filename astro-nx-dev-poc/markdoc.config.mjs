import { defineMarkdocConfig, component } from '@astrojs/markdoc/config';
import starlightMarkdoc from '@astrojs/starlight-markdoc';

export default defineMarkdocConfig({
  extends: [starlightMarkdoc()],
  tags: {
    youtube: {
      render: component('./src/components/Youtube.astro'),
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
