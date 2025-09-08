import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Test annotation patterns from Gradle implementation
const ESSENTIAL_TEST_ANNOTATIONS = [
  '@Test',
  '@TestTemplate', 
  '@ParameterizedTest',
  '@RepeatedTest',
  '@TestFactory',
  '@org.junit.Test', // JUnit 4
  '@org.testng.annotations.Test' // TestNG
];

const CLASS_TEST_ANNOTATIONS = [
  '@Nested',
  '@TestInstance', 
  '@TestMethodOrder',
  '@DisplayName',
  '@ExtendWith'
];

interface TestClass {
  className: string;
  packagePath: string;
  filePath: string;
}

/**
 * Check if file content contains essential test annotations
 */
export function containsTestAnnotations(content: string): boolean {
  return ESSENTIAL_TEST_ANNOTATIONS.some(annotation => content.includes(annotation)) ||
         CLASS_TEST_ANNOTATIONS.some(annotation => content.includes(annotation));
}

/**
 * Parse a Java file to extract test classes using regex patterns
 */
export function parseJavaTestFile(filePath: string): TestClass[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  
  // Quick check if file has test annotations
  if (!containsTestAnnotations(content)) {
    return [];
  }

  const results: TestClass[] = [];
  
  // Extract package name
  const packageMatch = content.match(/^\s*package\s+([\w.]+)\s*;/m);
  const packageName = packageMatch ? packageMatch[1] : '';

  // Find public classes that have test annotations
  // Look for class declarations
  const classPattern = /(?:^|\n)\s*(?:@[\w.()=",\s]+\s+)*public\s+(?:(?:abstract|final)\s+)?class\s+(\w+)/gm;
  let classMatch;
  
  while ((classMatch = classPattern.exec(content)) !== null) {
    const className = classMatch[1];
    const classStart = classMatch.index;
    
    // Find the end of this class by looking for the matching closing brace
    const classContent = extractClassContent(content, classStart);
    
    // Check if this class or its methods have test annotations
    if (hasTestAnnotations(classContent)) {
      const packagePath = packageName ? `${packageName}.${className}` : className;
      results.push({
        className,
        packagePath,
        filePath
      });
    }
  }

  return results;
}

/**
 * Extract the content of a class from start position
 */
function extractClassContent(content: string, startPos: number): string {
  let braceCount = 0;
  let inClass = false;
  let classStart = -1;
  
  for (let i = startPos; i < content.length; i++) {
    const char = content[i];
    
    if (char === '{') {
      if (!inClass) {
        inClass = true;
        classStart = i;
      }
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && inClass) {
        return content.substring(classStart, i + 1);
      }
    }
  }
  
  return content.substring(startPos);
}

/**
 * Check if class content has test annotations
 */
function hasTestAnnotations(classContent: string): boolean {
  // Remove comments and strings to avoid false positives
  const cleanContent = removeCommentsAndStrings(classContent);
  
  return ESSENTIAL_TEST_ANNOTATIONS.some(annotation => 
    cleanContent.includes(annotation)
  ) || CLASS_TEST_ANNOTATIONS.some(annotation => 
    cleanContent.includes(annotation)
  );
}

/**
 * Remove comments and string literals to avoid false annotation detection
 */
function removeCommentsAndStrings(content: string): string {
  // Remove single line comments
  let result = content.replace(/\/\/.*$/gm, '');
  
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove string literals (simple approach)
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  
  return result;
}

/**
 * Find all Java files recursively in a directory
 */
function findJavaFilesRecursive(dir: string): string[] {
  const javaFiles: string[] = [];
  
  function walkDir(currentDir: string) {
    if (!existsSync(currentDir)) return;
    
    const items = readdirSync(currentDir);
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (item.endsWith('.java')) {
        javaFiles.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return javaFiles;
}

/**
 * Find all test classes in the given test source directories
 */
export function findTestClasses(testSourceRoots: string[], projectRoot: string): TestClass[] {
  const testClasses: TestClass[] = [];
  
  for (const testRoot of testSourceRoots) {
    const testDir = join(projectRoot, testRoot);
    
    if (!existsSync(testDir)) {
      continue;
    }
    
    // Find all Java files in test directory
    const javaFiles = findJavaFilesRecursive(testDir);
    
    for (const javaFile of javaFiles) {
      const classes = parseJavaTestFile(javaFile);
      testClasses.push(...classes);
    }
  }
  
  return testClasses;
}