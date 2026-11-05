# Wanderlust: Public Launch Audit

| | |
| --- | --- |
| **Audit date** | 2026-11-03 |
| **Scope** | Whole repository at `main` plus uncommitted working-tree changes |
| **Method** | Code inspection, existing Jest and Playwright suites, and live HTTP probes against an isolated in-memory MongoDB instance |
| **Nothing was modified** | No application file was edited and no real database was touched. This report is the only file added. |

> **Moving target.** The working tree changed while the audit was running. `public/js/datepicker.js`, a `<script>` tag for it in `views/layouts/boilerplate.ejs`, and a `guests` rule in `schema.js` all appeared mid-audit. I did not make those edits. Findings about the hero search (D7, D13) describe the tree as of the end of the audit and may already be out of date.

---

## 1. Executive summary

**Wanderlust is a well-built, well-tested prototype of a stay-listing and date-reservation site. It is not yet a commercial booking platform.** What exists is solid: the double-booking guard is correct under concurrency, CSRF/CSP/session handling is better than most student or early-stage apps, and 195 unit/integration tests plus 26 browser tests pass. What is missing is everything around the reservation that makes it safe to take real customers: payment, notifications, legal pages, host controls, and honest data.

### Headline numbers (55 features inventoried)

| Status | Count |
| --- | --- |
| Fully functional | **15** |
| Partially functional | **11** |
| UI only | **4** |
| Mocked | **2** |
| Broken | **1** |
| Missing | **17** |
| Not verified | **5** |

**Estimated completeness:** about **85% of the scope in `docs/PRD.md`** (the PRD deliberately excludes payments, email, host availability rules and more), but only about **35–40% of a launch-ready travel marketplace** (15 fully working plus half-credit for 11 partial, out of 55 inventoried features).

### Critical launch blockers (P0)

1. **Fabricated social proof.** Every listing with no reviews shows a rating of **4.8 with 24 reviews** and a "Best seller" badge (`views/includes/listingCard.ejs:3-16`). This is invented data shown to customers.
2. **Privacy and Terms links go nowhere** (`href="#"` in `views/includes/footer.ejs`). The site collects emails and passwords with no policy.
3. **"Confirmed" bookings involve no payment, no host acceptance and no email.** A guest can lock any host's calendar for 30 nights per click, anonymously-priced, with nobody notified. Either this is explicitly a "request to book / pay at property" product with wording to match, or payments must be built.
4. **No contact, support, dispute or refund path** exists anywhere.
5. **Dependency advisories:** `npm audit --omit=dev` reports 8 (3 high: `multer`, `joi`, `body-parser`). Fix before exposing to the internet.

### Five highest-priority actions

1. Remove the fake 4.8/24 fallback and the invented badges. Show "New" for unreviewed listings.
2. Write and link Privacy, Terms and cancellation/refund pages (human and legal review needed), plus a support contact.
3. Decide the booking model (pay online / pay at property / host-approval request), then add confirmation emails to guest and host and a cancellation notice.
4. Run `npm audit fix`, re-run the test suite, and configure SMTP so password reset actually works.
5. Make currency honest: either remove the selector or use real exchange rates and show the charged currency at checkout.

---

## 2. Existing application architecture

Server-rendered monolith. No SPA, no separate API.

| Layer | Choice |
| --- | --- |
| Runtime | Node >= 20, Express 4.22, CommonJS |
| Views | EJS + `ejs-mate` layouts, Bootstrap 5.3.8, Font Awesome, Bootstrap Icons (CDNs) |
| Database | MongoDB via Mongoose 9 (Atlas in production) |
| Auth | Passport local + `passport-local-mongoose` (PBKDF2 hashing) |
| Sessions | `express-session`, `connect-mongo` store with encrypted payload, 7-day cookie |
| Security | Helmet with a custom CSP, `csrf-sync` (token per session), `express-rate-limit` |
| Validation | Joi schemas in `schema.js` applied by `validate()` in `middleware.js` |
| Images | Multer to local `uploads/`, then Cloudinary; temp file removed afterward |
| Maps | Mapbox GL (client) and Mapbox geocoding (server proxy `/listings/geocode`) |
| Email | Nodemailer, used **only** for password reset (`utils/mailer.js`) |
| Tests | Jest (18 suites, `mongodb-memory-server`), Playwright (26 tests) |
| Hosting hints | `trust proxy` set in production, comment mentions Render. No Dockerfile, Procfile, `render.yaml` or CI. |

Data model (5 collections): `User` (email, wishlist, reset-token hash, `passwordChangedAt`), `Listing` (price, currency, GeoJSON point, category, type, denormalised `avgRating`/`reviewCount`, owner, reviews[]), `Review`, `Booking` (listing, guest, checkIn/Out, `nights[]`, `totalPrice`, status `confirmed|cancelled`). Booking does **not** store currency, guest count, fees or payment state.

