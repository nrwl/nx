import { splitFields, splitKeyValue } from './csv-fields';
import {
  DEFAULT_TAG_PRIORITIES,
  ParsedTag,
  RefEvent,
  ShaFormat,
  TagType,
} from './types';

const TAG_TYPES: TagType[] = [
  'schedule',
  'semver',
  'pep440',
  'match',
  'edge',
  'ref',
  'raw',
  'sha',
];
const REF_EVENTS: RefEvent[] = ['branch', 'tag', 'pr'];
const SHA_FORMATS: ShaFormat[] = ['short', 'long'];

export function tagToString(tag: ParsedTag): string {
  const out = [`type=${tag.type}`];
  for (const attr in tag.attrs) {
    out.push(`${attr}=${tag.attrs[attr]}`);
  }
  return out.join(',');
}

export function parseTag(input: string): ParsedTag {
  const fields = splitFields(input);
  const tag: ParsedTag = { type: 'raw', attrs: {} };
  let typeSet = false;

  for (const field of fields) {
    const parts = splitKeyValue(field);
    if (parts.length === 1) {
      tag.attrs['value'] = parts[0];
    } else {
      const [rawKey, value] = parts;
      const key = rawKey.toLowerCase();
      if (key === 'type') {
        if (!TAG_TYPES.includes(value as TagType)) {
          throw new Error(`Unknown tag type attribute: ${value}`);
        }
        tag.type = value as TagType;
        typeSet = true;
      } else {
        tag.attrs[key] = value;
      }
    }
  }

  if (!typeSet) {
    tag.type = 'raw';
  }

  switch (tag.type) {
    case 'schedule': {
      if (!('pattern' in tag.attrs)) {
        tag.attrs['pattern'] = 'nightly';
      }
      break;
    }
    case 'semver':
    case 'pep440': {
      if (!('pattern' in tag.attrs)) {
        throw new Error(`Missing pattern attribute for ${input}`);
      }
      if (!('value' in tag.attrs)) {
        tag.attrs['value'] = '';
      }
      break;
    }
    case 'match': {
      if (!('pattern' in tag.attrs)) {
        throw new Error(`Missing pattern attribute for ${input}`);
      }
      if (!('group' in tag.attrs)) {
        tag.attrs['group'] = '0';
      }
      if (isNaN(+tag.attrs['group'])) {
        throw new Error(`Invalid match group for ${input}`);
      }
      if (!('value' in tag.attrs)) {
        tag.attrs['value'] = '';
      }
      break;
    }
    case 'edge': {
      if (!('branch' in tag.attrs)) {
        tag.attrs['branch'] = '';
      }
      break;
    }
    case 'ref': {
      if (!('event' in tag.attrs)) {
        throw new Error(`Missing event attribute for ${input}`);
      }
      if (!REF_EVENTS.includes(tag.attrs['event'] as RefEvent)) {
        throw new Error(`Invalid event for ${input}`);
      }
      if (tag.attrs['event'] === 'pr' && !('prefix' in tag.attrs)) {
        tag.attrs['prefix'] = 'pr-';
      }
      break;
    }
    case 'raw': {
      if (!('value' in tag.attrs)) {
        throw new Error(`Missing value attribute for ${input}`);
      }
      break;
    }
    case 'sha': {
      if (!('prefix' in tag.attrs)) {
        tag.attrs['prefix'] = 'sha-';
      }
      if (!('format' in tag.attrs)) {
        tag.attrs['format'] = 'short';
      }
      if (!SHA_FORMATS.includes(tag.attrs['format'] as ShaFormat)) {
        throw new Error(`Invalid format for ${input}`);
      }
      break;
    }
  }

  if (!('enable' in tag.attrs)) {
    tag.attrs['enable'] = 'true';
  }
  if (!('priority' in tag.attrs)) {
    tag.attrs['priority'] = DEFAULT_TAG_PRIORITIES[tag.type];
  }

  return tag;
}

export function parseTags(inputs: string[]): ParsedTag[] {
  if (inputs.length === 0) {
    inputs = [
      'type=schedule',
      'type=ref,event=branch',
      'type=ref,event=tag',
      'type=ref,event=pr',
    ];
  }

  const tags = inputs.map(parseTag);
  return tags.sort(
    (a, b) => Number(b.attrs['priority']) - Number(a.attrs['priority'])
  );
}
