// if using without the daemon, the hashEnv is always going to be the process.env.
// When using the daemon, we'll need to set the hashEnv with `setHashEnv`

let hashEnv = process.env;

/**
 * Set the environment to be used by the hasher
 * @param env
 */
export function setHashEnv(env: any) {
  hashEnv = env;
}

/**
 * Get the environment used by the hasher
 */
export function getHashEnv() {
  return hashEnv;
}
