import { MavenPluginOptions } from './plugins/types';

describe('Maven Plugin Basic Tests', () => {
  it('should have correct plugin options interface', () => {
    const options: MavenPluginOptions = {
      buildTargetName: 'build',
      testTargetName: 'test',
      serveTargetName: 'serve',
      verbose: true
    };
    
    expect(options.buildTargetName).toBe('build');
    expect(options.verbose).toBe(true);

    expect(options.buildTargetName).toBe('build');
    expect(options.testTargetName).toBe('test');
    expect(options.serveTargetName).toBe('serve');
    expect(options.verbose).toBe(true);
  });

  it('should have optional plugin options', () => {
    const options: MavenPluginOptions = {};

    expect(options.buildTargetName).toBeUndefined();
    expect(options.testTargetName).toBeUndefined();
    expect(options.serveTargetName).toBeUndefined();
    expect(options.verbose).toBeUndefined();
  });
});