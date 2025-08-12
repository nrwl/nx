# Nx Documentation Site

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

The Nx documentation site built with Astro and Starlight, featuring advanced content management through Markdoc and dynamic plugin documentation generation.

## Architecture Overview

This documentation site leverages Astro's static site generation capabilities with Starlight for documentation-specific features. The architecture consists of:

### Core Technologies

- [**Astro**](<(https://docs.astro.build)>) - Static site generator with island architecture
- [**Starlight**](https://starlight.astro.build) - Documentation theme with built-in navigation, search, and i18n
- **React** - For implementing UI components
- **Netlify** - Deployment and hosting

### Key Features

- [Markdoc](https://markdoc.dev) with custom tags for rich content such as videos, graphs, etc.
- TailwindCSS for styling in Astro and React components
- Dynamic API documentation generation from Nx packages and CLI commands
- Community plugin registry

## Project Structure

```
astro-docs/
├── src/
│   ├── assets/          # Images and static assets
│   │   ├── nx/          # Nx branding assets
│   │   ├── nx-cloud/    # Nx Cloud assets
│   │   └── nx-console/  # Nx Console assets
│   ├── components/      # React and Astro components
│   │   ├── layout/      # Layout components (e.g. Sidebar)
│   │   ├── markdoc/     # Markdoc tag components
│   │   └── utils/       # Utility functions
│   ├── content/         # Documentation content
│   │   ├── docs/        # Main documentation files (.mdoc, .mdx)
│   │   ├── approved-community-plugins.json               # Powers plugin registry
│   │   └── notifications.json                            # Notifications banners for docs site
│   ├── pages/           # Dynamic pages and routes
│   ├── plugins/         # Content loaders and plugins
│   │   ├── *.loader.ts  # Dynamic content loaders (e.g. CLI commands and API docs generation)
│   │   └── utils/       # Plugin utilities
│   └── styles/          # Global styles
├── public/              # Static assets (fonts, images, robots.txt)
├── astro.config.mjs     # Astro configuration
├── markdoc.config.mjs   # Markdoc tags configuration
├── sidebar.mts          # Sidebar structure definition
└── package.json
```

## Plugins and Loaders

### Content Loaders

The site uses custom content loaders to dynamically generate documentation:

- **PluginLoader** (`plugin.loader.ts`) - Generates official plugin documentation (generators, executors, migrations)
- **CommunityPluginsLoader** (`community-plugins.loader.ts`) - Generates data for plugin registry (e.g. GitHub stars, npm downloads)
- **NxReferencePackagesLoader** (`nx-reference-packages.loader.ts`) - Generated data for CNW, Devkit, nx cli (e.g. nx core related things)



## Content Management

### Content Types

1. **Regular Documentation** (`src/content/docs/`)

   - Written in `.mdoc` (Markdoc) or `.mdx` (MDX) format
   - Organized by sections: getting-started, concepts, guides, api
   - File-based routing (filename = URL path)

2. **Dynamic Plugin Documentation**

   - Auto-generated from Nx packages
   - Includes generators, executors, and migrations
   - Updated during build process
   - **Note**: Requires a rebuild and restart to reflect changes

3. **CLI Documentation**
   - Auto-generated from Nx CLI commands
   - Parsed from actual CLI implementation
   - **Note**: Requires a rebuild and restart to reflect changes

### Markdoc Tags

The site includes custom Markdoc tags for rich content.

**Note**: Starlight supports many Markdown and Markdoc features, such as code blocks, asides, etc.

- https://starlight.astro.build/components/using-components/#using-a-component-in-markdoc
- https://starlight.astro.build/guides/authoring-content

#### Layout & Organization

- `{% callout %}` - Highlighted information boxes
- `{% cards %}`, `{% card %}` - Card layouts

#### Interactive Components

- `{% graph %}` - Interactive project/task graph visualization
- `{% project_details %}` - Project configuration viewer

#### Media & Embeds

- `{% youtube %}` - YouTube video embeds
- `{% video_player %}` - Custom video player
- `{% iframe %}` - Generic iframe embeds

#### Developer Tools

- `{% github_repository %}` - GitHub repo cards
- `{% stackblitz_button %}` - StackBlitz demo launcher
- `{% install_nx_console %}` - IDE extension installer

#### Content Enhancement

- `{% pill %}` - Status/label pills
- `{% metrics %}` - Metrics display
- `{% testimonial %}` - Customer testimonials

## Development Workflow

### Getting Started

```bash
# Install dependencies and link workspace packages
# This will build Nx packages as well for API docs
nx serve astro-docs

# Or run astro dev directly
# This will not build Nx packages
cd astro-docs
npx astro dev

# Custom ports (useful for AI agents with git worktrees)
npx astro dev --port 3000
```

### Adding New Content

#### Regular Documentation

1. Create `.mdoc` file in `src/content/docs/`
2. Add frontmatter with title and description
3. Use Markdoc tags for rich content
4. File location determines URL structure

Example:

```markdown
---
title: 'My New Guide'
description: 'Learn how to use this feature'
---

# Introduction

{% aside type="note" title="Important" %}
This is a note about the feature.
{% /aside %}
```

#### Adding Custom Markdoc Tags

1. Create Astro component in `src/components/markdoc/`
2. (Optional) Create React component for more complex components, or ones that need to be shared with blog or non-docs pages
3. Register in `markdoc.config.mjs`
4. Define attributes and validation

### Updating Plugin Documentation

Plugin documentation is auto-generated during build. To update:

1. Make changes to the plugin's schema/implementation
2. Run the build process
3. The loader will automatically fetch and generate updated docs

### Sidebar Management

The sidebar structure is defined in `sidebar.mts`. To add new sections:

```javascript
export const sidebar = [
  {
    label: 'Section Name',
    items: [
      {
        label: 'Page Title',
        link: 'path/to/page',
      },
      // Nested sections
      {
        label: 'Subsection',
        collapsed: true,
        items: [...]
      }
    ]
  }
];
```

## Styling and Theming

- Uses Tailwind CSS v4 with Vite plugin
- Global styles in `src/styles/global.css`
- Component-specific styles use Tailwind utilities
- Dark/light mode support built into Starlight and customized in `global.css`

## Configuration Files

### `astro.config.mjs`

- Site configuration
- Integration setup (React, Markdoc, Starlight)
- Vite plugins
- Build options

### `markdoc.config.mjs`

- Custom tag definitions
- Attribute validation
- Component mappings

### `sidebar.mts`

- Navigation structure
- Section organization
- Dynamic content injection points
