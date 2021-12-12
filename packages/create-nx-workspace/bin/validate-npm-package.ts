const scopedPackagePattern = new RegExp('^(?:@([^/]+?)[/])?([^/]+?)$');
const denyList = ['node_modules', 'favicon.ico'];

export interface ValidateNpmResult {
  validForNewPackages: boolean;
  validForOldPackages: boolean;
  errors?: string[];
  warnings?: string[];
}

export function validateNpmPackage(name: string) {
  let warnings = [];
  let errors = [];

  if (name === null) {
    errors.push('name cannot be null');
    return formatResult(warnings, errors);
  }

  if (name === undefined) {
    errors.push('name cannot be undefined');
    return formatResult(warnings, errors);
  }

  if (typeof name !== 'string') {
    errors.push('name must be a string');
    return formatResult(warnings, errors);
  }

  if (!name.length) {
    errors.push('name length must be greater than zero');
  }

  if (name.match(/^\./)) {
    errors.push('name cannot start with a period');
  }

  if (name.match(/^_/)) {
    errors.push('name cannot start with an underscore');
  }

  if (name.trim() !== name) {
    errors.push('name cannot contain leading or trailing spaces');
  }

  // No funny business
  denyList.forEach(function (denyListedName) {
    if (name.toLowerCase() === denyListedName) {
      errors.push(denyListedName + ' is a deny listed name');
    }
  });

  // really-long-package-names-------------------------------such--length-----many---wow
  // the thisisareallyreallylongpackagenameitshouldpublishdowenowhavealimittothelengthofpackagenames-poch.
  if (name.length > 214) {
    warnings.push('name can no longer contain more than 214 characters');
  }

  // mIxeD CaSe nAMEs
  if (name.toLowerCase() !== name) {
    warnings.push('name can no longer contain capital letters');
  }

  if (/[~'!()*]/.test(name.split('/').slice(-1)[0])) {
    warnings.push('name can no longer contain special characters ("~\'!()*")');
  }

  if (encodeURIComponent(name) !== name) {
    // Maybe it's a scoped package name, like @user/package
    const nameMatch = name.match(scopedPackagePattern);
    if (nameMatch) {
      const user = nameMatch[1];
      const pkg = nameMatch[2];
      if (
        encodeURIComponent(user) === user &&
        encodeURIComponent(pkg) === pkg
      ) {
        return formatResult(warnings, errors);
      }
    }

    errors.push('name can only contain URL-friendly characters');
  }

  return formatResult(warnings, errors);
}

function formatResult(warnings: string[], errors: string[]): ValidateNpmResult {
  return {
    validForNewPackages: errors.length === 0 && warnings.length === 0,
    validForOldPackages: errors.length === 0,
    ...(warnings.length && { warnings }),
    ...(errors.length && { errors }),
  };
}
