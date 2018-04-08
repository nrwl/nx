let explicitlySetPath: string = '';

export function setAppRootPath(dirname) {
  explicitlySetPath = dirname;
}

export const getAppRootPath = () => {
  return explicitlySetPath || require('app-root-path').path;
};
