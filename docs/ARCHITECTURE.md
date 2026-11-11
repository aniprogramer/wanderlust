# Wanderlust: Architecture

| | |
| --- | --- |
| **Document status** | Draft v1.0 |
| **Depends on** | `PRD.md` (what to build), `DESIGN.md` (how it looks and behaves), `docs/design/color-system.md` (colour tokens) |
| **Audience** | Coding agents and developers |
| **Precedence** | PRD decides scope. DESIGN decides interface. This document decides how the system is built. If they conflict, stop and ask. |

## How agents must use this document

1. Follow the structure and boundaries here. Do not add a framework, service, queue, cache, build tool or package that is not listed. Propose it in writing first.
2. Every new route, model field, environment variable or external call must be added to the relevant table in this document in the same change.
3. Keep the layering in section 5. Never skip a layer, for example by querying the database from a view or a route file.
4. **MVP** items are required now. **Later** items are noted only so today's choices do not block them. Do not build "Later" items.
5. Leave changes uncommitted in the working tree for the owner to review.

---

## 1. Architecture summary

Wanderlust is a **single server-rendered web application** (a modular monolith). One Node.js process serves HTML pages, a few small JSON endpoints and static files. One MongoDB database holds all data. Photos and maps come from two managed services.

How a request flows:

1. Browser requests a page or posts a form.
2. The server applies security middleware (headers, session, CSRF, rate limits).
3. The route validates input, checks who the user is and what they may do.
4. A controller runs the use case and reads or writes the database through models.
5. The server renders an EJS page (or returns JSON for the two endpoints that need it) and the browser enhances it with small script files.

There is no separate frontend application, no public API, no message queue, no cache server and no background worker in the MVP. Each of those is a cost with no requirement in the PRD that needs it.

---

## 2. Technology stack and reasoning

### 2.1 Runtime and web layer

| Choice | Role | Why |
| --- | --- | --- |
| **Node.js 20.19 or newer** | Runtime | Already in use. Mongoose 9 and the MongoDB driver 7 require it. Long-term supported. |
| **Express** | HTTP framework | Already in use. Small, stable, and the whole team knows it. Fits a monolith with server-rendered pages. |
| **EJS with ejs-mate** | Templates and layouts | Already in use. Server rendering gives fast first paint, simple SEO and a strict content security policy without a build step. |
| **Vanilla JavaScript (classic scripts)** | Browser behaviour | The interface needs a calendar, a map, a menu and confirmations only. A framework would add a build step and weaken the security policy for no gain. |
| **CSS with a token stylesheet** | Styling | Tokens (`public/css/tokens.css`) carry the colour system and theme switch. Component styles live in `public/css/style.css`. No preprocessor in the MVP. |
| **Bootstrap (grid only)** | Layout utilities | Already loaded. Used for grid and breakpoints, not for component looks (DESIGN section 4.3). Remove it later if it is no longer needed. |

### 2.2 Data and identity

| Choice | Role | Why |
| --- | --- | --- |
| **MongoDB (Atlas)** | Database | Already in use. Listings, reviews and bookings are document-shaped. Text search and geospatial queries are built in, so no search engine is needed. |
| **Mongoose** | Data access | Already in use. Schemas, validation, indexes and hooks in one place. |
| **Passport (local strategy) with passport-local-mongoose** | Authentication | Already in use. Handles salted password hashing and login. No third-party identity provider is needed for the MVP. |
| **express-session with connect-mongo** | Sessions | Server-side sessions stored in the database already in use, so no Redis is required. Cookies carry only a session ID. |
| **Joi** | Input validation | Already in use. One schema per input shape, applied before controllers run. |

### 2.3 Security middleware

| Choice | Role |
| --- | --- |
| **helmet** | Security headers and the content security policy |
| **csrf-sync** | CSRF protection with a session-bound token (works with method-override forms) |
| **express-rate-limit** | Per-IP limits on login, signup, geocoding and a global backstop |
| **multer** | Multipart parsing with size and type limits, writing temporary files that are always deleted |
| **method-override** | Allows PUT and DELETE from plain HTML forms |
| **connect-flash** | One-time messages shown after a redirect |

### 2.4 External services

| Service | Role | Why |
| --- | --- | --- |
| **Cloudinary** | Photo storage and delivery | Handles image storage, resizing and CDN so the server stores no files. |
| **Mapbox** | Browser maps and clustering; server-side address lookup | Already in use. Two tokens: a public one for browsers, a secret one for the server. |
| **Render** | Hosting | Already in use. Single web service. Needs `trust proxy` because TLS ends at its proxy. |

### 2.5 Testing and tooling

| Choice | Role |
| --- | --- |
| **Jest with supertest** | Unit and integration tests against the Express app |
| **mongodb-memory-server** | Real database behaviour in tests with no external dependency |
| **cheerio** | Assertions on rendered HTML |
| **Playwright** | A small browser suite for pages that need a real browser (maps, calendar, keyboard, content security policy) |
| **Prettier** | Formatting of JavaScript, CSS and JSON |

### 2.6 Deliberately not chosen

