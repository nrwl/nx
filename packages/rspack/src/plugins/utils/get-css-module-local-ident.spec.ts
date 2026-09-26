import { getCSSModuleLocalIdent } from './get-css-module-local-ident';

describe('getCSSModuleLocalIdent', () => {
  const ctx = {
    rootContext: '/root',
    resourcePath: '/root/apps/demo/src/app/app.module.css',
  };

  afterEach(() => {
    delete process.env.NX_CSS_MODULE_HASH_FUNCTION;
  });

  it('should hash with md5 by default', () => {
    expect(getCSSModuleLocalIdent(ctx, '', 'title', {})).toBe(
      'app_title__FKeAg'
    );
  });

  it('should hash with the algorithm passed by the plugin', () => {
    expect(getCSSModuleLocalIdent(ctx, '', 'title', {}, 'sha256')).toBe(
      'app_title__L7+IP'
    );
  });

  it('should hash with the algorithm from NX_CSS_MODULE_HASH_FUNCTION', () => {
    process.env.NX_CSS_MODULE_HASH_FUNCTION = 'sha256';

    expect(getCSSModuleLocalIdent(ctx, '', 'title', {})).toBe(
      'app_title__L7+IP'
    );
  });

  it('should prefer the plugin algorithm over NX_CSS_MODULE_HASH_FUNCTION', () => {
    process.env.NX_CSS_MODULE_HASH_FUNCTION = 'sha512';

    expect(getCSSModuleLocalIdent(ctx, '', 'title', {}, 'sha256')).toBe(
      'app_title__L7+IP'
    );
  });
});
