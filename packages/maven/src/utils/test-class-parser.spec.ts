import { parseJavaTestFile, containsTestAnnotations } from './test-class-parser';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('TestClassParser', () => {
  const testDir = join(__dirname, '__test_temp__');
  
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });
  
  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('containsTestAnnotations', () => {
    it('should detect JUnit 5 @Test annotation', () => {
      const content = `
        public class UserServiceTest {
          @Test
          public void shouldCreateUser() {
            // test code
          }
        }
      `;
      
      expect(containsTestAnnotations(content)).toBe(true);
    });
    
    it('should detect JUnit 4 @org.junit.Test annotation', () => {
      const content = `
        public class UserServiceTest {
          @org.junit.Test
          public void shouldCreateUser() {
            // test code
          }
        }
      `;
      
      expect(containsTestAnnotations(content)).toBe(true);
    });
    
    it('should detect @ParameterizedTest annotation', () => {
      const content = `
        public class UserServiceTest {
          @ParameterizedTest
          @ValueSource(strings = {"a", "b", "c"})
          public void shouldHandleParams(String input) {
            // test code
          }
        }
      `;
      
      expect(containsTestAnnotations(content)).toBe(true);
    });
    
    it('should not detect non-test annotations', () => {
      const content = `
        public class UserService {
          @Override
          public void createUser() {
            // service code
          }
        }
      `;
      
      expect(containsTestAnnotations(content)).toBe(false);
    });
  });

  describe('parseJavaTestFile', () => {
    it('should parse a simple test class', () => {
      const testContent = `
        package com.example.service;
        
        import org.junit.jupiter.api.Test;
        
        public class UserServiceTest {
          @Test
          public void shouldCreateUser() {
            // test implementation
          }
          
          @Test
          public void shouldUpdateUser() {
            // test implementation
          }
        }
      `;
      
      const testFile = join(testDir, 'UserServiceTest.java');
      writeFileSync(testFile, testContent);
      
      const result = parseJavaTestFile(testFile);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        className: 'UserServiceTest',
        packagePath: 'com.example.service.UserServiceTest',
        filePath: testFile
      });
    });
    
    it('should handle test class without package', () => {
      const testContent = `
        import org.junit.jupiter.api.Test;
        
        public class SimpleTest {
          @Test
          public void shouldWork() {
            // test implementation
          }
        }
      `;
      
      const testFile = join(testDir, 'SimpleTest.java');
      writeFileSync(testFile, testContent);
      
      const result = parseJavaTestFile(testFile);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        className: 'SimpleTest',
        packagePath: 'SimpleTest',
        filePath: testFile
      });
    });
    
    it('should return empty array for non-test class', () => {
      const serviceContent = `
        package com.example.service;
        
        public class UserService {
          public void createUser() {
            // service implementation
          }
        }
      `;
      
      const serviceFile = join(testDir, 'UserService.java');
      writeFileSync(serviceFile, serviceContent);
      
      const result = parseJavaTestFile(serviceFile);
      
      expect(result).toHaveLength(0);
    });
    
    it('should return empty array for non-existent file', () => {
      const result = parseJavaTestFile(join(testDir, 'NonExistent.java'));
      
      expect(result).toHaveLength(0);
    });
  });
});