| Not chosen | Reason |
| --- | --- |
| React, Vue or a single-page app | Doubles the surface (API plus client), needs a build step and complicates the content security policy. Pages are mostly reading and forms. |
| Next.js or another full-stack framework | A rewrite with no requirement driving it. |
| Microservices, queues, workers | One process handles the load. No requirement needs background work. |
| Redis | Sessions live in MongoDB. Add it only when rate limits or sessions must be shared across several instances (section 14). |
| GraphQL or a public REST API | No client other than the website. |
| TypeScript | Reasonable later, but it adds a build step. Not needed to meet the PRD. Revisit with a bundler (section 14). |
| A search service (Elasticsearch and similar) | Mongo text search covers the PRD. |
| Payment provider, email service | Out of scope in the PRD (decisions D5 and out-of-scope list). |
| Third-party analytics | Not in the PRD. Would also need CSP changes. |

---

## 3. AI architecture

**None.** No requirement in `PRD.md` calls for an AI feature. No model, API key, vector store or prompt is part of this architecture. If an AI feature is approved later (for example listing description drafting), it becomes a new section here and a new decision in the PRD first. It would be a server-side call from a controller to one provider, behind the same authentication and rate limits, with the result shown for the user to edit before saving.

---

## 4. Frontend architecture

### 4.1 Approach

Server-rendered pages enhanced progressively. Every page works without JavaScript for browsing, searching, logging in and posting forms. JavaScript adds the map, the calendar, the menu and the confirmation prompts.

### 4.2 Structure

| Part | Location | Rule |
| --- | --- | --- |
| Layout | `views/layouts/` | One layout holds head, header, container, footer and script tags. The home page and other pages use the same layout (PRD FR-18). |
| Components | `views/includes/` | Each DESIGN component (stay card, field, alert, pagination, booking row, header, footer, empty state) is one partial taking explicit inputs. No page-specific copies of a component. |
| Pages | `views/<area>/` | Pages compose partials only. No logic beyond looping and choosing a partial. |
| Styles | `public/css/` | `tokens.css` holds tokens for Stone and Night. `style.css` holds component styles. No hex values outside `tokens.css`. |
| Scripts | `public/js/` | One small file per behaviour (map, booking calendar, flash, confirm, menu). Each file runs only if its elements exist on the page. |
| Fonts | `public/fonts/` | Self-hosted display, sans and mono fonts (PRD D7). |
| Icons | One library | Remove the second icon library (DESIGN section 5). |

### 4.3 Rules

- **No inline scripts, event attributes or style attributes.** The content security policy forbids them. Data for scripts passes through `data-` attributes or a non-executable JSON block.
- **No front-end build step in the MVP.** Scripts are loaded as plain files. Third-party browser libraries (Mapbox GL, Flatpickr) load from pinned CDN versions with integrity hashes, or are vendored under `public/` (preferred, see section 14).
- **Theme.** Stone is default. Night is applied by a theme attribute on the root element. Initial theme follows the visitor's system setting by stylesheet alone. A manual toggle is not part of the MVP (Decision AD2).
- **State lives on the server.** The only client state is form input, the calendar selection and the map view.
- **Accessibility and responsive behaviour** follow DESIGN sections 12 and 13. Components are built once and used everywhere.

---

## 5. Backend architecture

### 5.1 Layers

Each request passes through these layers in order. A layer calls only the one below it.

| Layer | Folder | Responsibility | Must not |
| --- | --- | --- | --- |
| Entry | `app.js` | Create the app, register middleware in the fixed order, mount routes, register error handlers, connect to the database, then listen. | Hold business logic. |
| Routes | `routes/` | Map method and path to middleware and a controller. One file per area. | Query data or render directly. |
| Middleware | `middleware.js` | Authentication check, ownership check, validation, CSRF check, upload cleanup. | Contain use-case logic. |
| Controllers | `controllers/` | One function per use case. Read input, call models and utilities, choose the response (render, redirect, JSON). | Contain raw query strings built from input, or HTML. |
| Models | `models/` | Schemas, indexes, validation rules, derived fields, search and rating statics, and the shared cascade routine. | Know about requests or responses. |
| Utilities | `utils/` | Pure helpers: date handling, formatting, geocoding call, constants, error classes, async wrapper. | Hold state (apart from the documented country cache). |
| Schemas | `schema.js` | Joi schemas for every input shape. | Touch the database. |

If a controller grows past one clear use case, split the shared part into a function in `utils/` or a model static. Do not create a generic "service" layer until two controllers need the same multi-model operation.

### 5.2 Middleware order (fixed)

1. Environment and configuration check (fail fast in production, before anything listens).
2. Request context (request id), then `/health`, then the request log. Health sits above the log and sessions so load balancer checks stay cheap and quiet.
3. Compression.
4. Security headers and content security policy.
5. Body parsing (forms), method override, static files (long cache for versioned assets).
6. Global rate limit (skips static assets).
7. Session (server-side, created only when needed), flash, authentication initialisation, session freshness.
8. Template locals: current user, flash messages, CSRF token provider, shared constants, canonical URL.
9. CSRF guard (state-changing requests).
10. Routes.
11. Not found handler.
12. Error handler (reports 5xx to the logs and Sentry).

Changing this order requires a written reason in this document.

