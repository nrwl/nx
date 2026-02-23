import { deduplicateCallSites, getCallSites } from './call-sites';

function createMockCallSite(
  functionName: string | null,
  fileName: string | null
): NodeJS.CallSite {
  return {
    getFunctionName: () => functionName,
    getFileName: () => fileName,
    getLineNumber: () => 1,
    getColumnNumber: () => 1,
    getTypeName: () => null,
    getMethodName: () => null,
    getEvalOrigin: () => undefined,
    isToplevel: () => false,
    isEval: () => false,
    isNative: () => false,
    isConstructor: () => false,
    toString: () => `${functionName} (${fileName}:1:1)`,
  } as NodeJS.CallSite;
}

describe('call-sites', () => {
  describe('getCallSites', () => {
    it('should return call sites without getCallSites itself', () => {
      const sites = getCallSites();
      const functionNames = sites.map((s) => s.getFunctionName());
      expect(functionNames).not.toContain('getCallSites');
    });

    it('should include the calling function in the stack', () => {
      function myTestFunction() {
        return getCallSites();
      }
      const sites = myTestFunction();
      const functionNames = sites.map((s) => s.getFunctionName());
      expect(functionNames[0]).toBe('myTestFunction');
    });

    it('should not contain consecutive duplicate frames', () => {
      const sites = getCallSites();
      for (let i = 1; i < sites.length; i++) {
        const prev = sites[i - 1];
        const curr = sites[i];
        const isDuplicate =
          curr.getFunctionName() === prev.getFunctionName() &&
          curr.getFileName() === prev.getFileName();
        if (isDuplicate) {
          fail(
            `Found consecutive duplicate frame: ${curr.getFunctionName()} at ${curr.getFileName()}`
          );
        }
      }
    });
  });

  describe('deduplicateCallSites', () => {
    it('should return empty array for empty input', () => {
      expect(deduplicateCallSites([])).toEqual([]);
    });

    it('should return single-element array unchanged', () => {
      const sites = [createMockCallSite('foo', 'file.js')];
      expect(deduplicateCallSites(sites)).toEqual(sites);
    });

    it('should remove consecutive duplicates with same function and file name', () => {
      const sites = [
        createMockCallSite('foo', 'file.js'),
        createMockCallSite('foo', 'file.js'),
        createMockCallSite('bar', 'other.js'),
      ];
      const result = deduplicateCallSites(sites);
      expect(result).toHaveLength(2);
      expect(result[0].getFunctionName()).toBe('foo');
      expect(result[1].getFunctionName()).toBe('bar');
    });

    it('should preserve non-consecutive duplicates (legitimate recursion)', () => {
      const sites = [
        createMockCallSite('foo', 'file.js'),
        createMockCallSite('bar', 'file.js'),
        createMockCallSite('foo', 'file.js'),
      ];
      const result = deduplicateCallSites(sites);
      expect(result).toHaveLength(3);
      expect(result[0].getFunctionName()).toBe('foo');
      expect(result[1].getFunctionName()).toBe('bar');
      expect(result[2].getFunctionName()).toBe('foo');
    });

    it('should not deduplicate frames with same function name but different files', () => {
      const sites = [
        createMockCallSite('foo', 'file1.js'),
        createMockCallSite('foo', 'file2.js'),
      ];
      const result = deduplicateCallSites(sites);
      expect(result).toHaveLength(2);
    });

    it('should handle Bun-style duplicate frames for async functions', () => {
      // Simulates Bun's behavior where each async function produces
      // two consecutive frames in the call stack
      const sites = [
        createMockCallSite(
          'preventRecursionInGraphConstruction',
          'project-graph.js'
        ),
        createMockCallSite(
          'preventRecursionInGraphConstruction',
          'project-graph.js'
        ),
        createMockCallSite(
          'buildProjectGraphAndSourceMapsWithoutDaemon',
          'project-graph.js'
        ),
        createMockCallSite(
          'buildProjectGraphAndSourceMapsWithoutDaemon',
          'project-graph.js'
        ),
        createMockCallSite(
          'createProjectGraphAndSourceMapsAsync',
          'project-graph.js'
        ),
        createMockCallSite(
          'createProjectGraphAndSourceMapsAsync',
          'project-graph.js'
        ),
        createMockCallSite('createProjectGraphAsync', 'project-graph.js'),
        createMockCallSite('createProjectGraphAsync', 'project-graph.js'),
        createMockCallSite('runOne', 'run-one.js'),
        createMockCallSite('runOne', 'run-one.js'),
      ];

      const result = deduplicateCallSites(sites);
      expect(result).toHaveLength(5);
      expect(result.map((s) => s.getFunctionName())).toEqual([
        'preventRecursionInGraphConstruction',
        'buildProjectGraphAndSourceMapsWithoutDaemon',
        'createProjectGraphAndSourceMapsAsync',
        'createProjectGraphAsync',
        'runOne',
      ]);

      // After slice(2), buildProjectGraphAndSourceMapsWithoutDaemon
      // should NOT be present — this is the fix for the Bun false positive
      const afterSlice = result.slice(2);
      expect(
        afterSlice.some(
          (s) =>
            s.getFunctionName() ===
            'buildProjectGraphAndSourceMapsWithoutDaemon'
        )
      ).toBe(false);
    });

    it('should handle null function names', () => {
      const sites = [
        createMockCallSite(null, 'file.js'),
        createMockCallSite(null, 'file.js'),
        createMockCallSite('foo', 'file.js'),
      ];
      const result = deduplicateCallSites(sites);
      expect(result).toHaveLength(2);
    });
  });
});
