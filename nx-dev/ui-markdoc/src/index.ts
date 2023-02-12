import { Node, parse, renderers, transform } from '@markdoc/markdoc';
import { load as yamlLoad } from 'js-yaml';
import React, { ReactNode } from 'react';
import { Fence } from './lib/nodes/fence.component';
import { fence } from './lib/nodes/fence.schema';
import { Heading } from './lib/nodes/heading.component';
import { heading } from './lib/nodes/heading.schema';
import { getImageSchema } from './lib/nodes/image.schema';
import { CustomLink } from './lib/nodes/link.component';
import { link } from './lib/nodes/link.schema';
import { Callout } from './lib/tags/callout.component';
import { callout } from './lib/tags/callout.schema';
import { Card, Cards } from './lib/tags/cards.component';
import { card, cards } from './lib/tags/cards.schema';
import { GithubRepository } from './lib/tags/github-repository.component';
import { githubRepository } from './lib/tags/github-repository.schema';
import { Graph } from './lib/tags/graph.component';
import { graph } from './lib/tags/graph.schema';
import { Iframe } from './lib/tags/iframe.component';
import { iframe } from './lib/tags/iframe.schema';
import { InstallNxConsole } from './lib/tags/install-nx-console.component';
import { installNxConsole } from './lib/tags/install-nx-console.schema';
import { NxCloudSection } from './lib/tags/nx-cloud-section.component';
import { nxCloudSection } from './lib/tags/nx-cloud-section.schema';
import { Persona, Personas } from './lib/tags/personas.component';
import { persona, personas } from './lib/tags/personas.schema';
import { SideBySide } from './lib/tags/side-by-side.component';
import { sideBySide } from './lib/tags/side-by-side.schema';
import { Tab, Tabs } from './lib/tags/tabs.component';
import { tab, tabs } from './lib/tags/tabs.schema';
import { YouTube } from './lib/tags/youtube.components';
import { youtube } from './lib/tags/youtube.schema';

export const getMarkdocCustomConfig = (
  documentFilePath: string
): { config: any; components: any } => ({
  config: {
    nodes: {
      fence,
      heading,
      image: getImageSchema(documentFilePath),
      link,
    },
    tags: {
      callout,
      card,
      cards,
      'github-repository': githubRepository,
      graph,
      iframe,
      'install-nx-console': installNxConsole,
      'nx-cloud-section': nxCloudSection,
      persona,
      personas,
      'side-by-side': sideBySide,
      tab,
      tabs,
      youtube,
    },
  },
  components: {
    Callout,
    Card,
    Cards,
    CustomLink,
    Fence,
    GithubRepository,
    Graph,
    Heading,
    Iframe,
    InstallNxConsole,
    NxCloudSection,
    Persona,
    Personas,
    SideBySide,
    Tab,
    Tabs,
    YouTube,
  },
});

export const parseMarkdown: (markdown: string) => Node = (markdown) =>
  parse(markdown);

export const renderMarkdown: (
  documentContent: string,
  options: { filePath: string }
) => { metadata: Record<string, any>; node: ReactNode } = (
  documentContent: string,
  options: { filePath: string } = { filePath: '' }
): { metadata: Record<string, any>; node: ReactNode } => {
  const ast = parseMarkdown(documentContent);
  const configuration = getMarkdocCustomConfig(options.filePath);

  return {
    metadata: ast.attributes['frontmatter']
      ? (yamlLoad(ast.attributes['frontmatter']) as Record<string, any>)
      : {},
    node: renderers.react(transform(ast, configuration.config), React, {
      components: configuration.components,
    }),
  };
};
