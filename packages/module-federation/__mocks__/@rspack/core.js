// Mock for @rspack/core to avoid loading native bindings during tests
module.exports = {
  NormalModuleReplacementPlugin: jest.fn(),
  rspack: jest.fn(),
  Configuration: jest.fn(),
  Compiler: jest.fn(),
  Stats: jest.fn(),
  // Add other exports as needed for tests
};
