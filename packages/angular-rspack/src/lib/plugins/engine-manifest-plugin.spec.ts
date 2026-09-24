import type { Compiler } from '@rspack/core';
import { describe, expect, it, vi } from 'vitest';
import { EngineManifestPlugin } from './engine-manifest-plugin';

describe('EngineManifestPlugin', () => {
  it('should register the virtual module through the compiler own rspack copy', () => {
    const applySpy = vi.fn();
    let received: Record<string, string> | undefined;
    class FakeVirtualModulesPlugin {
      constructor(modules: Record<string, string>) {
        received = modules;
      }
      apply = applySpy;
    }
    const compiler = {
      rspack: {
        experiments: { VirtualModulesPlugin: FakeVirtualModulesPlugin },
      },
    } as unknown as Compiler;

    new EngineManifestPlugin('/proj/__manifest__.js', 'source').apply(compiler);

    expect(received).toEqual({ '/proj/__manifest__.js': 'source' });
    expect(applySpy).toHaveBeenCalledWith(compiler);
  });

  it('should fail when the compiler rspack copy has no virtual modules support', () => {
    const compiler = {
      rspack: { experiments: {} },
    } as unknown as Compiler;

    expect(() =>
      new EngineManifestPlugin('/proj/__manifest__.js', 'source').apply(
        compiler
      )
    ).toThrow(
      'The "@angular/ssr" application engine wiring requires the "@rspack/core" copy running the build to support virtual modules (version 1.5.0 or greater).'
    );
  });
});
