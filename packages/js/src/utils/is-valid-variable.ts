/**
 * Determines if a given string is a valid JavaScript variable name.
 * @param name name of the variable to be checked
 * @returns result object with a boolean indicating if the name is valid and a message explaining why it is not valid
 */
export function isValidVariable(name: string): {
  isValid: boolean;
  message: string;
} {
  const validRegex = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

  if (validRegex.test(name)) {
    return { isValid: true, message: 'The name is a valid identifier.' };
  } else {
    if (name === '') {
      return { isValid: false, message: 'The name cannot be empty.' };
    } else if (/^[0-9]/.test(name)) {
      return { isValid: false, message: 'The name cannot start with a digit.' };
    } else if (/[^a-zA-Z0-9_$]/.test(name)) {
      return {
        isValid: false,
        message:
          'The name can only contain letters, digits, underscores, and dollar signs.',
      };
    } else if (/^[^a-zA-Z_$]/.test(name)) {
      return {
        isValid: false,
        message:
          'The name must start with a letter, underscore, or dollar sign.',
      };
    }
    return {
      isValid: false,
      message: 'The name is not a valid JavaScript identifier.',
    };
  }
}
