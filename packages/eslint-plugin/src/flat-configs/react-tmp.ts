import tseslint from 'typescript-eslint';
import reactBase from './react-base';
import reactTypescript from './react-typescript';
import reactJsx from './react-jsx';

/**
 * THIS IS A TEMPORARY CONFIG WHICH MATCHES THE CURRENT BEHAVIOR
 * of including all the rules for all file types within the ESLint
 * config for React projects.
 *
 * It will be refactored in a follow up PR to correctly apply rules
 * to the right file types via overrides.
 */
export default tseslint.config(...reactBase, ...reactTypescript, ...reactJsx);
