// Framework option to be used when the node-standalone preset is selected
export const frameworkList = ['express', 'fastify', 'koa', 'nest'];

export type Framework = typeof frameworkList[number];
