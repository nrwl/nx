import { Client } from '@notionhq/client';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { get } from 'node:https';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { slugify } from '../../nx-dev/feature-package-schema-viewer/src/lib/slugify.utils';
const notion = new Client({ auth: process.env.NOTION_KEY });

// Instructions to run located here: https://www.notion.so/nxnrwl/17c69f3c238780eb8ef6df32ce48f919?v=db53d7de0cc94f4ab9dfce8e3654f7dc

const BLOG_ROOT = './docs/blog';

interface RichTextProperty {
  type: 'rich_text';
  rich_text: RichTextItem[];
}
interface RichTextItem {
  type: 'text';
  text: {
    content: string;
    link?: string;
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: 'default' | string;
  };
  plain_text: string;
  href?: string;
}
interface DateProperty {
  type: 'date';
  date: { start: string; end?: string; time_zone?: string };
}
interface UrlProperty {
  type: 'url';
  url: string;
}
interface FilesProperty {
  type: 'files';
  files: {
    name: string;
    type: 'file';
    file: {
      url: string;
      expiry_time: string;
    };
  }[];
}
interface SelectProperty {
  type: 'select';
  select: { id: string; name: string; color: string };
}
interface TitleProperty {
  type: 'title';
  title: RichTextItem[];
}

interface WebinarResponse {
  Description: RichTextProperty;
  Date: DateProperty;
  ['YouTube Link']: UrlProperty;
  ['Webinar Card Image']: FilesProperty;
  Status: SelectProperty;
  ['Speaker(s)']: RichTextProperty;
  Time: RichTextProperty;
  ['Link to Landing Page']: UrlProperty;
  Title: TitleProperty;
}
interface ProcessedWebinar {
  Description: string;
  Date: string;
  ['YouTube Link']: string;
  ['Webinar Card Image']: string[];
  Status: string;
  ['Speaker(s)']: RichTextProperty;
  Time: RichTextProperty;
  ['Link to Landing Page']: UrlProperty;
  Title: TitleProperty;
}

const propertyParsers = {
  rich_text: (prop: RichTextProperty): string => {
    return prop.rich_text
      .map((item) => {
        let text = item.text.content;
        if (item.annotations.bold) {
          text = `**${text}**`;
        } else if (item.annotations.code) {
          text = `\`${text}\``;
        } else if (item.annotations.italic) {
          text = `*${text}*`;
        } else if (item.annotations.strikethrough) {
          text = `~${text}~`;
        } else if (item.annotations.underline) {
          text = `_${text}_`;
        }
        if (item.href) {
          text = `[${text}](${item.href})`;
        }
        return text;
      })
      .join('');
  },
  select: (prop: SelectProperty): string => {
    return prop.select.name;
  },
  title: (prop: TitleProperty): string => {
    return propertyParsers.rich_text({
      type: 'rich_text',
      rich_text: prop.title,
    });
  },
  url: (prop: UrlProperty): string => {
    return prop.url;
  },
  date: (prop: DateProperty): string => {
    return prop.date?.start;
  },
  files: (prop: FilesProperty): string => {
    return prop.files.map((entry) => {
      return entry.file.url;
    })[0];
  },
};

async function main() {
  const response = await notion.databases.query({
    database_id: '17c69f3c238780eb8ef6df32ce48f919',
  });
  response.results.forEach(async (entry: any) => {
    const webinar: WebinarResponse = entry.properties;
    const processedWebinar = Object.fromEntries(
      Object.entries(webinar).map(([key, val]) => {
        return [key, propertyParsers[val.type](val)];
      })
    );

    let cover_image = '';
    const imageFiles = webinar['Webinar Card Image'].files;
    function ensureDirectoryExistence(filePath) {
      var directory = dirname(filePath);
      if (existsSync(directory)) {
        return true;
      }
      ensureDirectoryExistence(directory);
      mkdirSync(directory);
    }
    async function download(url: string, path: string) {
      return new Promise(async (onSuccess) => {
        get(url, async (res) => {
          ensureDirectoryExistence(path);
          const fileWriteStream = createWriteStream(path, {
            autoClose: true,
            flags: 'w',
          });
          await pipeline(res, fileWriteStream);
          onSuccess('success');
        });
      });
    }
    if (imageFiles.length > 0) {
      const imageFilePath =
        BLOG_ROOT +
        `/images/${webinar.Date.date.start}/${imageFiles[0].name.replaceAll(
          ' ',
          '-'
        )}`;
      if (!existsSync(imageFilePath)) {
        download(imageFiles[0].file.url, imageFilePath);
        console.log('Downloaded image', imageFilePath);
      }
      cover_image = `/blog/images/${
        webinar.Date.date.start
      }/${imageFiles[0].name.replaceAll(' ', '-')}`;
    }

    const webinarMarkdown = `---
title: "${processedWebinar.Title}"
description: "${processedWebinar.Description}"
date: ${processedWebinar['Publish Date'] || processedWebinar.Date}
slug: '${slugify(processedWebinar.Title)}'
authors: [${processedWebinar['Speaker(s)']
      .replace(', and ', ', ')
      .replace(' and ', ', ')
      .split(', ')
      .map((author) => `'${author}'`)
      .join(', ')}]
tags: [webinar]${
      cover_image
        ? `
cover_image: ${cover_image}`
        : ''
    }${
      processedWebinar['Time']
        ? `
time: ${processedWebinar['Time']}`
        : ''
    }${
      processedWebinar['Status']
        ? `
status: ${processedWebinar['Status']}`
        : ''
    }${
      processedWebinar['YouTube Link'] &&
      processedWebinar['Status'] === 'Past - Ungated'
        ? `
youtubeUrl: ${processedWebinar['YouTube Link']}`
        : ''
    }${
      processedWebinar['Link to Landing Page']
        ? `
registrationUrl: ${processedWebinar['Link to Landing Page']}`
        : ''
    }
---${
      processedWebinar.Time
        ? `

**${new Date(
            processedWebinar.Date + ' ' + new Date().toTimeString()
          ).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          })} - ${processedWebinar.Time}**`
        : ''
    }${
      processedWebinar['Speaker(s)']
        ? `

Presented by ${processedWebinar['Speaker(s)']}`
        : ''
    }

${processedWebinar.Description}

${
  processedWebinar.Status === 'Upcoming'
    ? `{% call-to-action title="Register today!" url="${processedWebinar['Link to Landing Page']}" description="Save your spot" /%}`
    : ''
}${
      processedWebinar.Status === 'Past - Gated' &&
      processedWebinar['Link to Landing Page']
        ? `{% call-to-action title="Download the recording" url="${processedWebinar['Link to Landing Page']}" description="Sign up to gain access" /%}`
        : ''
    }
`;

    writeFileSync(
      BLOG_ROOT +
        '/' +
        processedWebinar.Date +
        '-' +
        slugify(processedWebinar.Title) +
        '.md',
      webinarMarkdown
    );
  });
}
main();