### 5.3 Modules (domain areas)

| Area | Routes | Controller | Model |
| --- | --- | --- | --- |
| Listings and search | `listingRoute` | `listings` | `listing` |
| Bookings | `bookingRoute` and one route under listings | `bookingController` | `booking` |
| Reviews | `reviewRoute` (mounted under a listing) | `reviewController` | `review` |
| Saved stays | `wishlistRoute` | `wishlistController` | `user` (saved list) |
| Accounts | `userRoute` | `userController` | `user` |

---

## 6. Data flow

### 6.1 Browse and search (read)

Browser → route validates the query → controller builds filters → listing model runs a paginated query (text index, filters, optional availability and radius) → controller adds saved-state for the signed-in user (one small query) → page renders with pagination links that keep filters.

### 6.2 Reserve a stay (write, concurrency-sensitive)

Browser posts dates → CSRF and login checks → Joi checks the range (not in the past, check-out after check-in, at most 30 nights) → controller loads the listing, rejects own listing (PRD A2), builds one entry per night and the total → booking is inserted → the unique partial index rejects any overlap even under simultaneous requests → success redirects to Trips, an overlap shows a friendly message and the calendar refreshes.

The database index is the source of truth for double booking. The earlier availability check is only for friendly messages.

### 6.3 Create or edit a listing (write with an external service)

Browser posts a multipart form → multer writes a temporary file under size and type limits → content check of the file's first bytes → CSRF check → Joi validates the text fields against the publish or draft rules, chosen by the button pressed; on failure the form is drawn again with status 400, inline errors and the typed values → controller resolves the pin (use the submitted pin, or call the geocoder if the address changed; a failed lookup means no pin, never a lost form) → if publishing with no pin and no `noPinAck`, a draft stays a draft with a "No pin yet" warning → uploads the photos to Cloudinary → model saves and picks the public circle → the temporary file is deleted in every case (success or failure) → if the save fails after an upload, the new photo is destroyed → redirect to the stay.

### 6.4 Review and rating

Controller checks not-owner and no-existing-review → saves the review → adds it to the listing → recomputes the listing's stored average and count → if any step after the first fails, the review is removed. Delete reverses the same steps after checking the review belongs to the listing in the URL.

### 6.5 Cancel and delete

Cancel marks the booking as cancelled, which frees its nights. Deleting a listing is refused while upcoming confirmed bookings exist. Otherwise it removes reviews and bookings and unsaves the listing everywhere, through one shared cascade routine that the seed script also uses.

### 6.6 Map

The map page renders a JSON block of pins (capped at 500) into the page. The browser script reads it and draws clusters. No separate data endpoint is needed.

---

## 7. Folder structure

The existing layout stays. Changes are marked.

| Path | Purpose |
| --- | --- |
| `app.js` | Entry point: middleware order, mounting, startup |
| `middleware.js` | Auth, ownership, validation, CSRF, upload checks |
| `schema.js` | Joi schemas |
| `cloudConfig.js` | Cloudinary and multer storage setup |
| `routes/` | One route file per area |
| `controllers/` | One controller per area |
| `models/` | `listing`, `booking`, `review`, `user`, `cascade`, `supportMessage`, `report` |
| `utils/` | `constants`, `dates`, `format`, `geocode`, `queryString`, `categories`, `ExpressError`, `wrapAsync`, `config`, `logger`, `reportError`, `requestLog`, `healthCheck`, `mailer`, `emails`, `emailTheme`, `notify`, `availability`, `expireRequests`, `imageType`, `cloudinaryUrl`, `tokens`, `seo`, `assets`, `siteInfo`, `listingBadge` |
| `migrations/` | Numbered data migrations and their runner |
| `scripts/` | Command-line tools: `migrate.js`, `make-admin.js` |
| `views/emails/` | The one email layout, HTML and text |
| `views/legal/` | Draft legal pages, controlled by `LEGAL_REVIEWED` |
| `views/pages/` | Help and contact |
| `views/account/` | Account settings and the deleted confirmation |
| `views/admin/` | The admin dashboard |
| `public/vendor/` | Self-hosted third-party libraries: Bootstrap, Font Awesome, flatpickr, Mapbox GL |
| `views/layouts/` | The single layout |
| `views/includes/` | Components (partials). **Change:** add header (replaces navbar and sidebar), stay card variants, field, empty state, alert; remove the sidebar. |
| `views/<area>/` | Pages: listings, bookings, users, wishlist, error |
| `public/css/` | **Change:** add `tokens.css` before `style.css` |
| `public/js/` | One file per behaviour. **Change:** add `menu.js` for the phone menu and account menu. |
| `public/fonts/` | **Change:** replace with the new families (Instrument Serif, Geist, Geist Mono) |
| `public/assets/` | Logo, favicon |
| `init/` | Seed data, seed script, seed guard |
| `tests/unit/`, `tests/integration/`, `tests/e2e/` | Jest unit, Jest integration, Playwright |
| `docs/` | `PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`, `RUNBOOK.md`, `STAGING_CHECKLIST.md`, `design/color-system.md`, audit and implementation report |
| `Dockerfile`, `.dockerignore`, `render.yaml`, `.github/workflows/ci.yml` | Deployment and CI |
| `.env.example` | Documents every environment variable |
| `CLAUDE.md` | **Change:** agent rules pointing to the docs above |

