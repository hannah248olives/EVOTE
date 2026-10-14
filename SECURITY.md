# Security policy

Evote handles election integrity and tenant isolation, so security reports are taken seriously.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private vulnerability reporting:
<https://github.com/hannah248olives/EVOTE/security/advisories/new>

Include what you found, how to reproduce it, and the impact you expect. Please do not include real
personal data, and do not test against systems you do not own.

## What to expect

This is a student-built project; responses are best effort. We aim to acknowledge a report within a
few days and to fix confirmed High or Critical issues before any release.

## Scope of particular interest

- Cross-tenant data access (breaking Row-Level Security or subdomain isolation)
- Vote integrity: duplicate votes, tampering with tallies or receipts
- Authentication, token handling and kiosk provisioning/decoupling
- Exposure of secrets or personal data

## Project practices

- Zero student PII is stored by design; reports of any PII exposure are treated as Critical.
- Secrets are never committed, and dependency updates are managed through Dependabot.
