# Contributing to Evote

These are the working agreements for everyone on the team. They exist so that `main` is always
deployable, reviews are quick, and nobody is the only person who understands a component.

## 1. Getting started

```bash
# Node >= 22 (see .nvmrc) and pnpm (pinned via packageManager)
pnpm install --frozen-lockfile

pnpm lint            # ESLint
pnpm format:check    # Prettier
pnpm -r typecheck    # TypeScript, all packages
pnpm -r test         # Vitest, all packages
```

Run all four before you open a pull request. Use `--frozen-lockfile` so you never change the
lock file by accident; change dependencies deliberately and commit the lock file with them.

## 2. Branching

- `main` is protected: no direct pushes, no force pushes, no deletion.
- Branch from an up-to-date `main` and keep branches short-lived (days, not weeks).
- Name branches `<type>/<ticket>-<slug>`:
  `feat/evt-102-tenant-api`, `fix/evt-104-rls-policy`, `chore/repo-governance`, `docs/readme`.
- One ticket per branch and per pull request.

## 3. Commits

Conventional Commits with the ticket id when there is one:

```
feat(api): bootstrap Fastify API with /health endpoint (EVT-003)
fix(auth): reject expired refresh tokens (EVT-103)
chore(infra): ignore terraform state and variable files (EVT-002)
```

- Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`.
- Imperative mood, subject up to 72 characters, no trailing full stop.
- The body explains _why_, not what; the diff already shows what.
- One logical change per commit, so reviewers can read the history in order.
- A commit carries its author's identity only. Do not add `Co-authored-by` or tool-attribution
  trailers; the person who commits a change owns it.
- Never commit secrets, `.env` files, Terraform state or personal data.

## 4. Pull requests

- **Title:** `EVT-123: Short summary` (or a conventional title for non-ticket work such as
  `chore(ci): add dependabot`). A check enforces this.
- **Size:** aim for under ~400 lines of diff, excluding lock files and generated code. If a ticket
  cannot be split, say why in the description and structure the commits for review.
- **Description:** fill in the template: what, why, how it was tested, acceptance criteria,
  risks. State plainly what you did **not** verify.
- **Draft first** if the work is not ready; mark ready when acceptance criteria are met.
- **Reviews:** at least one approval from someone other than the author. Request the primary and
  support owner for the area (see `.github/CODEOWNERS`). Review within 24 hours when asked.
- **Conversations** must be resolved before merge; stale approvals are dismissed on new pushes.
- Keep at most two tasks in progress at once.

## 5. Definition of Done

A change is done only when all of these are true:

- [ ] Implementation complete and acceptance criteria satisfied
- [ ] Automated tests written or updated and passing (aim for >= 70% coverage on new files)
- [ ] Lint, type-check and build are clean in CI
- [ ] Primary and support owners have reviewed it
- [ ] No known High or Critical security issue is introduced
- [ ] Documentation is updated when setup, architecture or operations change
- [ ] It works with the parts of the system that depend on it
- [ ] It can be demonstrated at the Sprint Review

## 6. Engineering standards

- **TypeScript** in `strict` mode; no `any`, no `@ts-ignore`, no `console.log` (use the logger).
- **Validate input at the boundary** and never trust a client-supplied tenant, role or kiosk id.
- **Zero PII:** no student names, ids, emails or rosters in code, fixtures, seeds, logs or tests.
  Use obviously fake data.
- **Tenant isolation** is enforced in layers: subdomain, token claim, database Row-Level Security
  and Redis key prefixes. Every new tenant table ships with RLS and a cross-tenant test.
- **Secrets** come from the environment or AWS Secrets Manager. `.env*` files are git-ignored except
  `.env.example`.
- **Tests:** unit tests for logic; integration tests against real Postgres and Redis for anything
  involving RLS, queues or tallies. A bug fix lands with the test that would have caught it.

## 7. Infrastructure changes

Infrastructure lives in `infra/terraform` and is documented in
[`infra/terraform/README.md`](infra/terraform/README.md). In short: format and validate locally,
include the `terraform plan` summary in the pull request, and only apply from `main` after merge.

## 8. Repository settings (administrators)

Repository rules cannot be enforced from files alone. A repository admin should apply them once:

1. **Branch protection ruleset:** import [`.github/rulesets/main-protection.json`](.github/rulesets/main-protection.json)
   in _Settings → Rules → Rulesets → New ruleset → Import a ruleset_, or run
   `gh api repos/hannah248olives/EVOTE/rulesets --method POST --input .github/rulesets/main-protection.json`.
   It requires a pull request with one approval, dismisses stale approvals, requires resolved
   conversations, and blocks force-pushes and deletion of `main`.
2. **Required status checks:** once the CI workflow (EVT-006) is merged, add its jobs and the
   `PR title` check to the ruleset under _Require status checks to pass_. Do not require a check
   that does not exist yet, or every pull request will be blocked.
3. **General settings:** enable _Automatically delete head branches_.
4. **Security:** enable secret scanning, push protection, Dependabot alerts and Dependabot security
   updates under _Settings → Code security_.

## 9. Tracking work: the project board

Work is tracked in **GitHub Issues and a GitHub Project board** so that everyone sees the same
state, and pull requests tick tickets off automatically.

- **One ticket = one issue** titled `EVT-123: Short summary`. Each issue carries the owner, the
  support reviewer, the story points, the acceptance criteria and the Definition of Done.
- **Labels:** `sprint-N`, `owner:<name>`, `area:<area>`, `pts:<n>`, plus `blocked` and `in-review`.
  Each sprint is a **milestone** with its goal in the description.
- **Board columns** (left to right; tickets never skip a column):

  | Column      | Meaning                                        | Rule                                               |
  | ----------- | ---------------------------------------------- | -------------------------------------------------- |
  | Backlog     | Everything, prioritised                        | Owned by the Product Lead                          |
  | To Do       | Committed for the current sprint               | Has an owner, an estimate and acceptance criteria  |
  | In Progress | Being worked on                                | You pull it; **max 2 per person**; update it daily |
  | Review      | Pull request open, awaiting review             | PR has a description and a requested reviewer      |
  | Done        | Meets the Definition of Done, merged to `main` | Reviewer approved, CI green, demo-able             |

- **Linking:** put `Closes #<issue>` in the pull request description. Merging then closes the issue
  and moves the card to Done.
- **Blocked?** Add the `blocked` label and say so at standup the same day. Never sit silently.
- **Changing scope:** if a ticket is bigger than expected, split it and send the remainder back to
  the Backlog rather than forcing it through.
- **Sprint ceremonies** (planning, review, retrospective) use the milestone for the sprint as the
  agenda; unfinished tickets are re-planned, never silently dropped.
