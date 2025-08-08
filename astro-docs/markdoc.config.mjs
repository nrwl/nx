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
    call_to_action: {
      render: component('./src/components/markdoc/CallToAction.astro'),
      attributes: {
        url: {
          type: 'String',
          required: true,
        },
        title: {
          type: 'String',
          required: true,
        },
        description: {
          type: 'String',
          required: false,
        },
        icon: {
          type: 'String',
          required: false,
        },
        variant: {
          type: 'String',
          required: false,
          default: 'default',
          matches: ['default', 'gradient', 'inverted', 'gradient-alt'],
        },
        size: {
          type: 'String',
          required: false,
          default: 'sm',
          matches: ['sm', 'md', 'lg'],
        },
      },
    },
    card: {
      render: component('./src/components/markdoc/Card.astro'),
      attributes: {
        title: {
          type: 'String',
          required: true,
        },
        description: {
          type: 'String',
          default: '',
        },
        type: {
          type: 'String',
          default: 'documentation',
        },
        url: {
          type: 'String',
          default: '',
        },
      },
    },
    cards: {
      render: component('./src/components/markdoc/Cards.astro'),
      attributes: {
        cols: {
          type: 'Number',
          required: true,
        },
        smCols: {
          type: 'Number',
          required: true,
        },
        mdCols: {
          type: 'Number',
          required: true,
        },
        lgCols: {
          type: 'Number',
          required: true,
        },
        moreLink: {
          type: 'String',
          required: false,
        },
      },
    },
    link_card: {
      render: component('./src/components/markdoc/LinkCard.astro'),
      attributes: {
        title: {
          type: 'String',
          required: true,
        },
        type: {
          type: 'String',
          required: true,
        },
        icon: {
          type: 'String',
          required: false,
        },
        url: {
          type: 'String',
          default: '',
        },
        appearance: {
          type: 'String',
          default: 'default',
        },
      },
    },
    github_repository: {
      render: component('./src/components/markdoc/GithubRepository.astro'),
      attributes: {
        url: {
          type: 'String',
          required: true,
        },
        title: {
          type: 'String',
          required: false,
        },
      },
    },
    stackblitz_button: {
      render: component('./src/components/markdoc/StackblitzButton.astro'),
      attributes: {
        url: {
          type: 'String',
          required: true,
        },
        title: {
          type: 'String',
          required: false,
        },
      },
    },
    graph: {
      render: component('./src/components/markdoc/Graph.astro'),
      children: [],
      attributes: {
        jsonFile: {
          type: 'String',
        },
        title: {
          type: 'String',
        },
        type: {
          type: 'String',
          matches: ['project', 'task'],
          default: 'project',
        },
        height: {
          type: 'String',
          required: true,
        },
      },
    },
    iframe: {
      render: component('./src/components/markdoc/Iframe.astro'),
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
          default: '50%',
        },
      },
    },
    video_player: {
      render: component('./src/components/markdoc/VideoPlayer.astro'),
      attributes: {
        src: {
          type: 'String',
          required: true,
        },
        alt: {
          type: 'String',
          required: false,
        },
        link: {
          type: 'String',
          required: false,
        },
        showDescription: {
          type: 'Boolean',
          required: false,
          default: false,
        },
        showControls: {
          type: 'Boolean',
          required: false,
          default: false,
        },
        autoPlay: {
          type: 'Boolean',
          required: false,
          default: false,
        },
        loop: {
          type: 'Boolean',
          required: false,
          default: false,
        },
      },
    },
    persona: {
      render: component('./src/components/markdoc/Persona.astro'),
      children: ['paragraph', 'tag', 'list'],
      attributes: {
        title: {
          type: 'String',
        },
        type: {
          type: 'String',
          default: 'integrated',
          required: true,
          matches: [
            'cache',
            'distribute',
            'javascript',
            'lerna',
            'react',
            'angular',
            'integrated',
          ],
          errorLevel: 'critical',
        },
        url: {
          type: 'String',
          required: true,
          errorLevel: 'critical',
        },
      },
    },
    personas: {
      render: component('./src/components/markdoc/Personas.astro'),
    },
    project_details: {
      render: component('./src/components/markdoc/ProjectDetails.astro'),
      children: [],
      attributes: {
        jsonFile: {
          type: 'String',
        },
        title: {
          type: 'String',
        },
        height: {
          type: 'String',
        },
        expandedTargets: {
          type: 'Array',
        },
      },
    },
    pill: {
      render: component('./src/components/markdoc/Pill.astro'),
      attributes: {
        url: {
          type: 'String',
          default: '',
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
