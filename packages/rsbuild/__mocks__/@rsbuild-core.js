// Mock for @rsbuild/core to avoid loading native bindings during tests
module.exports = {
  loadConfig: jest.fn().mockResolvedValue({
    filePath: '',
    content: {},
  }),
  defineConfig: jest.fn((config) => config),
  // Add other exports as needed
};