New folders require a note here.

---

## 8. Database interaction

### 8.1 Collections

User, Listing, Review, Booking, SupportMessage, Report, `migrations` (written by the runner) and the session collection managed by the session store. Fields are defined in `PRD.md` section 8.

Fields added for launch:

| Model | Fields |
| --- | --- |
| User | `startingMode` (guest or host: the mode a login starts in, chosen at sign-up), `termsAcceptedAt`, `termsVersion`, `emailVerifiedAt`, `verifyTokenHash`, `verifyTokenExpires`, `isAdmin` (set only by `scripts/make-admin.js`), `displayName` (2 to 50), `bio` (up to 300), `city`, `country` (up to 80 each), `languages[]` (from `LANGUAGES` in `utils/constants.js`), `avatar` (`url`, `filename`, same shape as a listing photo), `pendingEmail` (waits for its link; the old address stays active), `profileHidden` (set by hand; a hidden profile is a 404) |
| Listing | `maxGuests`, `bedrooms`, `beds`, `bathrooms`, `capacityDefaulted`, `cleaningFee`, `minNights`, `maxNights`, `blockedRanges[]`, `images[]` (`caption` is the alt text, up to 150), `amenities[]`, `status` (published, hidden, draft). **Address and map:** `addressLine`, `city`, `region` (private until a stay is confirmed, except the city), `location` (public place name, mirrors `city`), `approxGeometry` (public point; the centre of a 500 m circle that contains the pin), `noPinAck`. **Space and terms:** `sizeSqm`, `wifiMbps` (host-reported), `checkInFrom`, `checkInUntil`, `checkOutBy`, `quietHoursStart`, `quietHoursEnd`, `cancellationPolicy` (flexible, moderate, strict), `otherRules` (up to 300). **Booleans, unset meaning the host has not said:** `smokingAllowed`, `petsAllowed`, `partiesAllowed`, `childrenWelcome`, `stepFreeAccess`, `wheelchairEntrance`, `wideDoorways`, `accessibleBathroom`, `liftInBuilding`, `smokeAlarm`, `carbonMonoxideAlarm`, `firstAidKit`, `fireExtinguisher`. **Derived:** `hasWorkspace` (from the workspace or dedicated desk amenity); `petsAllowed` keeps the `pets_allowed` amenity in step. `detailsIncomplete` flags a migrated listing until its host saves the form. A draft may leave any required field empty. |
| Booking | `cancellationPolicy` and `freeCancelUntil` (copied or worked out when requested, so later listing changes do not affect them), `cancelledLate`, `guests`, `currency`, `nightlyPrice`, `cleaningFee`, `subtotal`, `taxAmount`, `status` (pending, confirmed, declined, expired, cancelled), `requestedAt`, `respondedAt`, `expiresAt`, `cancelledBy`, `cancelReason`, `declineReason`, `guestMessage`, `guestDeleted` |
| Review | `verifiedStay`, `booking` |
| SupportMessage | `reference`, `user`, `name`, `email`, `topic`, `bookingReference`, `message`, `resolvedAt` |
| Report | `reference`, `listing`, `reporter`, `reason`, `details`, `resolvedAt` |

### 8.2 Access rules

- All access goes through Mongoose models. No raw driver calls except in the seed and migrate scripts.
- Input is validated by Joi before any query is built. Query objects are built from validated fields only, never from raw request bodies, which prevents operator injection.
- Every list query is paginated (12 per page) or capped (500 map pins). No unbounded queries.
- Select only the fields a view needs. Populate only what is displayed (owner name, review author name).
- Derived values (average rating, review count) are stored on the listing and recomputed on every review change. They exist for filtering and sorting speed.
- Country list for filters is cached in memory for 10 minutes and cleared on listing changes. This cache is per process.

### 8.3 Indexes (required)

| Collection | Index | Purpose |
| --- | --- | --- |
| Listing | Text on title, location, country, description (weighted) | Search |
| Listing | Category with price; country with price; rating descending | Filters |
| Listing | Geospatial on pin | Near search and map |
| Booking | Unique on listing and night, only for confirmed bookings | Prevents double booking |
| Booking | Guest with check-in; listing with check-in; status with check-in | Trips, Hosting, availability |
| User | Unique username and unique lowercase email | Accounts |
| Booking | Pending by expiry and guest with status | Lazy expiry, one guest's overlapping stays |
| Report | Unique reference; created descending | Admin list |
| SupportMessage | Unique reference | Reference lookup |

### 8.4 Consistency

MongoDB writes to a single document are atomic. Operations spanning documents (review creation, listing delete cascade, photo replace) use compensating cleanup: a step is undone if a later step fails. This is sufficient for the MVP. Multi-document transactions are a Later option (section 14) if cleanup logic becomes hard to reason about.

### 8.5 Migrations

