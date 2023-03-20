// Platform option to be used when the node-server preset is selected
export const serverlessPlatformList = ['netlify', 'none'];

export type ServerlessPlatform = typeof serverlessPlatformList[number];
