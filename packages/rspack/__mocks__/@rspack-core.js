// Mock for @rspack/core to avoid loading native bindings during tests
module.exports = {
  rspack: jest.fn(),
  Configuration: jest.fn(),
  Compiler: jest.fn(),
  MultiCompiler: jest.fn(),
  Stats: jest.fn(),
  MultiStats: jest.fn(),
  NormalModuleReplacementPlugin: jest.fn(),
  ProgressPlugin: jest.fn(),
  RspackPluginInstance: jest.fn(),
  SwcJsMinimizerRspackPlugin: jest.fn(),
  CopyRspackPlugin: jest.fn(),
  RspackOptionsNormalized: jest.fn(),
  Output: jest.fn(),
  CssExtractRspackPlugin: jest.fn(),
  sources: {},
  DefinePlugin: jest.fn(),
  // Add other exports as needed
};