Migration `007-user-starting-mode.js` sets `startingMode` to `guest` where it is missing. Migration `008-listing-details.js` gives listings with no `cancellationPolicy` the flexible policy, `city` from `location`, `maxNights` 30, check-in 15:00 to 20:00, check-out 11:00, `hasWorkspace`, `detailsIncomplete: true` and a public circle when they have a pin; `petsAllowed` is set only where the amenity existed, and other rule, accessibility and safety fields stay unset so that nothing is claimed for the host. Both are safe to run twice.

Migration `006-user-profile.js` sets `displayName` from `username` for existing users who have none and leaves the other profile fields empty; running it twice changes nothing.

Schema changes that affect existing data ship as a new numbered file in `migrations/`, applied by `npm run migrate` and recorded in the `migrations` collection. Each script is also safe to run twice. Take a database backup before running one in production. See `RUNBOOK.md`.

---

## 9. Authentication and authorization

### 9.1 Authentication

- Username and password. Passwords are salted and hashed by passport-local-mongoose; plain passwords are never stored or logged.
- Password policy: 8 to 128 characters with a letter and a digit.
- Sessions are server-side. The browser holds only an opaque ID in a cookie: HttpOnly, SameSite Lax, Secure in production, seven-day life. A session is created only when needed (login or a flash message).
- Login failures return one generic message. Login and signup are rate limited per IP.
- After login the user returns to the page they came from.
- Logout is a POST with a CSRF token.
- **Mode.** One account acts as a guest or a host. The active mode is `session.mode` (`guest` or `host`); it is never stored on the user. The user stores only `startingMode`, chosen at sign-up and changed by `POST /account/starting-mode`. Login sets `session.mode` from `startingMode` unless the user already switched in this session (`session.modeSwitched`), `POST /mode` changes the session only, and logout or a password reset clears both. Anything missing or invalid reads as `guest` (`utils/mode.js`, `normalizeMode`). `res.locals.mode` and `res.locals.navLinks` drive the header links.
- Not in the MVP: social login, two-factor (see section 14).

### 9.2 Authorization

Authorization is enforced on the server in middleware, never only by hiding buttons. The rules are the PRD section 6 matrix:

| Check | Where | Used by |
| --- | --- | --- |
| Is logged in | Login guard | Reserve, save, create listing, trips, hosting, reviews, geocoding |
| Is listing owner | Owner guard | Edit and delete listing |
| Is review author and review belongs to the listing | Review guard | Delete review |
| Is booking party (guest or listing owner) | Booking guard | Cancel booking |
| Active mode is host / guest | `requireMode("host")`, `requireMode("guest")` | Host pages and listing or reservation actions / trips, saved, requests and reviews. Wrong mode: warning message and redirect, never a broken page |
| Active mode matches the booking role | `requireModeForRole` | Withdraw or cancel a booking |
| Is not the listing's owner | Controller rule | Review a listing, reserve a listing (PRD A2) |

Rules for new routes: default to requiring login. Make a route public only when the PRD says so. Ownership is always checked against the stored record, never against a value sent by the browser.

### 9.3 CSRF

Every state-changing request carries a session-bound token in the form body or a header, never in the query string. Method-override requests are checked like any POST. The token is only generated for pages that need it, so anonymous browsing does not create sessions.

---

## 10. API architecture

### 10.1 Style

The application is a set of server-rendered routes that return HTML and redirects. Forms are plain HTML forms. PUT and DELETE come through method override on POST. Mutations redirect (post, redirect, get) with a flash message. There is no public API and no versioning in the MVP.

