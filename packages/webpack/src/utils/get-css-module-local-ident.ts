import { posix } from 'path';
import { getHashDigest, interpolateName } from 'loader-utils';

export function getCSSModuleLocalIdent(
  ctx,
  localIdentName,
  localName,
  options
) {
  // Use the filename or folder name, based on some uses the index.js / index.module.(css|scss|sass) project style
  const fileNameOrFolder = ctx.resourcePath.match(
    /index\.module\.(css|scss|sass|styl)$/
  )
    ? '[folder]'
    : '[name]';
  // Create a hash based on a the file location and class name. Will be unique across a project, and close to globally unique.
  const hash = getHashDigest(
    posix.relative(ctx.rootContext, ctx.resourcePath) + localName,
    'md5',
    'base64',
    5
  );
  // Use loaderUtils to find the file or folder name
  const className = interpolateName(
    ctx,
    `${fileNameOrFolder}_${localName}__${hash}`,
    options
  );
  // Remove the .module that appears in every classname when based on the file and replace all "." with "_".
  return className.replace('.module_', '_').replace(/\./g, '_');
}
