# Administrator sign-up and login (EVT-103)

## Endpoints

Both endpoints identify the school from the **`Host` header** (`stmarys.evote.app`), never from
the request body. An unknown, inactive or malformed host answers `404`.

### `POST /api/auth/signup`

Creates the **first administrator** of a school. It is only open while the school has no users;
later teachers and administrators join by invitation (EVT-107).

| Field      | Rules                                                     |
| ---------- | --------------------------------------------------------- |
| `email`    | valid email, at most 255 characters; stored in lower case |
| `password` | 10 or more characters, at most 72 bytes, no NUL character |
| `fullName` | 1 to 255 characters                                       |

Unknown fields are rejected (`400`). Response `201`:

```json
{
  "accessToken": "…",
  "refreshToken": "…",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": { "id": "…", "email": "head@stmarys.test", "fullName": "Head Teacher", "role": "admin" }
}
```

| Status | Meaning                                                          |
| ------ | ---------------------------------------------------------------- |
| `201`  | Administrator created                                            |
| `400`  | Invalid body, or password breaks the policy (`invalid_password`) |
| `404`  | No active school for this host (`unknown_school`)                |
| `409`  | The school already has an administrator (`signup_closed`)        |
| `429`  | Too many attempts from this address                              |

### `POST /api/auth/login`

Body `{ "email", "password" }`. Response `200` has the same shape as sign-up.

| Status | Meaning                                                                                       |
| ------ | --------------------------------------------------------------------------------------------- |
| `200`  | Signed in                                                                                     |
| `401`  | Wrong email or password, or inactive user. **Always the same answer** (`invalid_credentials`) |
| `404`  | No active school for this host                                                                |
| `429`  | Too many attempts from this address                                                           |

## Tokens

- **Access token** (default 15 minutes): sent as `Authorization: Bearer …`. Claims: `sub` (user id),
  `tid` (school id), `role`, `use: "access"`.
- **Refresh token** (default 7 days): signed with a different secret and audience, with
  `use: "refresh"`, so it cannot be used as an access token.
- HS256 only (the algorithm is pinned when verifying), with issuer and audience checks.
- `TokenService.verifyAccessToken` is the function the JWT middleware (EVT-105) should use.

## Security rules in the code

- Every query runs inside `withTenant`, so row-level security applies.
- A per-school lock makes the "first administrator" rule hold under simultaneous requests.
- bcrypt (cost 12; at least 10 outside tests). Passwords over 72 bytes are refused, not truncated.
- Login always performs a password check (against a dummy hash if the email is unknown), so
  neither the answer nor its timing reveals which emails exist.
- Sign-up and login are rate limited per client address (`AUTH_RATE_LIMIT_PER_MINUTE`, default 10).
- Configuration is validated at startup and error messages never contain secret values.
- The server refuses to start if its database role could bypass row-level security.

## Configuration

`DATABASE_URL` (the `evote_app` role), `JWT_SECRET`, `JWT_REFRESH_SECRET` (each at least 32
characters, different from each other), `TENANT_BASE_DOMAIN`. Optional: `PORT`, `BCRYPT_COST`,
`ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS`, `AUTH_RATE_LIMIT_PER_MINUTE`.

## Open questions and known limits

1. **Who may claim the first administrator?** While a school has no users, anyone who can reach its
   subdomain can sign up as its administrator. If schools are created before their real
   administrator arrives, that is a takeover window. Options: create the school and its first
   administrator together, or issue a one-time setup code with the school. Needs a product decision
   with EVT-102.
2. **No refresh, logout or revocation yet.** The refresh token is issued but there is no
   `/api/auth/refresh` or `/api/auth/logout`, and refresh tokens do not rotate. That needs
   server-side storage of token ids and belongs in its own ticket.
3. **Rate limiting is in memory,** per API instance. A shared store (Redis) is needed to enforce it
   across several instances. Behind a proxy, configure Fastify `trustProxy` so the client address
   is the real one.
4. **The `Host` header is trusted** for the school. Terminate TLS and set the host at the edge
   (Cloudflare or the ingress) so clients cannot choose another school's host for a different
   origin.
5. **`super_admin` accounts** are not created here. Proposal: a reserved platform school that holds
   them, created by an operator script.
6. **The subdomain middleware (EVT-106)** will replace the small `tenant-host` helper in this
   change; the routes only need a function that maps a host to a school id.
