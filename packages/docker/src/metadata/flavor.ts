import { splitFields, splitKeyValue } from './csv-fields';
import { ParsedFlavor } from './types';

export function parseFlavor(inputs: string[]): ParsedFlavor {
  const flavor: ParsedFlavor = {
    latest: 'auto',
    prefix: '',
    prefixLatest: false,
    suffix: '',
    suffixLatest: false,
  };

  for (const input of inputs) {
    const fields = splitFields(input);
    let onLatestFor = '';
    for (const field of fields) {
      const parts = splitKeyValue(field);
      if (parts.length === 1) {
        throw new Error(`Invalid flavor entry: ${input}`);
      }
      const [rawKey, value] = parts;
      const key = rawKey.toLowerCase();
      switch (key) {
        case 'latest': {
          if (!['auto', 'true', 'false'].includes(value)) {
            throw new Error(`Invalid latest flavor entry: ${input}`);
          }
          flavor.latest = value as ParsedFlavor['latest'];
          break;
        }
        case 'prefix': {
          flavor.prefix = value;
          onLatestFor = 'prefix';
          break;
        }
        case 'suffix': {
          flavor.suffix = value;
          onLatestFor = 'suffix';
          break;
        }
        case 'onlatest': {
          if (!['true', 'false'].includes(value)) {
            throw new Error(`Invalid value for onlatest attribute: ${value}`);
          }
          if (onLatestFor === 'prefix') {
            flavor.prefixLatest = /true/i.test(value);
          } else if (onLatestFor === 'suffix') {
            flavor.suffixLatest = /true/i.test(value);
          }
          break;
        }
        default: {
          throw new Error(`Unknown flavor entry: ${input}`);
        }
      }
    }
  }

  return flavor;
}