---

## 3. Route and module inventory

| Method + path | Auth | Purpose | Verified |
| --- | --- | --- | --- |
| `GET /` | none | Redirect to `/listings` | live 302 |
| `GET /listings` | none | Search, filter, paginate (12/page) | live 200 |
| `GET /listings/map` | none | Clustered map of filtered listings | live 200, map itself not verified (no token) |
| `GET /listings/new` / `POST /listings` | login | Create listing with one image | form rendered live; submit blocked by Cloudinary (not configured) |
| `GET /listings/:id` | none | Detail, booking panel, reviews | live 200 |
| `GET /listings/:id/edit`, `PUT`, `DELETE /listings/:id` | owner | Edit/delete | non-owner redirected live; success path tests only |
| `GET /listings/geocode` | login, 60/min | Mapbox proxy | not verified (no token) |
| `POST /listings/:id/bookings` | login | Reserve | live |
| `POST /listings/:id/reviews`, `DELETE .../:reviewId` | login / author | Reviews | live (create), tests (delete) |
| `GET /bookings`, `GET /bookings/hosting`, `DELETE /bookings/:id` | login / party | Trips, host list, cancel | live |
| `GET /wishlist`, `POST` / `DELETE /wishlist/:id` | login | Saved stays | live |
| `GET/POST /signup`, `/login`, `/forgot-password`, `/reset-password/:token`, `POST /logout` | none / limiter | Account | live except reset success path |
| Static: `/css`, `/js`, `/fonts`, `/assets`, `site.webmanifest` | none | | live |

**Not present (all returned 404 live):** `/privacy`, `/terms`, `/contact`, `/help`, `/profile`, `/account`, `/dashboard`, `/health`, `/healthz`, `/robots.txt`, `/sitemap.xml`.

**Backend endpoints never reached by a UI control:** none found. Every route has a view or form. **Frontend controls with no backend:** the hero "Guests" selector, the "Watch the story" button, the footer social icons, and the Privacy/Terms links.

---

## 4. Frontend functionality audit

| # | Location | Finding | Evidence |
| --- | --- | --- | --- |
| F1 | `views/includes/listingCard.ejs:15-16` | Unreviewed listings display rating "4.8" and "(24)" reviews. Badge defaults to "Best seller" for any listing. Photo count is computed from title length (line 19). | Code; every card on a fresh seed |
| F2 | `views/listings/index.ejs` (hero) | **Guests selector is UI only.** Adults/children steppers update a hidden `guests` input and `schema.js` now accepts it, but `Listing.search` never reads it and listings have no capacity field. | Live: `?guests=1` and `?guests=16` both returned the same 12 cards and "29+ stays" |
| F3 | `views/includes/footer.ejs` | Privacy and Terms are `href="#"`. Facebook/Instagram/LinkedIn icons are bare `<i>` with no link. | Code |
| F4 | `views/listings/index.ejs` hero | "Watch the story / Amalfi Coast, Italy" play button has no handler or target. | Code; no JS references it |
| F5 | `views/listings/index.ejs` | Count label shows "29+ stays" when exactly 29 match (`total > 20 ? total + '+'`). | Live |
| F6 | `?page=99` | Returns 200 with the "No stays found" empty state and no way back except "Clear all filters". | Live |
| F7 | `public/js/currency.js` + `public/js/booking.js` | Switching currency converts card/detail prices but **not** the booking summary. `booking.js` captured `price` and the formatter once at load; `currency.js` later mutates `dataset.price` and dispatches a `change` event that nothing listens to. Page shows "$22" while the reservation summary shows "₹1,800 x nights". | Code inspection only, not reproduced in a browser |
| F8 | Sidebar (`views/includes/sidebar.ejs`) | "Experiences" is just `?category=Unique Stays`; "Destinations" is the map; "Stays" duplicates "Explore". There is no Experiences product. | Code |
| F9 | Show page | No page-specific `<title>` (every page is "WanderLust"), no `<h1>` (uses `<h3>`), single image, no gallery. | Live |
| F10 | Dark mode | Tokens exist for `[data-theme="dark"]`, but nothing sets the attribute: no toggle and no `prefers-color-scheme` handling. Dark mode is unreachable. | Code |
| F11 | `views/listings/index.ejs` empty state | Uses `style="..."`, which the CSP blocks and `CLAUDE.md` forbids. Brand-mark SVGs in `sidebar.ejs` and `index.ejs` hard-code hex fills (`#D3A85A`, `#EDE9DF`, `#BA8F40`) against the colour rules. | Code |
| F12 | Hero date picker (`public/js/datepicker.js`) | Appeared during the audit. Not covered by any test; behaviour not verified. | Not verified |
| F13 | Flash alerts | Auto-dismiss after 3 s (`public/js/flash.js`), including error messages that carry `role="alert"`. Users may miss errors. | Code |

