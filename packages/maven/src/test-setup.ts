// Test setup file for Maven plugin tests

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};