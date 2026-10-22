import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 10;
/** bcrypt ignores everything after the 72nd byte, so longer passwords are refused, not truncated. */
export const MAX_PASSWORD_BYTES = 72;

/** Returns a message when the password breaks the policy, or null when it is acceptable. */
export function validatePassword(password: string): string | null {
  if ([...password].length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes`;
  }
  // bcrypt treats a NUL byte as the end of the password.
  if (password.includes("\u0000")) {
    return "Password contains an invalid character";
  }
  return null;
}

/** The algorithm sits behind this interface so it can change without touching the routes. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly cost: number) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.cost);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    // A password longer than the limit can never match a stored one (signup refuses them), so
    // do not let bcrypt truncate it into a false match.
    if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES || password.includes("\u0000")) {
      return false;
    }
    return bcrypt.compare(password, hash);
  }
}