What does work in the browser (26 Playwright tests passed): console clean on all main pages, booked nights disabled in the calendar, Reserve disabled until a valid range, map pin picking (stubbed Mapbox), keyboard-accessible star rating, confirm dialogs on delete/cancel, currency selector persistence on listing prices, pagination, mobile/tablet auth layouts.

---

## 5. Backend and database audit

**Strengths (verified live or by tests)**

- Double-booking is prevented at the database level: a unique partial index on `{listing, nights}` where `status = "confirmed"` (`models/booking.js:29`). **Live test: 10 simultaneous identical bookings produced exactly 1 success and 9 rejections.** Cancelled bookings free their nights.
- Search runs at the database level (`$text`, price, rating, country, geo, availability via `Booking.distinct`), paginated with `skip/limit` and a separate `countDocuments`. Indexes exist for text, category+price, country+price, rating and 2dsphere.
- Cascade cleanup on listing delete (reviews, bookings, wishlist entries). Delete is refused while upcoming bookings exist.
- Image upload validates MIME type, 5 MB cap, one file; temp files removed on every path; Cloudinary asset destroyed if the DB save fails.
- Errors: Mongoose `CastError` maps to 404, 5xx messages are scrubbed. Live: bad ids and bad query strings return 404/400, not stack traces.

**Gaps**

| ID | Finding | Priority |
| --- | --- | --- |
| BE1 | `Booking` stores no currency. If a host edits a listing's currency later, historic `totalPrice` values are displayed in the wrong currency (`views/includes/bookingRow.ejs` formats with the listing's *current* currency). | P1 |
| BE2 | Search price filter compares the raw number across all currencies: `minPrice=2500&maxPrice=2500` matches ₹2,500 and $2,500 equally. All 29 seeded listings are INR, so this was not visible in testing. | P1 |
| BE3 | A guest can hold overlapping bookings on different properties (live: same dates on two listings both confirmed). | P2 |
| BE4 | No transactions or retry logic; acceptable for single-document writes, but review create is two writes (`Review` then `Listing.$push`) with a compensating delete. | P3 |
| BE5 | No migrations framework. `init/migrate.js` is a one-off backfill. No backup or restore procedure documented. | P1 |
| BE6 | `node init` wipes all listings, bookings and wishlist entries whenever `NODE_ENV` is not `production` and `.env` holds the Atlas URL. `app.js` also auto-seeds demo data into an empty non-production database. A mis-set `NODE_ENV` on the live server would seed demo listings into production. | P1 |
| BE7 | Listing schema has no capacity, bedrooms, amenities, multiple images, house rules, check-in times, cleaning fee or blocked dates. | P1 (capacity), P2 (rest) |
| BE8 | No structured logging, request logging, error tracking or metrics. Session-store errors are only `console.log`ged. | P1 |
| BE9 | Country list cache is per-process (documented in code). Fine for one instance. | P3 |
| BE10 | Express 4, no compression middleware, no cache headers on static assets (live: `cache-control` absent). | P2 |

---

## 6. Authentication and authorization audit

| Area | Result | Evidence |
| --- | --- | --- |
| Password hashing | PBKDF2 via passport-local-mongoose | Code |
| Password policy | **Only 8-100 characters.** `12345678` was accepted at signup. The PRD (FR-10) says "at least one letter and one digit" and marks it Built; it is not enforced (`schema.js:48`). | Live |
| Login with username or email | Works; one generic error message for unknown user and wrong password | Live |
| Brute force | `authLimiter` 10 requests / 15 min **per IP across signup, login, forgot and reset together** (`middleware.js:188`). Live: 13 bad logins returned `302 x5` then `429`. Per-IP only: shared networks (campuses, offices) can lock each other out; no per-account lockout. | Live |
| Session cookie | `HttpOnly`, `SameSite=Lax`, `Secure` only when `NODE_ENV=production`. Live (non-prod) cookie had no `Secure`, as designed. Production flag **not verified** (no production run). | Live + code |
| Session invalidation | Password reset invalidates older sessions (`sessionFreshness`). Logout is POST. | Code + tests |
| Password reset | Token is 32 random bytes, only its SHA-256 is stored, 1-hour expiry, single use, identical response for known/unknown email. **Cannot send email without `SMTP_HOST` and `APP_URL`**; with neither set the user sees "we have sent a reset link" and nothing is sent. Live confirmed: log said "Password reset skipped". The success path is covered by `tests/integration/passwordReset.test.js` only. | Live + tests |
| Email verification | None. Anyone can register any email address. | Code |
| Account management | No profile, change password (while logged in), change email, or delete account. | Live 404s |
| Roles | No roles. Every user can both guest and host (PRD A1). Acceptable, but there is no host onboarding or verification. | Code |
| IDOR: bookings | `isBookingParty` restricts to the guest or the listing owner. **Live: another user's cancel attempt was refused and the booking remained active.** | Live |
| IDOR: listings | Edit page for a non-owner redirected live. Edit/delete enforce `isOwner`. | Live + code |
| IDOR: reviews | Author-only delete; also requires the review to belong to that listing. | Code + tests |
| Unauthenticated writes | All mutating routes need login and a CSRF token. Live: missing token returned 403. | Live |
| Signup enumeration | Signup reveals "That username is taken" and "That email is already registered". Common trade-off; note for privacy review. | Live |

