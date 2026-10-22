import pg from "pg";

export const MIN_APP_PASSWORD_LENGTH = 12;

/**
 * Gives the application role `evote_app` a login with the given password. Migration 0001 creates
 * the role without a login; each environment provisions it with a password from its own secret
 * store. Connect as the database owner. Run it again to rotate the password.
 */
export async function provisionApplicationRole(
  ownerConnectionString: string,
  password: string,
): Promise<void> {
  if (password.length < MIN_APP_PASSWORD_LENGTH) {
    throw new Error(`The application role password must be at least ${MIN_APP_PASSWORD_LENGTH} characters`);
  }
  const client = new pg.Client({ connectionString: ownerConnectionString });
  await client.connect();
  try {
    // ALTER ROLE cannot take a bind parameter, so the literal is escaped by the driver.
    await client.query(`alter role evote_app login password ${client.escapeLiteral(password)}`);
  } finally {
    await client.end();
  }
}
