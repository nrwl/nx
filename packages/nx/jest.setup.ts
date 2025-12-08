// Setup file to handle spy redefinition issues
// Reset all module spies after each test file

// This is needed due to a module resolution with unit test setup
process.env.NX_ISOLATE_PLUGINS = 'false';
afterAll(() => {
  jest.restoreAllMocks();
});