---

## 7. Security and privacy assessment

**Good:** Helmet + explicit CSP (no `unsafe-inline`), CSRF on every write including multipart, EJS escaping (live: `<script>` in a review rendered inert), JSON-in-HTML escapes `<`, open-redirect guard on post-login redirect (`saveRedirectUrl`), `x-powered-by` removed, scrubbed 5xx errors, secrets read from env, `.env` ignored and not tracked or in history, `SECRET` required in production.

| ID | Finding | Priority |
| --- | --- | --- |
| S1 | `npm audit --omit=dev`: 8 vulnerabilities (5 moderate, 3 high). High: `multer` (DoS via pending `fileFilter`), `joi`, `body-parser`. Moderate: `ejs`, `ejs-mate`, `minimatch`, `jake`, `filelist`. `npm audit fix` is offered. I did not run it. | P1 |
| S2 | Third-party scripts and styles without Subresource Integrity: Bootstrap Icons, flatpickr (JS and CSS), Mapbox GL. Bootstrap and Font Awesome do have SRI. | P2 |
| S3 | No cookie/tracking disclosure needed today (no analytics found), but there is also no privacy policy or data-retention or deletion process. India's DPDP Act and, for EU visitors, GDPR would apply. | P0 (legal) |
| S4 | Guest usernames are shown to the host and to the public "Unavailable dates" list only as dates (guest names are host-only). Correct. | OK |
| S5 | `GET /listings/geocode` is login-only and rate-limited. Good. The public Mapbox token is rendered into pages; restrict it by URL in the Mapbox dashboard. | P2 |
| S6 | CORS: not configured, so default same-origin. Fine for a server-rendered app. | OK |
| S7 | No NoSQL-injection path found: Joi types every query/body field and `stripUnknown` is on for queries. `q` goes to `$text` as a string. | OK |
| S8 | No image moderation or content checks beyond MIME type (Multer trusts the declared `mimetype`; Cloudinary re-encodes, which mitigates but does not verify). | P2 |
| S9 | No automated abuse controls on listing creation or booking: any account can create unlimited listings and hold up to 30 nights per click with unlimited clicks. | P1 |

---

## 8. Booking and reservation assessment

