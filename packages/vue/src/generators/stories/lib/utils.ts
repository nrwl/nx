export function camelCase(input: string): string {
  if (input.indexOf('-') > 1) {
    return input
      .toLowerCase()
      .replace(/-(.)/g, (_match, group1) => group1.toUpperCase())
      .replace('.', '');
  } else {
    return input;
  }
}

export function createDefautPropsObject(propsObject: {
  [key: string]: string;
}): {
  name: string;
  defaultValue: any;
}[] {
  const props = [];
  for (const key in propsObject) {
    if (Object.prototype.hasOwnProperty.call(propsObject, key)) {
      let defaultValueOfProp;
      const element = propsObject[key];
      if (element === 'string') {
        defaultValueOfProp = `'${key}'`;
      } else if (element === 'boolean') {
        defaultValueOfProp = false;
      } else if (element === 'number') {
        defaultValueOfProp = 0;
      }
      props.push({
        name: key,
        defaultValue: defaultValueOfProp,
      });
    }
  }
  return props;
}

export function getDefinePropsObject(vueComponentFileContent: string): {
  [key: string]: string;
} {
  const scriptTagRegex = /<script[^>]*>([\s\S]*?)<\/script>/;
  const match = vueComponentFileContent?.match(scriptTagRegex);
  let propsContent;
  if (match && match[1]) {
    const scriptContent = match[1].trim();
    const definePropsRegex = /defineProps<([\s\S]*?)>/;
    const definePropsMatch = scriptContent.match(definePropsRegex);

    if (definePropsMatch && definePropsMatch[1]) {
      propsContent = definePropsMatch[1].trim();
    } else {
      const propsRegex = /(props:\s*\{[\s\S]*?\})/;
      const match = scriptContent.match(propsRegex);

      if (match && match[1]) {
        propsContent = match[1].trim();
      } else {
        // No props found
      }
    }
  } else {
    // No props found
  }
  const attributes = {};

  if (propsContent) {
    const keyTypeRegex = /(\w+):\s*(\w+);/g;
    let match;

    while ((match = keyTypeRegex.exec(propsContent)) !== null) {
      attributes[match[1]] = match[2];
    }
  }
  return attributes;
}
