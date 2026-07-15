import { splitFields, splitKeyValue } from './csv-fields';
import { ParsedImage } from './types';

/**
 * Parses image inputs. Supports the legacy single-line comma-separated shorthand
 * (`image1,image2`) as well as the `name=...,enable=...` attribute syntax.
 */
export function parseImages(inputs: string[]): ParsedImage[] {
  let images: ParsedImage[] = [];

  // Backward compatibility with the plain comma-separated shorthand.
  if (inputs.length === 1) {
    let newFormat = false;
    const fields = splitFields(inputs[0]);
    for (const field of fields) {
      const parts = splitKeyValue(field);
      if (parts.length === 1) {
        images.push({ name: parts[0], enable: true });
      } else {
        newFormat = true;
        break;
      }
    }
    if (!newFormat) {
      return images;
    }
  }

  images = [];
  for (const input of inputs) {
    const image: ParsedImage = { name: '', enable: true };
    const fields = splitFields(input);
    for (const field of fields) {
      const parts = splitKeyValue(field);
      if (parts.length === 1) {
        image.name = parts[0];
      } else {
        const [rawKey, value] = parts;
        const key = rawKey.toLowerCase();
        switch (key) {
          case 'name': {
            image.name = value;
            break;
          }
          case 'enable': {
            if (!['true', 'false'].includes(value)) {
              throw new Error(`Invalid enable attribute value: ${input}`);
            }
            image.enable = /true/i.test(value);
            break;
          }
          default: {
            throw new Error(`Unknown image attribute: ${input}`);
          }
        }
      }
    }
    if (image.name.length === 0) {
      throw new Error(`Image name attribute empty: ${input}`);
    }
    images.push(image);
  }
  return images;
}