| Capability | Status | Notes |
| --- | --- | --- |
| Date selection with unavailable nights disabled | Working | Playwright test passes |
| Server validation: past dates, 0 nights, > 30 nights | Working | Live 400s |
| Overlap prevention under concurrency | **Working, strong** | 10 parallel requests -> 1 success |
| Own-listing booking blocked | Working | Code + tests |
| Price | `nights x listing.price` only | `controllers/bookingController.js:48`. No fees, tax, deposit. `GST_RATE = null` in `utils/constants.js`. |
| Guest count | **Not collected** | Cannot enforce capacity |
| Payment | **None** | Booking is "confirmed" instantly |
| Host approval | **None** | |
| Confirmation | Flash message only; no page, reference number, or email | |
| Cancellation | Guest or host, any time before the check-in day. No policy, no refund, no reason, no notice to the other party. | Live: works, IDOR blocked |
| Status model | Only `confirmed` / `cancelled`. Past stays are labelled "completed / in progress" at render time. No pending, no-show, refunded. | |
| Timezone | All days are UTC midnights. A guest in India booking "today" late in the evening may be treated differently from the server date (the calendar uses the server's UTC "today", which reduces but does not remove surprises). | P2 |

---

## 9. Performance and accessibility assessment

**Performance (code inspection only; no Lighthouse or load test was run)**

- No N+1 patterns found on list pages (`populate` is batched). The show page runs two queries plus populate. Wishlist membership uses one small extra query.
- `Listing.countries()` is cached for 10 minutes. Text search needs the text index.
- Home page loads Bootstrap, Bootstrap Icons, Font Awesome (full), custom CSS (2,600+ lines, unminified) and ~970 lines of JS. No bundling or minification. Four icon/CSS CDN requests block rendering.
- Cards use `loading="lazy"`. Listing images are served from Cloudinary at full size; **no responsive `srcset`/width transforms** on cards (the edit page does request `w_250`).
- No compression, no `Cache-Control` for static files, no ETag tuning.
- Core Web Vitals: **not measured**.

**Accessibility (partly verified)**

- Positive: `lang="en"`, labelled auth fields with inline errors and `aria-invalid`, visible focus tokens, keyboard-operable star radios and dropdowns (tested), `role="alert"` flashes, `aria-live` on the booking summary.
- Gaps: no skip link, show/booking/trips/wishlist pages have no `<h1>`, generic page titles, `href="#"` placeholders, flash errors disappear after 3 s, `role="button"` date fields on the hero (`tabindex=0`) have not been tested with a screen reader, calendar popover is `aria-modal="false"` with no focus trap, brand SVGs hard-code colours (no theme adaptation), and contrast was only checked by design doc, not measured on the live pages.
- Screen-reader testing: **not performed**.

---

## 10. Public launch readiness checklist

| Area | Item | State |
| --- | --- | --- |
| Infra | Production start script and `NODE_ENV=production` handling | Present (`npm start`) |
| | Dockerfile / platform config / IaC | **Missing** |
| | Health-check endpoint | **Missing** |
| | HTTPS, domain, `APP_URL` | Business/ops decision; cookie `Secure` and HSTS rely on `NODE_ENV=production` |
| | CI/CD (tests on push, deploy) | **Missing** (no `.github`) |
| | Backups and restore drill for Atlas | **Unknown / undocumented** |
| | Migrations strategy | Ad hoc script only |
| | Error tracking, logs, uptime monitor | **Missing** |
| | SMTP provider with SPF/DKIM | **Missing** (unconfigured) |
| | Cloudinary account, Mapbox tokens, billing limits | **Not verified** |
| SEO | Unique titles, meta description, canonical, Open Graph, JSON-LD, sitemap, robots | **All missing** (live) |
| Legal | Privacy policy, Terms, cookie notice if analytics added, cancellation/refund policy, host and guest rules, tax statement, data deletion, support/dispute | **All missing** |
| Product | Payment, notifications, host controls, real ratings | **Missing / fake** |
| Quality | Automated tests | Strong (195 + 26) |

---

## 11. Missing features and opportunities

Prioritised by effect on trust and booking reliability. Complexity: L/M/H.

| Feature | User benefit | Complexity | Depends on | Priority |
| --- | --- | --- | --- | --- |
| Honest ratings ("New" state) | Removes deception | L | none | **P0** |
| Legal pages and support contact | Required to operate | L (code) + legal review | counsel | **P0** |
| Booking model decision + payments (Razorpay/Stripe) and refunds | Real money flow | H | legal/tax decision, webhooks, new `Payment` model | **P0/P1** |
| Booking confirmation and cancellation emails (guest + host) | Trust, fewer disputes | M | SMTP, templates, queue | P1 |
| Guest count + listing capacity, enforced | Correct bookings | M | schema change, form fields | P1 |
| Host calendar controls (block dates, min stay, price rules) | Hosts can actually manage | M-H | availability model | P1 |
| Real exchange rates, price stored in booking currency | Correct prices | M | rate API, `Booking.currency` | P1 |
| Account settings: change password/email, delete account, email verification | Safety, privacy rights | M | mailer | P1 |
| Multiple photos, amenities, bedrooms/baths | Listings match market norms | M | Cloudinary, schema | P2 |
| Sorting (price, rating) | Discovery | L | query + index | P2 |
| Reviews restricted to completed stays | Review integrity | L-M | booking link | P2 |
| SEO basics + sitemap + structured data | Organic discovery | L-M | none | P2 |
| Host verification, moderation, abuse limits | Safety | M-H | admin role | P2 |
| Saved searches, recommendations, recently viewed | Engagement | M | none | P3 |
| Dynamic pricing, analytics, in-app messaging | Competitiveness | H | data volume | P3 |

Avoid: a native app, social login, or recommendations before payment, notifications and honest data exist.

---

## 12. Detailed audit matrix

Verification key: **Live** = exercised against the running app; **Test** = covered by an executed Jest/Playwright test; **Code** = code inspection only.

### Authentication

| ID | Feature | Status | Evidence | Key files | Impact | Fix | Cx | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Signup | Partial | Live: works, but `12345678` accepted; no email verification | `controllers/userController.js:31`, `schema.js:48` | Weak accounts, fake emails | Enforce policy from PRD; add verification | L-M | P1 |
| A2 | Login by username/email | Full | Live + Test | `middleware.js` `resolveLoginIdentifier` | | | | |
| A3 | Logout (POST) | Full | Live (form present) + Test | `userRoute.js` | | | | |
| A4 | Forgot/reset password | Not verified | Live: silent no-op without SMTP; Test: success path | `userController.js:84`, `utils/mailer.js` | Users locked out in production if SMTP missing | Configure SMTP; add health/alert on send failure | L | P1 |
| A5 | Email verification | Missing | Code | | Fake accounts | Add token flow | M | P1 |
| A6 | Profile, settings, delete account | Missing | Live 404 | | Privacy rights | Add pages | M | P1 |
| A7 | Protected routes and sessions | Full | Live (302 to login, 403 w/o CSRF) | `middleware.js` | | | | |
| A8 | Rate limiting | Partial | Live: 429 after threshold; shared per-IP bucket | `middleware.js:188` | Shared-network lockout | Separate buckets, per-account throttle | L | P2 |

### Property management

| ID | Feature | Status | Evidence | Key files | Impact | Fix | Cx | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Create listing | Not verified | Live: form renders; urlencoded POST correctly 403. Image upload needs Cloudinary (unconfigured). Test: stubbed | `controllers/listings.js:123`, `views/listings/new.ejs` | Cannot confirm hosts can publish | Test with real Cloudinary in staging | L | P1 |
| P2 | Edit and delete listing | Not verified | Live: non-owner blocked. Test: success paths | `listings.js:214,279` | | Staging run | L | P1 |
| P3 | Multi-image, amenities, capacity | Missing | Code | `models/listing.js` | Uncompetitive listings, no capacity check | Extend schema | M | P1/P2 |
| P4 | Host availability and pricing rules | Missing | Code | | Hosts cannot block dates | Add calendar model | M-H | P1 |
| P5 | Categories and property types | Full | Live filters + Test | `utils/constants.js` | | | | |
| P6 | Publication and moderation | Missing | Code | | Listings go live instantly | Add status field and admin review | M | P2 |

### Discovery

| ID | Feature | Status | Evidence | Key files | Impact | Fix | Cx | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | Text search | Full | Live: `q=beach` -> 4 stays | `models/listing.js:114` | | | | |
| D2 | Category filter | Full | Live: Mountains -> 3 | | | | | |
| D3 | Price filter | Partial | Live: matches raw numbers across currencies | `listing.js:136` | Wrong results once non-INR listings exist | Filter within a currency or convert | M | P1 |
| D4 | Rating filter | Full | Live accepted; seed has no rated data so returns 0 | | | | | |
| D5 | Country filter | Full | Live; list from distinct countries (seed has no Indian listing) | | | | | |
| D6 | Date availability filter | Full | Test (`search.test.js`); live parameter accepted | `listing.js:154` | | | | |
| D7 | Guest selector | UI only | Live: no effect on results | `views/listings/index.ejs`, `script.js` | Misleading control | Add capacity then filter, or remove | M | P1 |
| D8 | Sorting | Missing | Live: `sort=` ignored | | | Add sort | L | P2 |
| D9 | Autocomplete/suggestions | Missing | Code | | | | M | P3 |
| D10 | Pagination | Full | Live + Playwright | | | | | |
| D11 | Map view | Not verified | Live 200; no Mapbox token. Playwright uses stubs | `public/js/map.js` | | Staging with token | L | P1 |
| D12 | Result count label | Partial | Live: "29+ stays" for 29 | `index.ejs` | Minor inaccuracy | Show exact total | L | P3 |
| D13 | Hero date picker | Not verified | New file added mid-audit, no tests | `public/js/datepicker.js` | | Add tests | L | P2 |

### Booking

| ID | Feature | Status | Evidence | Key files | Impact | Fix | Cx | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Create booking | Full (current scope) | Live + Test | `bookingController.js:27` | | | | |
| B2 | Overlap prevention | Full | Live: 10 concurrent -> 1 | `models/booking.js:29` | | | | |
| B3 | Price, taxes, fees | Partial | Code: nights x price only, no currency stored | `bookingController.js:48` | Incorrect/incomplete totals | Add currency, fees, tax rules | M | P1 |
| B4 | Cancellation | Partial | Live: works, IDOR refused. No policy/refund/notice | `bookingController.js:106` | Disputes | Policy + notifications | M | P1 |
| B5 | Booking history, host reservations | Full | Live + Test | `bookingController.js:66,84` | | | | |
| B6 | Confirmation and notification emails | Missing | Code | | Guests unsure booking exists | Email service | M | P1 |
| B7 | Payments, refunds | Missing | Code | | No revenue; unpaid "confirmed" stays | Provider integration | H | P0/P1 |
| B8 | Guest count validation | Missing | Live: no field | | Over-occupancy | Field + capacity | M | P1 |
| B9 | Booking summary under currency switch | Broken | Code: `booking.js:5-7` captures price once; `currency.js` change event unobserved | `public/js/booking.js`, `currency.js:106-112` | Price shown vs reserved mismatch | Single price source | L | P1 |

### Wishlist, host, currency, reviews, other

| ID | Feature | Status | Evidence | Key files | Impact | Fix | Cx | Pri |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | Wishlist | Full | Live: add, duplicate add, list, CSRF, anon refused | `wishlistController.js` | | | | |
| H1 | Host dashboard | Partial | Live/Test: reservation list and cancel only; no stats, guest contact, earnings | `views/bookings/hosting.ejs` | Thin host tooling | Extend | M | P2 |
| H2 | Host onboarding/verification | Missing | Code | | Trust | | M-H | P2 |
| C1 | Currency selector and conversion | Mocked | Code: hard-coded rates ("approximate baseline", `currency.js:9-18`), client-side, display only. PRD marks conversion out of scope. | `currency.js` | Misleading prices | Real rates or remove | M | P1 |
| C2 | Currency persistence | Partial | Test: persists via localStorage/cookie; server never reads the cookie | `currency.js` | Server pages unaware | | L | P3 |
| R1 | Reviews (create/delete, one per user) | Full | Live + Test; not tied to stays | `reviewController.js` | Fake-review risk | Tie to completed bookings | L-M | P2 |
| R2 | Card rating display | Mocked | Live: 4.8 / 24 invented | `listingCard.ejs:15-16` | Deceptive | Remove fallback | L | **P0** |
| O1 | Privacy and Terms | UI only | `href="#"`; Live `/privacy`, `/terms` 404 | `footer.ejs` | Legal | Author pages | L + legal | **P0** |
| O2 | Footer social links | UI only | Code | `footer.ejs` | | Link or remove | L | P3 |
| O3 | "Watch the story" | UI only | Code | `index.ejs` | | Remove or implement | L | P3 |
| O4 | Sidebar Experiences/Stays | Partial | Aliases of existing pages | `sidebar.ejs` | | Rename/remove | L | P3 |
| O5 | Dark mode | Partial | Tokens only; no switch | `tokens.css` | Unreachable feature | Add toggle or drop | L | P3 |
| O6 | Contact, support, help | Missing | Live 404 | | No dispute channel | | L | **P0** |
| O7 | In-app notifications | Missing | Code | | | | M | P3 |
| O8 | SEO metadata, sitemap, robots | Missing | Live: generic title, no meta/OG/canonical/JSON-LD, 404 robots/sitemap | `boilerplate.ejs` | Invisible to search | | L-M | P2 |
| O9 | Health, logging, monitoring | Missing | Live 404 `/health` | | Blind operations | | L-M | P1 |
| O10 | CI/CD and deploy config | Missing | No `.github`, Dockerfile | | Manual, unrepeatable releases | | M | P1 |
| O13 | Experiences and destination pages | Missing | Code | | Marketing copy promises them | Build or reword | M-H | P2 |
| O14 | Accessibility baseline | Partial | See section 9 | | | | M | P2 |

---

## 13. Prioritised issue list

### P0: unsafe or unfit to launch

1. **R2/F1** Fabricated 4.8 rating, 24 reviews and "Best seller" badges on every unreviewed listing.
2. **O1** No Privacy policy or Terms (dead links); no data deletion or retention process.
3. **O6** No support, dispute or refund contact.
4. **B7/B-model** Bookings are "confirmed" with no payment, host approval or notification. Decide the product model before real customers.
5. **S1** Known high-severity dependency advisories (can be fixed by `npm audit fix`; re-test after).

### P1: must fix before launch

A1 password policy; A4 SMTP and reset verification; A5 email verification; A6 account management; B3/BE1 booking currency and totals; B4 cancellation policy and notices; B6 transactional email; B8/D7/P3 guest count and capacity; B9 booking summary under currency switch; C1 honest currency; D3 price filter across currencies; P1/P2/D11 verify upload, edit and map with real services; P4 host availability; BE5 backups and migration plan; BE6 seed/wipe safety; BE8/O9 logging, monitoring, health check; O10 CI/CD; S9 abuse limits.

### P2: important improvements

A8 limiter design; BE3 overlapping guest stays; BE10 and performance (compression, caching, minification, image sizes); D8 sorting; D13 test the new date picker; H1/H2 host tools; P6 moderation; R1 verified-stay reviews; O8 SEO; O13 Experiences/Destinations; O14 accessibility; S2 SRI; S5 Mapbox token restriction; S8 image moderation; timezone clarity.

### P3: future

D9 autocomplete; D12 count label; C2; O2-O5, O7; saved searches, recommendations, dynamic pricing, analytics, messaging.

---

## 14. Recommended implementation roadmap

| Phase | Goal | Contents |
| --- | --- | --- |
| **0: honesty and safety (days)** | Stop misleading users; close known holes | Remove fake ratings/badges; `npm audit fix` and re-run suites; strengthen password rule; guard seed/auto-seed behind an explicit flag; fix `booking.js` currency desync; remove or label dead controls |
| **1: legal and trust (1-2 weeks, needs humans)** | Be allowed to operate | Privacy, Terms, cancellation/refund, host/guest rules, support page and inbox, data-deletion flow; decision on GST and booking model |
| **2: transactional core (2-4 weeks)** | A booking customers can rely on | Guest count and capacity; SMTP with SPF/DKIM; confirmation and cancellation emails; booking currency/fees; payment provider and webhooks if chosen; host date-blocking |
| **3: operations (1-2 weeks)** | Run it in production | Health check, structured logs, error tracking, uptime monitor, Dockerfile/platform config, CI running Jest and Playwright, Atlas backups and restore drill, staging environment with real Cloudinary and Mapbox |
| **4: discovery and quality** | Grow safely | SEO, sorting, multi-photo and amenities, performance work, accessibility pass, verified-stay reviews |
| **5: later** | Differentiate | Recommendations, saved searches, messaging, dynamic pricing |

---

## 15. Testing performed and results

| Test | Result |
| --- | --- |
| `npx jest` (18 suites) | **195 passed, 0 failed** (~70 s) |
| `npx playwright test` (26 tests, Chromium) | **26 passed, 0 failed** (~1.7 min) |
| Live probes against an isolated in-memory MongoDB (`mongodb-memory-server`, seeded with 29 demo listings, port 8099, own scratch server script outside the repo) | See below |
| `npm audit --omit=dev` | 8 vulnerabilities (3 high, 5 moderate) |

Live probes (all against the isolated instance, never the Atlas database; the project `.env` was not read or loaded):

- 26 routes requested anonymously: public pages 200, protected pages 302 to `/login`, missing pages 404 (list in section 3).
- Signup x2 accounts, duplicate-username message, weak password accepted.
- Filters: text, category, price, rating, country, dates, `guests`, `sort`, bad query (400), `page=99`.
- Booking: create, overlap rejected, past date 400, 40 nights 400, zero nights 400, **10 concurrent identical bookings -> 1 success**, cross-user cancel refused, same guest double-booked across two listings allowed.
- Wishlist: add, duplicate add, list, CSRF missing -> 403, anonymous -> 403.
- Reviews: script injection rendered inert.
- Password reset request with no SMTP: neutral message, nothing sent.
- 13 failed logins: 429 after the threshold.
- Non-owner access to listing edit refused.
- Security headers present (CSP, HSTS, X-Frame-Options, nosniff); no `x-powered-by`; no `cache-control`.

**Journeys.** Customer: browse -> search -> filter -> open -> save -> register -> reserve -> view -> cancel: **completed live via HTTP** (not by clicking in a browser except where Playwright covers pieces). Host: register -> create property with image -> publish: **could not be completed**, because Cloudinary is not configured. Creation validation and the Playwright address/pin flows passed, but a real upload was not performed.

---

## 16. Known limitations and unverified areas

- **Cloudinary uploads, Mapbox maps and geocoding, SMTP delivery, MongoDB Atlas, and any real deployment** were not available and were not tested.
- **Password-reset success path** and **map rendering** were verified only by executed test suites that stub these services.
- **Browser-level behaviour** was verified only through the existing Playwright suite. I did not manually click through mobile layouts, the hero date picker, or the currency switch on the booking panel (F7 is from code reading).
- **Performance** (Core Web Vitals, load testing, query plans at scale) was not measured.
- **Screen readers and real-device testing** were not done.
- **Legal conclusions** (DPDP/GDPR duties, tax, consumer-protection exposure of fake ratings) are flagged for human and legal review, not decided here.
- The working tree was **modified by someone else during the audit** (see the note at the top). Findings D7/D13/F2/F12 may have changed.
- The seed data are all INR and none are in India, so multi-currency search behaviour (BE2) is inferred from the code and the arithmetic of the query.
- A single Node process was tested; multi-instance behaviour (country cache, rate-limit counters, in-memory store in tests) was not.

---

## 17. Overall launch-readiness assessment

**Not ready for public launch. Ready for a closed beta with real but friendly users, once Phase 0 is done.**

- **Engineering quality is a genuine strength.** Concurrency-safe bookings, CSRF, CSP, hashed reset tokens, a large passing test suite and clear code. The foundation does not need rewriting.
- **Product completeness is the gap.** The reservation is a calendar lock, not yet a transaction: no money, no guest count, no notifications, no host controls.
- **Trust and legal are the real blockers.** Invented ratings, dead Privacy/Terms links and no support channel would be unacceptable the day a stranger gives you their email or money.
- **Estimated effort to a defensible public launch:** roughly 6-10 weeks for one full-time developer, dominated by the payment/booking-model decision, email, host availability and operations setup. Legal review runs in parallel and is outside engineering's control.