### 10.2 Route table

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/listings` | Public | Home, search and filters, pagination |
| POST | `/listings` | Login, host mode | Create listing (multipart) |
| GET | `/listings/new` | Login, host mode | Listing form |
| GET | `/listings/mine` | Login, host mode | Your listings, with the "You have no listings yet" empty state |
| GET | `/listings/map` | Public | Map view |
| GET | `/listings/geocode` | Login | **JSON.** Address to coordinates, rate limited |
| GET | `/listings/:id` | Public | Stay page |
| PUT | `/listings/:id` | Owner, host mode | Update listing (multipart) |
| DELETE | `/listings/:id` | Owner, host mode | Delete listing |
| GET | `/listings/:id/edit` | Owner, host mode | Edit form |
| POST | `/listings/:id/blocks` | Owner, host mode | Block nights |
| DELETE | `/listings/:id/blocks/:blockId` | Owner, host mode | Reopen blocked nights |
| GET, POST | `/listings/:id/report` | Login | Report a listing |
| POST | `/listings/:id/bookings` | Verified login, guest mode | Send a booking request |
| POST | `/listings/:id/reviews` | Login, guest mode | Add review |
| DELETE | `/listings/:id/reviews/:reviewId` | Review author | Delete review |
| GET | `/bookings` | Login, guest mode | Trips |
| GET | `/bookings/hosting` | Login, host mode | Reservations (the hosting dashboard) |
| GET | `/bookings/:bookingId` | Booking party | Booking page (either mode) |
| DELETE | `/bookings/:bookingId` | Booking party, mode matches role | Withdraw (guest mode) or cancel (host mode) |
| POST | `/bookings/:bookingId/accept` | Host, host mode | Accept a request |
| POST | `/bookings/:bookingId/decline` | Host, host mode | Decline a request |
| GET | `/wishlist` | Login, guest mode | Saved |
| POST | `/wishlist/:id` | Login, guest mode | Save |
| DELETE | `/wishlist/:id` | Login, guest mode | Unsave |
| POST | `/mode` | Login | Switch between guest and host mode (`mode`, optional `returnTo`) |
| GET, POST | `/signup` | Public | Create account |
| GET, POST | `/login` | Public | Log in |
| POST | `/logout` | Login | Log out |
| GET, POST | `/forgot-password`, `/reset-password/:token` | Public | Password reset |
| GET | `/verify-email` | Login | Prompt to verify |
| POST | `/verify-email/resend` | Login | Send the link again |
| GET | `/verify-email/:token` | Public | Confirm an email address |
| GET | `/users/:username` | Public | The one profile page. Everyone: the allowlist only (`utils/profile.js`); 404 if unknown or hidden. The owner also gets the settings sections below it |
| GET | `/account` | Login | Redirects to your own profile (kept for old links) |
| GET | `/account/export` | Login | Data download |
| POST | `/account/profile` | Login | Settings action on the profile page. **Multipart.** Username, display name, bio, city, country, languages, photo. Upload rules and cleanup as for listing photos |
| POST | `/account/starting-mode` | Login | Saves `startingMode`, the default mode for the next login. Does not change the current session |
| POST | `/account/email` | Login | Ask to change email: needs the current password; sends a link to the new address |
| POST | `/account/password`, `/account/delete` | Login | Change password; delete account |
| GET | `/account/deleted` | Public | Confirmation |
| GET | `/help`, `/contact/sent` | Public | Help, message sent |
| GET, POST | `/contact` | Public | Support form |
| GET | `/privacy`, `/terms`, `/cancellation-policy`, `/house-rules` and the other pages in `views/legal/` | Public | Draft legal pages |
| GET | `/robots.txt`, `/sitemap.xml` | Public | Search engines |
| GET | `/health` | Public | **JSON.** Up or down only |
| GET | `/admin` | Admin | Dashboard |
| POST | `/admin/listings/:id/hide`, `/admin/listings/:id/unhide` | Admin | Moderate a listing |
| POST | `/admin/support/:id/resolve`, `/admin/reports/:id/resolve` | Admin | Close an item |

### 10.3 Conventions

- Route files list middleware in a fixed order: rate limit, login or ownership guard, upload (if any), CSRF, validation, controller.
- Validation failures on forms redirect back with a message and keep entered values. Validation failures on JSON return a short JSON error with a matching status.
- Identifiers in URLs are validated as database IDs; an invalid one is a 404.
- Responses never include internal error details.

### 10.4 Later

If a mobile app or third-party client is approved, add a versioned JSON API under a separate path, reusing the same models, validation and authorization. Do not retrofit the HTML routes.

---

## 11. External services

| Service | Used from | Credentials | Failure behaviour |
| --- | --- | --- | --- |
| **MongoDB Atlas** | Server | Connection string in environment | The server does not start without it. Runtime failures show the error page. |
| **Cloudinary** | Server (upload, destroy) | Cloud name, key, secret in environment | Upload failure shows an error, saves nothing, deletes the temp file. Destroy failure is logged and does not block the user's action. |
| **Mapbox, public token** | Browser | Public token, URL-restricted, rendered into pages | Map area shows a message and a list link. The rest of the page works. |
| **Mapbox, secret token** | Server (geocoding only) | Separate secret token | 5-second timeout. On failure the listing is saved without a pin and the user is told. Never sent to the browser. |
| **SMTP provider** | Server | `SMTP_*`, `MAIL_FROM` | Required in production. A failed send is logged and never fails the booking or account action behind it. |
| **Sentry** | Server | `SENTRY_DSN` (optional) | Without it, errors go to the logs only. Passwords, tokens and emails are removed first. |

Each external call has a timeout, one clear failure path and a test that mocks it. Tests never call real services.

---

## 12. Environment configuration

### 12.1 Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development`, `test` or `production`. Production turns on secure cookies and proxy trust. |
| `PORT` | No (default 8080) | Port to listen on |
| `ATLAS` | Yes | MongoDB connection string |
| `SECRET` | Yes in production | Signs session cookies. Startup fails in production if missing. |
| `APP_URL` | Yes in production | Public site URL for email links, canonical URLs and the sitemap |
| `APP_TIMEZONE` | No (default `Asia/Kolkata`) | Defines "today". Stays are calendar dates. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Yes in production | Sending email |
| `SMTP_PORT`, `SMTP_SECURE` | No (587, false) | SMTP connection |
| `SUPPORT_EMAIL` | Yes in production | Receives contact messages and reports; shown to users |
| `LEGAL_ENTITY_NAME`, `LEGAL_ADDRESS`, `GRIEVANCE_OFFICER`, `GOVERNING_LAW` | Before launch | Facts on the legal pages. Placeholders show until they are set. |
| `LEGAL_REVIEWED` | No (false) | `true` removes the draft notice. Only after legal review. |
| `SOCIAL_FACEBOOK_URL`, `SOCIAL_INSTAGRAM_URL`, `SOCIAL_LINKEDIN_URL` | No | Footer icons appear only when set |
| `ALLOW_DESTRUCTIVE_SEED` | No | Must be `true` before the seed script can wipe a database |
| `PROTECTED_DB_MARKERS` | No | Comma-separated. A database URL containing one can never be wiped. |
| `SENTRY_DSN` | No | Error tracking |
| `LOG_IN_TEST` | Tests only | Lets the logger write during tests |
| `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET` | Yes | Cloudinary |
| `MAPBOX_TOKEN` | No | Public browser token. Without it, maps are hidden and addresses are not looked up. |
| `MAPBOX_SERVER_TOKEN` | No | Secret server token for address lookup. Falls back to the public token if unset (not recommended). |
| `ENABLE_RATE_LIMIT` | Tests only | Turns rate limiting on during tests |

