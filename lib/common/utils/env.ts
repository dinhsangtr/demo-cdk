// Import the 'dotenv' package to load environment variables from a .env file into process.env
import 'dotenv/config';

/**
 * Function to retrieve the value of an environment variable.
 *
 * @param name - The name of the environment variable to retrieve.
 * @returns The value of the environment variable, or an empty string if the variable is not set.
 */
export function getEnv(name: string): string {
  // Use the name to access the corresponding environment variable in process.env
  // If the variable is not found, return an empty string
  return process.env[name] ?? '';
}
