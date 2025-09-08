import { addTestCiTargets, shouldEnableTestAtomization } from './test-atomization';

describe('TestAtomization', () => {
  describe('shouldEnableTestAtomization', () => {
    it('should return false when atomization is disabled', () => {
      const projectData = {
        projectName: 'test-project',
        testClasses: [
          { className: 'UserServiceTest', packagePath: 'com.example.UserServiceTest', filePath: 'test.java' }
        ],
        hasTests: true
      };

      const result = shouldEnableTestAtomization(projectData, { enabled: false });
      
      expect(result).toBe(false);
    });

    it('should return false when project has no tests', () => {
      const projectData = {
        projectName: 'test-project',
        testClasses: [],
        hasTests: false
      };

      const result = shouldEnableTestAtomization(projectData, { enabled: true });
      
      expect(result).toBe(false);
    });

    it('should return true when enabled and project has test classes', () => {
      const projectData = {
        projectName: 'test-project',
        testClasses: [
          { className: 'UserServiceTest', packagePath: 'com.example.UserServiceTest', filePath: 'test.java' }
        ],
        hasTests: true
      };

      const result = shouldEnableTestAtomization(projectData, { enabled: true });
      
      expect(result).toBe(true);
    });
  });

  describe('addTestCiTargets', () => {
    it('should create atomized test targets', () => {
      const projectData = {
        projectName: 'test-project',
        testClasses: [
          { className: 'UserServiceTest', packagePath: 'com.example.UserServiceTest', filePath: 'UserServiceTest.java' },
          { className: 'OrderServiceTest', packagePath: 'com.example.OrderServiceTest', filePath: 'OrderServiceTest.java' }
        ],
        hasTests: true
      };

      const targets = {};
      const targetGroups = {};
      const projectRoot = 'apps/test-project';

      addTestCiTargets(projectData, targets, targetGroups, projectRoot, 'test-ci');

      // Check atomized targets were created
      expect(targets).toHaveProperty('test-ci--UserServiceTest');
      expect(targets).toHaveProperty('test-ci--OrderServiceTest');
      expect(targets).toHaveProperty('test-ci');

      // Check target configuration
      const atomizedTarget = targets['test-ci--UserServiceTest'];
      expect(atomizedTarget.executor).toBe('nx:run-commands');
      expect(atomizedTarget.options.command).toBe('mvn test -Dtest=com.example.UserServiceTest');
      expect(atomizedTarget.cache).toBe(true);

      // Check parent target
      const parentTarget = targets['test-ci'];
      expect(parentTarget.executor).toBe('nx:noop');
      expect(parentTarget.dependsOn).toHaveLength(2);

      // Check target groups
      expect(targetGroups).toHaveProperty('test');
      expect(targetGroups['test']).toContain('test-ci--UserServiceTest');
      expect(targetGroups['test']).toContain('test-ci--OrderServiceTest');
      expect(targetGroups['test']).toContain('test-ci');
    });

    it('should not create targets when no test classes exist', () => {
      const projectData = {
        projectName: 'test-project',
        testClasses: [],
        hasTests: false
      };

      const targets = {};
      const targetGroups = {};
      const projectRoot = 'apps/test-project';

      addTestCiTargets(projectData, targets, targetGroups, projectRoot, 'test-ci');

      // Should not create any targets
      expect(Object.keys(targets)).toHaveLength(0);
      expect(Object.keys(targetGroups)).toHaveLength(1); // test group still created but empty
    });
  });
});