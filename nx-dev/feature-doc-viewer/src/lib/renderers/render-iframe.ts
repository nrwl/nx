export function renderIframes(): (tree: any) => void {
  return (tree): void => {
    const iframeList = tree.children.filter(
      (child) => child.type === 'raw' && child.value.includes('<iframe')
    );
    iframeList.forEach((item) => {
      item.type = 'element';
      item.tagName = 'iframe';
      item.children = [];
      item.properties = {};
      let match;
      const regex = new RegExp(
        '[\\s\\r\\t\\n]*([a-z0-9\\-_]+)[\\s\\r\\t\\n]*=[\\s\\r\\t\\n]*([\'"])((?:\\\\\\2|(?!\\2).)*)\\2',
        'ig'
      );
      while ((match = regex.exec(item.value))) {
        item.properties[match[1]] = match[3];
      }
    });
  };
}