### 12.2 Rules

- All configuration comes from environment variables. Nothing secret is committed.
- `.env.example` lists every variable with placeholder values only. `.env` and the temporary upload folder are git-ignored.
- A `.env` file is read only outside production and test. In production the host provides the variables.
- Constants that are not secret (categories, property types, currencies, page size, stay limits, map cap) live in `utils/constants.js`, not the environment.
- The tax rate constant stays null (LD3). The price breakdown says taxes are not included.
- Three environments: local development (local or Atlas database, test tokens), automated test (in-memory database, mocked services), production (Render, Atlas, real services). Production and development never share a database.

---

## 13. Error handling

### 13.1 Principles

- Expected errors (validation, not found, forbidden, conflict) are raised as a typed error with a status and a user-safe message.
- Unexpected errors are logged with context on the server and shown to the user as a generic message.
- Every asynchronous controller is wrapped so a rejection reaches the error handler.
- Users never see stack traces, database messages or file paths.

### 13.2 Mapping

| Condition | Status | User sees |
| --- | --- | --- |
| Validation failure on a form | Redirect back (or 400) | Field message or alert, values kept (DESIGN 8) |
| Invalid identifier, unknown record or route | 404 | Not found page |
| Not logged in | Redirect to login | Message, returns after login |
| Not allowed (not owner, not party) | Redirect with message or 403 | "You do not have permission" |
| Missing or wrong CSRF token | 403 | "Refresh the page and try again" |
| Booking overlap or listing has upcoming bookings | 409 or redirect with message | Specific, friendly message |
| Upload too large or wrong type | 400 | "Image must be a JPEG, PNG or WebP under 5 MB." |
| Rate limited | 429 | "Too many attempts. Please wait a few minutes." |
| Database validation error | 400 | Field-level messages |
| Anything else | 500 | Generic error page |

### 13.3 Cleanup on failure

Temporary upload files are always deleted. An uploaded photo whose database save failed is destroyed. A review whose rating update failed is removed. These rules are tested.

### 13.4 Logging

Log to standard output (the host collects it). Log errors with route, user ID (not email) and a short code. Never log passwords, tokens, session IDs or full request bodies. A hosted error tracker is a Later option.

---

## 14. Security boundaries

### 14.1 Trust zones

| Zone | Trust | Controls |
| --- | --- | --- |
| Browser | Untrusted | Everything received is validated. CSRF tokens. Content security policy limits what the page can load or run. |
| Application server | Trusted code, untrusted input | Joi validation, authorization middleware, no raw query building from input. |
| Database | Trusted, reachable only from the server | Credentials in environment, network access limited to the host where possible, least-privilege database user. |
| Cloudinary, Mapbox | Third parties | Secrets stay on the server. Only the public Mapbox token reaches browsers. Responses are treated as untrusted data. |
| Uploaded files | Untrusted | Size and type limits, content check, temporary storage always cleaned. |

### 14.2 Required controls (PRD NFR-1 to NFR-8)

- Content security policy with no inline script or style allowance. Only the origins the app uses are allowed. Changing it requires a note here.
- Security headers through helmet. Framing denied.
- CSRF on every state-changing request.
- Session cookie: HttpOnly, SameSite Lax, Secure in production; proxy trust set in production.
- Per-IP rate limits on login, signup, geocoding and a global backstop. In-memory store for the MVP (single instance).
- Passwords hashed. Generic login failure message.
- All input validated; queries built only from validated fields.
- Output escaped by the template engine. Raw output is allowed only for trusted, pre-built partials.
- Uploads restricted by type, size and content.
- Destructive scripts refuse production without a force flag.
- Dependencies kept minimal and updated. Run an audit before each release.
- Secrets only in environment variables, never in code, logs or pages.

### 14.3 Data protection

The app stores username, email and a password hash only. No payment data, ID documents or precise personal addresses are stored. Listing addresses are public by design because hosts publish them.

---

## 15. Testing approach

| Level | Tool | What it covers | When it runs |
| --- | --- | --- | --- |
| Unit | Jest | Joi schemas, date handling, formatting, geocode helper, model rules, cascade routine | Every change |
| Integration | Jest, supertest, in-memory database, cheerio | Every route: access rules, validation, happy and failure paths, CSRF, headers, cookie flags, rate limits, cleanup after failures | Every change |
| Browser | Playwright | Pages for console errors (content security policy, integrity), calendar disabling of booked dates, map pin placing, keyboard use of menus and stars, confirm prompts, font loading | Before release and after any interface change |
| Accessibility | Automated audit in the browser suite plus manual keyboard pass | DESIGN section 13 | Before release |
| Design conformance | A repository check | No raw hex values outside `tokens.css`, no inline styles or scripts in views | Every change |

