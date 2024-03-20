// Bundler to be used to build the application
export const bundlerList = ['webpack', 'vite', 'rspack'];

export type Bundler = typeof bundlerList[number];
