# Sprint 0 review and retrospective, then Sprint 1 planning

|           |                                                                                        |
| --------- | -------------------------------------------------------------------------------------- |
| **When**  | Friday 16 October 2026 (review, retrospective); Sprint 1 planning on Monday 19 October |
| **Where** | To be confirmed by the chair                                                           |
| **Chair** | To be confirmed (the chair rotates weekly)                                             |
| **Board** | https://github.com/users/iranziresponse/projects/1                                     |
| **Start** | Issue #74 in the repository                                                            |

Sprint 0 goal: _everyone can run the project locally and the team has a clean development
foundation._

## Before the meeting

Everyone, by Thursday evening:

- Open pull requests have a description, a linked ticket and a requested reviewer.
- You have reviewed the pull requests that name you as reviewer (review within 24 hours).
- Anything blocking you is written on its ticket with the `blocked` label.
- Be ready to **demo something that works**, not slides.

## Agenda

| Time   | Item                                                                        | Led by       |
| ------ | --------------------------------------------------------------------------- | ------------ |
| 10 min | Open items: each person says done, in review, or blocked                    | Chair        |
| 45 min | **Sprint 0 review:** demos; the Product Lead accepts or rejects each ticket | Product Lead |
| 45 min | **Retrospective:** what went well, what did not, one change                 | Whole team   |
| 10 min | Decisions needed (below)                                                    | Chair        |

**Sprint 1 planning** (90 minutes) follows on Monday 19 October, as the Kanban plan prescribes.

## Sprint 0 status (as of 14 October)

| Ticket  | Work                              | Owner      | State                                              |
| ------- | --------------------------------- | ---------- | -------------------------------------------------- |
| EVT-001 | Repo structure, branch protection | Tonny      | Ruleset active; folder skeleton in PR #2 (review)  |
| EVT-002 | Terraform dev AWS environment     | Response   | PR #4 ready for review; network applied at no cost |
| EVT-003 | Fastify API and `/health`         | Hannah     | Merged; does not match its criteria (decision 1)   |
| EVT-004 | Next.js app and 4 route stubs     | Jackie     | No pull request yet                                |
| EVT-005 | Dockerize API, Postgres, Redis    | Hannah     | PR #3 in review; Web container waits on EVT-004    |
| EVT-006 | CI: lint, test, build on PR       | Bernadette | No pull request yet                                |
| EVT-007 | Shared TypeScript/ESLint/Prettier | Hannah     | Merged; awaiting acceptance                        |
| EVT-008 | Project README and local setup    | Tonny      | PR #2 in review; needs a ticket-ID title           |

## Decisions needed

1. **EVT-003:** does `/health` keep port 3000 and `timestamp`, or change to port 3001 with
   `time` and `version` as the ticket says? _Decider: Product Lead._
2. **AWS account:** who owns it and who pays? Until decided, the sandbox creates only free network
   resources and the database stays off. The charter has no finance owner yet.
3. **ORM for the API:** Drizzle or Prisma. The blueprint says to pick one and stay with it.
   _Proposal: Drizzle._
4. **Redis version:** ElastiCache Redis stops at 7.1; the blueprint says 7.2 (Valkey on AWS).
5. **Repository home:** keep it under a personal account, or move it to an organization as
   EVT-001 describes.

## Sprint 0 completion checklist

- [ ] All primary tasks meet their acceptance criteria
- [ ] Support owners have reviewed the important work in their area
- [ ] Integration between affected areas has been tested
- [ ] Known bugs and blockers are documented and prioritised
- [ ] The Product Lead has completed product acceptance for the sprint goal
- [ ] The QA reviewer has verified the acceptance criteria
- [ ] The team has demonstrated the sprint outcome
- [ ] Lessons and improvements are recorded in the retrospective

## Retrospective prompts

- What helped us ship this sprint, and what slowed us down?
- Where did a decision wait too long, and who needed to make it?
- Did reviews happen within 24 hours? If not, what got in the way?
- Pick **one** concrete change for Sprint 1 and name its owner.

## Sprint 1 preview (Monday)

**Goal:** a school can securely exist as a tenant, admins can authenticate, and an election can be
configured. 55 points.

| Person     | Tickets                            | Points |
| ---------- | ---------------------------------- | ------ |
| Response   | EVT-101, EVT-103, EVT-104, EVT-108 | 18     |
| Hannah     | EVT-102, EVT-105, EVT-106, EVT-109 | 16     |
| Jackie     | EVT-110, EVT-111, EVT-112          | 13     |
| Bernadette | EVT-107, EVT-113                   | 8      |
| Tonny      | Product ownership and acceptance   | 0      |

## Working agreements (reminder)

- Every change goes through a pull request with at least one approval.
- Titles start with the ticket ID, for example `EVT-102: Tenant creation API`.
- At most two tasks in progress per person.
- Blockers are reported the same day, not at the end of the week.
- Full rules: [CONTRIBUTING.md](../../CONTRIBUTING.md).
