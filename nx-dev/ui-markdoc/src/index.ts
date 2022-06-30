import Markdoc from '@markdoc/markdoc';
import { DocumentData } from '@nrwl/nx-dev/models-document';
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
import { Iframe } from './lib/tags/iframe.component';
import { iframe } from './lib/tags/iframe.schema';
import { nxCloudSection } from './lib/tags/nx-cloud-section.schema';
import { NxCloudSection } from './lib/tags/nx-cloud-section.component';
import { SideBySide } from './lib/tags/side-by-side.component';
import { sideBySide } from './lib/tags/side-by-side.schema';
import { Tab, Tabs } from './lib/tags/tabs.component';
import { tab, tabs } from './lib/tags/tabs.schema';
import { YouTube } from './lib/tags/youtube.components';
import { youtube } from './lib/tags/youtube.schema';

export const getMarkdocCustomConfig = (
  document: DocumentData
): { config: any; components: any } => ({
  config: {
    nodes: {
      fence,
      heading,
      image: getImageSchema(document),
      link,
    },
    tags: {
      callout,
      iframe,
      'nx-cloud-section': nxCloudSection,
      'side-by-side': sideBySide,
      tab,
      tabs,
      youtube,
    },
  },
  components: {
    Callout,
    CustomLink,
    Fence,
    Heading,
    Iframe,
    NxCloudSection,
    SideBySide,
    Tab,
    Tabs,
    YouTube,
  },
});

export const renderMarkdown: (document: DocumentData) => ReactNode = (
  document: DocumentData
): ReactNode => {
  const configuration = getMarkdocCustomConfig(document);
  const ast = Markdoc.parse(document.content.toString());
  return Markdoc.renderers.react(
    Markdoc.transform(ast, configuration.config),
    React,
    {
      components: configuration.components,
    }
  );
};
