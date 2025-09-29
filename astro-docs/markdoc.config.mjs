import {
  defineMarkdocConfig,
  component,
  Markdoc,
} from '@astrojs/markdoc/config';
import starlightMarkdoc from '@astrojs/starlight-markdoc';

export default defineMarkdocConfig({
  extends: [starlightMarkdoc()],
  tags: {
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
          matches: [
            'default',
            'gradient',
            'inverted',
            'gradient-alt',
            'simple',
          ],
        },
        size: {
          type: 'String',
          required: false,
          default: 'sm',
          matches: ['sm', 'md', 'lg'],
        },
      },
    },
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
        },
        smCols: {
          type: 'Number',
        },
        mdCols: {
          type: 'Number',
        },
        lgCols: {
          type: 'Number',
        },
        moreLink: {
          type: 'String',
        },
      },
    },
    course_video: {
      render: component('./src/components/markdoc/CourseVideo.astro'),
      attributes: {
        src: {
          type: 'String',
          required: true,
        },
        courseTitle: {
          type: 'String',
          required: true,
        },
        courseUrl: {
          type: 'String',
          required: true,
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
    graph: {
      render: component('./src/components/markdoc/Graph.astro'),
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
      transform(node, config) {
        const attributes = node.transformAttributes(config);
        let rawContent = null;
        for (const child of node.children) {
          if (child.type === 'fence') {
            rawContent = child.attributes.content;
            break;
          }
        }
        return new Markdoc.Tag(
          this.render,
          {
            ...attributes,
            astroRawData: rawContent,
          },
          []
        );
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
    install_nx_console: {
      render: component('./src/components/markdoc/InstallNxConsole.astro'),
      attributes: {},
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
    index_page_cards: {
      render: component('./src/components/markdoc/IndexPageCards.astro'),
      attributes: {
        path: {
          type: 'String',
          required: true,
        },
      },
    },
    metrics: {
      render: component('./src/components/markdoc/Metrics.astro'),
      attributes: {
        metrics: {
          type: 'Array',
          required: true,
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
    pill: {
      render: component('./src/components/markdoc/Pill.astro'),
      attributes: {
        url: {
          type: 'String',
          default: '',
        },
      },
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
      transform(node, config) {
        const attributes = node.transformAttributes(config);
        let rawContent = null;
        for (const child of node.children) {
          if (child.type === 'fence') {
            rawContent = child.attributes.content;
            break;
          }
        }
        return new Markdoc.Tag(
          this.render,
          {
            ...attributes,
            astroRawData: rawContent,
          },
          []
        );
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
    testimonial: {
      render: component('./src/components/markdoc/Testimonial.astro'),
      children: ['paragraph'],
      attributes: {
        name: {
          type: 'String',
        },
        title: {
          type: 'String',
        },
        image: {
          type: 'String',
        },
      },
    },
    video_link: {
      render: component('./src/components/markdoc/VideoLink.astro'),
      attributes: {
        link: {
          type: 'String',
          required: true,
        },
        text: {
          type: 'String',
          required: false,
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
    side_by_side: {
      render: component('./src/components/markdoc/SideBySide.astro'),
      attributes: {
        align: {
          type: 'String',
          default: 'center',
        },
      },
    },
  },
});