Rules:
- A feature or fix is not done without tests at the right level.
- External services are always mocked. Time-sensitive logic uses fixed dates.
- A concurrency test proves two simultaneous reservations for the same nights cannot both succeed.
- Tests run on Node 20.19 or newer.
- The existing suite must keep passing. Coverage is reported, with no fixed percentage target; do not remove tests to meet one.

---

## 16. Deployment approach

### 16.1 MVP deployment

- One web service on Render running the production start command, with automatic deploys from the main branch after the owner merges.
- One MongoDB Atlas cluster. Enable automated backups.
- Environment variables set in the host dashboard. `NODE_ENV` is production.
- Health: the home page returning successfully is the only health check needed.
- Logs go to the host's log viewer.

### 16.2 Release checklist

1. Tests and the browser suite pass; audit has no high-severity findings.
2. Browser console shows no policy or integrity errors on every changed page.
3. Back up the database.
4. Deploy. Run the migration script once if the release includes one, with the force flag.
5. Smoke test: sign up, log in, create a listing with a photo, reserve, cancel, review, confirm the cookie is Secure.
6. Roll back by redeploying the previous version if the smoke test fails. Migrations must be backward compatible for one release so rollback is safe.

### 16.3 Rules

- Never run the seed script against production.
- Branches and commits are made by the owner. Agents leave changes in the working tree.

---

## 17. MVP versus later

### 17.1 MVP (build now)

Everything in sections 1 to 16, specifically:
- The existing monolith, hardened and tested.
- Shared layout, header and components, tokens and fonts from the redesign (PRD FR-16 to FR-19).
- Both themes through tokens.
- Content security policy kept strict while adding the new fonts and styles.
- Single-instance deployment with in-memory rate limiting.

### 17.2 Later (do not build until approved)

| Trigger | Change |
| --- | --- |
| Running more than one server instance | Move rate limiting to a shared store. Session store already shared through the database. Country cache becomes per-instance or moves to the shared store. |
| Need for payments | Add a payment provider with its own section here, webhooks, and a payment status on bookings. Move booking creation into a transaction. |
| Need for emails (confirmations, reset) | Add one transactional email provider and a small outbound mail module. Add password reset and email verification. |
| Many images per listing | Extend the listing model and upload flow. Keep Cloudinary. |
| Mobile app or partners | Add a versioned JSON API reusing models and validation. |
| Growing codebase or team | Introduce a bundler, vendor third-party scripts, and consider TypeScript. |
| Search quality complaints | Evaluate Atlas Search before any external search service. |
| Heavy read traffic | Add a cache in front of public pages and image transformations tuned in Cloudinary. |
| Operational needs | Error tracking service, uptime monitoring, structured logs. |
| Moderation needs | Admin role and tools (PRD decision D6). |

---

## 18. Architecture decisions needing your approval

| # | Decision | Recommendation |
| --- | --- | --- |
| AD1 | Vendor Mapbox GL and Flatpickr under `public/` instead of loading them from a CDN, so the policy allows fewer origins and there is no external script dependency. | Yes |
| AD2 | Night theme follows the visitor's system setting only, with no manual toggle in the MVP. | Yes |
| AD3 | Keep Bootstrap for its grid only in the MVP, and plan to remove it once the grid is replaced by the design's own layout rules. | Yes, remove later |
| AD4 | Compensating cleanup instead of database transactions for multi-step writes. | Yes for MVP |
| AD5 | Keep in-memory rate limiting, valid only while one instance runs. | Yes for MVP |
| AD6 | Add a repository check that fails the build when raw colours or inline styles appear in views and styles. | Yes |
| AD7 | Start the home page redesign with the shared layout and components first (PRD D1 option b) so the work does not need redoing. | Yes |

## 19. Listing terms and constants

The fixed lists live in `utils/constants.js`: `CANCELLATION_POLICIES` (flexible 24 hours, moderate 5 days, strict 14 days), `AMENITY_GROUPS`, `HOUSE_RULES`, `ACCESSIBILITY`, `SAFETY`, `GUEST_NEEDS`, `TIME_OPTIONS` (half hours), `COUNTRIES`, `APPROX_RADIUS_M` (500), `TOTAL_LABEL` and `TAX_NOTICE`. `utils/location.js` picks the public circle and gives the public coordinates. `utils/availability.js` has `cancellationTerms` and `isLateCancellation`.

Who sees the location: the public, and guests with no confirmed stay, get `location`, `country` and `approxGeometry` only, on pages, the map, the sitemap and structured data. `addressLine`, `region` and `geometry` go only to the owner and to a guest whose confirmed stay has not ended. Radius search uses `approxGeometry`, so distances cannot be used to find a pin.

Search parameter `needs` filters on `petsAllowed`, `hasWorkspace`, `stepFreeAccess` and `wheelchairEntrance`. `Listing.publicStatus()` is the one definition of what the public can see: not hidden and not draft.
