# Verification record

UI refinement verification (2026-09-18): production build and browser checks passed for the single address input, guided offer validation, renter history, repeated-address indication, booking links, and price stability under arrow keys and mouse-wheel movement. Desktop and mobile screenshots were inspected. These UI changes require no new SQL migration.

Verified locally on 2026-09-17.

| Check                                             | Result                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| Dependency installation and lockfile              | Passed; exact versions pinned, Node 22.x required |
| TypeScript                                        | Passed                                            |
| Next.js production build                          | Passed                                            |
| Date/balance/late-state unit tests                | 4 passed                                          |
| Actual migrations in local PostgreSQL (PGlite)    | 39 database checks passed                         |
| Production setup/login and admin route protection | Passed without configured credentials             |
| RTL desktop and mobile component browser checks   | Passed; zero browser runtime errors               |
| Screenshots inspected                             | Desktop workspace and mobile workspace            |

Database checks include inclusive ranges and boundary conflicts, direct exclusion-constraint enforcement, separate physical items, multi-item agreements, booking deposits, best-offer pricing, percentage/fixed/category/bundle offers, cent-accurate item allocations, negotiated prices, multiple payments, overpayment rejection, immutable historical snapshots, atomic rollback, same-town warnings, fitting defaults, item-specific return/cleaning, tenant isolation, disabled accounts, private storage folder policies, notification deduplication/read state, and safe deletion.

Browser screenshots are generated into the git-ignored `test-results/` directory by `npm run test:browser`. Authenticated workspace screenshots use an isolated, empty test fixture in `tests/browser/entry.tsx`; no fixture route or data source is included in the production application.

**Not yet verified against a hosted project:** Supabase Auth email/phone sign-in, administrative provisioning over the Auth API, actual Storage HTTP uploads/signed URLs, SMS/SMTP delivery, independent network concurrency, and Vercel deployment. No project credentials were supplied. Use `docs/ACCEPTANCE.md` to verify these after setup; local PostgreSQL/platform-schema tests do not substitute for hosted integration checks.
