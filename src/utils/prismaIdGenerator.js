const { v4: uuidv4, v5: uuidv5 } = require('uuid');

// Namespace for our application (using a UUID v4)
// This helps ensure our v5 UUIDs are unique across different applications
const APP_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

/**
 * Generates a unique UUID that is compatible with PostgreSQL's UUID type.
 * By default, it uses UUID v4 which is completely random and suitable for most cases.
 * 
 * @returns {string} A UUID v4 string
 */
function generateUUID() {
  return uuidv4();
}

/**
 * Generates a deterministic UUID v5 based on a name/key and optional context.
 * This is useful when you need the same UUID for the same input data.
 * 
 * @param {string} name - The name/key to generate UUID from
 * @param {string} [context=''] - Additional context to make the UUID more specific
 * @returns {string} A UUID v5 string
 */
function generateDeterministicUUID(name, context = '') {
  const nameWithContext = `${name}-${context}`;
  return uuidv5(nameWithContext, APP_NAMESPACE);
}

/**
 * Validates if a string is a valid UUID
 * 
 * @param {string} uuid - The string to validate
 * @returns {boolean} True if the string is a valid UUID
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

module.exports = {
  generateUUID,
  generateDeterministicUUID,
  isValidUUID
};
