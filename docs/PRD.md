# Wanderlust: Product Requirements Document

| | |
| --- | --- |
| **Product** | Wanderlust, a travel stay discovery and booking web app |
| **Document status** | Draft v1.0, awaiting owner approval of the items in section 16 |
| **Owner** | Aniket |
| **Audience** | Coding agents and developers. This file is the source of truth for scope and behaviour. |
| **Stack (existing)** | Node.js, Express, Mongoose/MongoDB Atlas, EJS (ejs-mate), Passport (local), Cloudinary, Mapbox |

## How to read this document

- **[Built]** means the behaviour exists in the codebase today and must keep working.
- **[Change]** means the behaviour is to be built or changed under this PRD.
- **[Assumption A#]** is something I inferred. It stands until you correct it.
- **[Decision D#]** needs your approval before an agent builds it. The full list is in section 16.
- Requirement IDs (FR-, NFR-) are stable. Agents should cite them in commit messages and test names.
- Agents must not add features, pages or data fields that are not listed here. If something is missing, stop and ask.

---

## 1. Problem, value and users

### 1.1 Problem

People looking for a place to stay outside the big booking platforms face crowded, template-looking sites, unclear availability and prices, and weak trust signals. Hosts with a single property have no simple, good-looking place to list it.

### 1.2 Value proposition

Wanderlust is a curated, calm place to find and reserve a stay:

- Browse and search stays by place, type, price, rating, dates and map.
- Pick dates on a calendar that already hides nights that are taken, so a chosen stay is a stay the guest gets.
- See the nightly price in the stay's own currency before reserving.
- Cancel an upcoming reservation without contacting anyone.
- A premium, photography-led interface with a distinct brand (see section 17).

### 1.3 Target users

| User | Description | Primary goal |
| --- | --- | --- |
| **Guest** | A traveller, mostly in India [Assumption A1], planning a trip | Find a stay, check it is free on their dates, reserve it |
| **Host** | A person who owns or manages one or more properties | List a property with good photos, see who has reserved it |
| **Visitor** | Anyone not logged in | Browse stays before deciding to sign up |

A person is not a "guest account" or "host account". Any registered user can reserve stays and also list stays [Built].

---

## 2. Core user journeys

**J1. Discover and reserve (guest).**
Visitor lands on the home page, searches or filters, opens a stay, picks dates on the calendar, logs in or signs up if needed, reserves, and sees the booking under Trips.

**J2. Browse on the map (visitor or guest).**
Opens Map, pans and zooms, sees stays as pins and clusters, opens a stay from a pin.

**J3. Save for later (guest).**
Logged-in user taps the heart on a stay, finds it again under Saved.

**J4. List a property (host).**
Logged-in user opens Host a stay, fills the form, uploads a photo, places the pin on the map, submits, and sees the new listing live.

**J5. Manage hosting (host).**
Host opens the Hosting dashboard, sees reservations on their listings, cancels one if needed, edits or deletes a listing.

**J6. Review a stay (guest).**
Guest opens a stay they are not hosting, gives a 1 to 5 rating and an optional comment.

**J7. Cancel a trip (guest).**
Guest opens Trips and cancels an upcoming reservation.

---

## 3. User stories

IDs map to requirements in section 4.

**Discovery**
- US-1. As a visitor, I can browse a paginated list of stays so that I can find somewhere to go. (FR-1)
- US-2. As a visitor, I can search by destination text so that I can find stays in a place. (FR-2)
- US-3. As a visitor, I can filter by category, property type, country, price range and minimum rating. (FR-3)
- US-4. As a visitor, I can enter check-in and check-out dates so that only stays free on those nights appear. (FR-4)
- US-5. As a visitor, I can view stays on a map and open one from its pin. (FR-5)

**Stay detail and booking**
- US-6. As a visitor, I can open a stay and see photo, description, location map, price, reviews and host. (FR-6)
- US-7. As a logged-in user, I can pick available dates and reserve a stay. (FR-7)
- US-8. As a user, I can see my reservations and cancel an upcoming one. (FR-8)
- US-9. As a host, I can see reservations on my listings and cancel one. (FR-9)

**Account**
- US-10. As a visitor, I can sign up with username, email and password. (FR-10)
- US-11. As a user, I can log in and log out. (FR-11)

**Saved**
- US-12. As a user, I can save and unsave a stay and see my saved list. (FR-12)

**Hosting**
- US-13. As a user, I can create a listing with photo, details and map pin. (FR-13)
- US-14. As an owner, I can edit or delete my listing. (FR-14)

**Reviews**
- US-15. As a user, I can review a stay once, but not my own. (FR-15)
- US-16. As an author, I can delete my own review. (FR-15)

---

## 4. Functional requirements

### 4.1 Listings and search

| ID | Requirement | Status |
| --- | --- | --- |
| FR-1 | The home page lists stays, newest first, 12 per page, with pagination links preserving active filters. | Built |
| FR-2 | Text search matches title, location, country and description, with title weighted highest. When text search is active, results are ranked by relevance. | Built |
| FR-3 | Filters: category, property type, country, min price, max price, min rating (1 to 5). Min price may not exceed max price. | Built |
| FR-4 | Date filter: check-in and check-out must be given together, check-out after check-in. Stays with a confirmed booking overlapping those nights are excluded. | Built |
| FR-5 | Map view shows stays that have a pin, clustered, using the same filters. It shows at most 500 pins. When more match, a visible notice states how many are shown and how many matched. | Built |
| FR-5a | "Near" filter: stays within a radius (1 to 1000 km) of a point. Results are not sorted by distance. | Built |
| FR-5b | Category set: Trending, Beachfront, Mountains, Cabins, Cities, Countryside, Luxury, Budget, Tiny Homes, Unique Stays. Property types: House, Apartment, Cabin, Villa, Cottage, Treehouse, Castle, Tiny Home. Currencies: INR, USD, EUR, GBP, AUD, CAD, JPY, AED. | Built |

### 4.2 Stay detail and reservations

| ID | Requirement | Status |
| --- | --- | --- |
| FR-6 | Stay page shows photo, title, location, property type and category, description, nightly price with currency, average rating and review count, host name, a map when a pin exists, the reviews list, and the booking panel. | Built |
| FR-7 | A logged-in user can reserve by choosing check-in and check-out on a calendar. Nights already booked are disabled. Check-in cannot be before today. Maximum stay is 30 nights. The total price is nights times the nightly price. The server rejects any overlap, and the database enforces one confirmed booking per night per stay. | Built |
| FR-7a | A host cannot reserve their own stay. | Assumption A2, verify in code |
| FR-8 | Trips lists the user's reservations, paginated, 12 per page. The guest can cancel an upcoming one. Cancelling frees the nights. | Built |
| FR-9 | The Hosting dashboard lists reservations on the host's listings, paginated. The host can cancel one. The flash message says "Reservation cancelled." for the host and "Booking cancelled." for the guest. | Built |

### 4.3 Accounts

| ID | Requirement | Status |
| --- | --- | --- |
| FR-10 | Sign up: username 3 to 30 characters (letters, numbers, underscore), a valid email (stored lowercase and trimmed, unique), password 8 to 128 characters with at least one letter and one digit. Friendly errors for taken username or email. No raw database errors shown. | Built |
| FR-11 | Log in with username and password, log out with a POST. A failed login says only "Incorrect username or password." After login the user returns to the page they came from. | Built |

### 4.4 Saved stays

| ID | Requirement | Status |
| --- | --- | --- |
| FR-12 | A logged-in user can add or remove a stay from their saved list. The heart shows the saved state on every card. Logged-out users see a login link in place of the heart. The Saved page lists saved stays. | Built |

### 4.5 Hosting

| ID | Requirement | Status |
| --- | --- | --- |
| FR-13 | Create listing form fields: title, description (max 2000 characters), price (minimum 1), currency, category, property type, location, country, one photo (JPEG, PNG or WebP, max 5 MB), and a map pin. If the pin is not placed, the server looks up coordinates from the address. If lookup fails the listing is still saved without a pin. | Built |
| FR-14 | The owner can edit all of the above and replace the photo. Changing the address clears the old pin and re-looks it up. The owner can delete the listing, but not while it has upcoming confirmed bookings. Deleting also removes its reviews and past bookings, and removes it from users' saved lists. | Built |

### 4.6 Reviews

| ID | Requirement | Status |
| --- | --- | --- |
| FR-15 | A logged-in user can leave one review per stay: integer rating 1 to 5, comment up to 1000 characters. The owner cannot review their own stay. Only the author can delete a review, and only through the stay it belongs to. The stay's average rating and review count update after every change. | Built |

### 4.7 Redesign and brand (new work)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-16 | Apply the new homepage design (top navigation instead of the sidebar, new hero, search bar, category tabs, stay cards, map band, trust row, footer) to the home page. See section 7 and section 17. | Change |
| FR-17 | Replace all hard-coded and legacy `--wl-*` colours with the Wanderlust colour system tokens (`docs/design/color-system.md`). Light and dark themes are supported by a `data-theme` attribute. | Change |
| FR-18 | Apply the same navigation, tokens and card design to every other page so the product looks like one system. | Change, Decision D1 |
| FR-19 | Cards show a rating only when the stay has reviews. Stays without reviews show "New". No invented numbers (for example a fake 4.8 or a fake photo count) may be displayed. | Change |

---

## 5. Non-functional requirements

### 5.1 Security (existing controls must not regress)

- NFR-1. CSRF token required on every state-changing request, including method-override forms.
- NFR-2. Content Security Policy without `unsafe-inline` for scripts and styles. No inline `<script>`, inline event handlers or inline `style=""`. Scripts and styles live in files under `public/`.
- NFR-3. Helmet security headers. Session cookie is HttpOnly, SameSite=Lax and Secure in production. App sets `trust proxy` in production. App refuses to start in production without a session secret.
- NFR-4. Per-IP rate limits on login, signup and the geocode endpoint. Geocode requires login.
- NFR-5. All request input is validated with Joi. Passwords are hashed by passport-local-mongoose.
- NFR-6. Uploads are limited to 5 MB and to JPEG, PNG and WebP, checked by type and by file content. Temporary files are removed on every failure path.
- NFR-7. Destructive scripts (seed, migrate) refuse to run in production without `--force`.
- NFR-8. Secrets only in environment variables. The Mapbox token used in browsers is public and URL-restricted. The server-side geocoding token is separate and secret.

### 5.2 Accessibility

- NFR-9. WCAG 2.2 AA. All text pairs meet 4.5:1 (large text 3:1). Use the colour system's measured pairs only.
- NFR-10. Everything is operable by keyboard. A visible focus ring (`--focus-ring`, 2px, 2px offset) on every interactive element.
- NFR-11. Real `button`, `a`, `input` and `label` elements. Icon-only buttons have an accessible name. Status is never conveyed by colour alone.
- NFR-12. Images have meaningful alt text from the listing title.

### 5.3 Performance

- NFR-13. Proposed targets on a mid-range phone on 4G [Assumption A3]: Largest Contentful Paint under 2.5 s, Cumulative Layout Shift under 0.1 on the home page.
- NFR-14. Card images are requested at a size suited to their slot, with reserved aspect ratio and lazy loading below the fold. Hero image is not lazy loaded.
- NFR-15. List pages are server-paginated. No query returns unbounded results.

### 5.4 Reliability and data integrity

- NFR-16. Double booking is impossible under concurrent requests (unique partial index on listing and night for confirmed bookings).
- NFR-17. Multi-step writes clean up after failure (for example a failed save destroys the freshly uploaded image).
- NFR-18. The server starts listening only after the database connection succeeds, and exits with code 1 otherwise.
- NFR-19. Dates are treated as UTC calendar days on the server, and the booking calendar uses the same "today".

### 5.5 Compatibility and quality

- NFR-20. Supports the latest two versions of Chrome, Edge, Firefox and Safari, and iOS Safari and Android Chrome.
- NFR-21. Responsive from 360 px to 1920 px. Single-column on phones. The page never scrolls sideways.
- NFR-22. English only [Assumption A4]. Currency shown per listing; no conversion.
- NFR-23. Automated tests (Jest and Playwright) pass before any change is accepted. New behaviour ships with tests.
- NFR-24. Node 20.19 or newer.

---

## 6. Roles and permissions

There is one account type. Permissions depend on the situation.

| Action | Visitor | Logged-in user | Listing owner | Booking party (guest or host of that booking) |
| --- | --- | --- | --- | --- |
| Browse, search, view stays and map | Yes | Yes | Yes | Yes |
| Sign up, log in | Yes | n/a | n/a | n/a |
| Save and unsave stays | No | Yes | Yes | Yes |
| Reserve a stay | No | Yes (not own, A2) | No | n/a |
| View own trips | No | Yes | Yes | Yes |
| View hosting dashboard | No | Yes (empty if no listings) | Yes | Yes |
| Cancel a reservation | No | Only if party to it | Yes, on own listing | Yes |
| Create a listing | No | Yes | Yes | Yes |
| Edit or delete a listing | No | No | Yes (delete blocked with upcoming bookings) | No |
| Review a stay | No | Yes, once per stay, not own | No | n/a |
| Delete a review | No | Own review only | Own review only | n/a |
| Use geocode lookup | No | Yes (rate limited) | Yes | Yes |

No admin role exists. [Decision D6]

---

## 7. Pages and screens

All pages share the same navigation, footer, tokens and flash-message component after FR-16 to FR-18.

| # | Page | Route | Access | Purpose and key content |
| --- | --- | --- | --- | --- |
| 1 | Home / Stays | `/listings` | Public | Hero with headline and search (where, check-in, check-out, guests [D2]), category tabs, Filters panel, Map view link, stay cards grid, pagination, map band, short trust row, footer. |
| 2 | Map | `/listings/map` | Public | Clustered pin map, filters, pin popup with link to stay, cap notice above 500. |
| 3 | Stay detail | `/listings/:id` | Public | Photo, details, map, price, calendar and Reserve, reviews, review form, owner actions (Edit, Delete). |
| 4 | New listing | `/listings/new` | Logged in | Listing form with map pin picker. |
| 5 | Edit listing | `/listings/:id/edit` | Owner | Same form, prefilled. |
| 6 | Sign up | `/signup` | Public | Username, email, password. |
| 7 | Log in | `/login` | Public | Username, password. |
| 8 | Saved | `/wishlist` | Logged in | Grid of saved stays. |
| 9 | Trips | `/bookings` | Logged in | Reservations as a guest, with cancel. |
| 10 | Hosting | `/bookings/hosting` | Logged in | Reservations on own listings, with cancel. |
| 11 | Error | any | Public | Friendly message and way home. |

Navigation items: Stays, Map, Saved, Trips, Host a stay, Log in or account menu, currency indicator [LD2: no currency indicator; prices carry their currency].

---

## 8. Data requirements

### 8.1 Entities

**User**
- username (unique), email (unique, lowercase), password hash and salt, saved stays (list of listing IDs).

**Listing**
- title (required), description (up to 2000, default empty), photo (url and storage id), price (number, minimum 1, required), currency (default INR), location (required), country (required), pin (GeoJSON point, optional), category, property type, owner (user), reviews (list), average rating and review count (derived).
- Indexes: text index on title, location, country, description; category with price; country with price; rating; geospatial on pin.

**Review**
- rating (integer 1 to 5), comment (up to 1000), author (user), created time (set when created).

**Booking**
- listing, guest, check-in, check-out, nights (one date per night), total price, status (confirmed or cancelled), timestamps.
- Unique partial index: one confirmed booking per listing per night.

**Session**
- Stored in MongoDB, created only when needed.

### 8.2 Rules

- Prices are stored in the stay's currency. No conversion anywhere.
- `GST_RATE` stays null. The breakdown says: "Taxes are not included. The host will confirm any applicable taxes." [LD3]
- Deleting a listing cascades to its reviews and bookings and removes it from saved lists (same shared routine used by the seeder).
- Old listings may lack currency, category or pin. Migration script sets currency to INR and reports the rest.
- No personal data beyond username, email and hashed password is collected.

### 8.3 Not stored today

Payment data and host contact details. Guest count, capacity, multiple photos, amenities, and bedroom and bathroom counts were added for launch (section 18).

---

## 9. Integrations

| Service | Use | Notes |
| --- | --- | --- |
| MongoDB Atlas | Primary database and session store | Connection from `ATLAS` env var. |
| Cloudinary | Listing photo storage | Upload on create and edit, destroy on replace or delete. |
| Mapbox | Browser maps and clustering (public token, URL-restricted); server geocoding (separate secret token, 5 s timeout) | Failure falls back gracefully (listing saved without a pin). |
| Fonts | Instrument Serif, Geist and Geist Mono for the new design | Currently the CSP allows only self-hosted fonts. Fonts must be self-hosted under `public/fonts/`. [Decision D7] |
| Unsplash | Seed data photos only | Not a runtime dependency. |
| Hosting | Render | Behind a proxy; `trust proxy` required. |

No payment, email, SMS, analytics or social login integration is in scope. [Decision D5]

---

## 10. Loading, empty and error states

| Area | Loading | Empty | Error |
| --- | --- | --- | --- |
| Home list | Server-rendered. Card images reserve their space (4:5 ratio) and fade in. | "No stays found. Try adjusting your destination, dates or filters." with a Clear filters button. | Invalid filters: message at top of the page and the list falls back to defaults. Server failure: error page. |
| Map | Map area shows a neutral placeholder until tiles load. | No pins: map stays visible with "No stays with a location match these filters." | Map script or token failure: inline message, list link offered. Never a blank grey box. |
| Stay detail | Calendar renders disabled until booked dates load. | No reviews: "No reviews yet." | Reserve failure shows the reason (dates taken, past date, over 30 nights, not logged in). Unknown stay ID: 404 page. |
| Reservation | Reserve button disabled and labelled while submitting. | Disabled until a valid range is chosen. | Taken nights race: friendly message, calendar refreshed. |
| Trips and Hosting | Server-rendered. | "No trips yet." with link to browse. "No reservations on your listings yet." | Cancel failure: flash error, record unchanged. |
| Saved | Server-rendered. | "Nothing saved yet." with link to browse. | Failure: flash error, heart state unchanged. |
| Listing form | Submit disabled while uploading. | n/a | Field-level messages from validation. File too big or wrong type: "Image must be a JPEG, PNG or WebP under 5 MB." Address lookup failed: listing saved without pin, with a notice. |
| Auth forms | Submit disabled while sending. | n/a | Flash message. Rate limited: "Too many attempts. Try again later." CSRF failure: 403 page with a refresh option. |
| Any page | n/a | n/a | 404 for unknown routes. 500 page with no technical details. Flash messages use success, warning and error tokens with an icon and text. |

---

## 11. MVP scope

The product already works. MVP means finishing the redesign on a stable base.

### In scope

1. All **[Built]** behaviour in section 4, unchanged and tested.
2. FR-16 to FR-19: new homepage, colour system tokens in light and dark, unified navigation and cards on every page, honest ratings.
3. Self-hosted fonts for the new typography (D7).
4. Resolve decisions D1 to D5 below.
5. The original bug and security fixes already applied stay applied (NFR-1 to NFR-8).
6. Production deployment checklist: environment variables, `NODE_ENV=production`, database backup, migration run.

### Out of scope (assumed, pending approval) [Assumption A5]

- Payments or deposits, invoices and tax calculation.
- Push notifications. (Email is now in scope: section 18.)
- Messaging between guest and host.
- Anything beyond the minimal admin in section 18.
- Price rules. (Multiple photos, amenities, bedrooms, bathrooms and availability rules are now in scope: section 18. Originally excluded, for example blocked dates).
- Currency conversion and multi-language support.
- Native mobile apps.
- Distance sorting. (Price and rating sorting are now in scope.)
- Social login.

---

## 12. Success criteria

All criteria are proposals [Assumption A6]. Targets marked "baseline" need a first measurement.

| Area | Criterion |
| --- | --- |
| Correctness | Zero double bookings in a concurrent-request test. Full Jest and Playwright suites pass. |
| Journey | A new visitor can go from home page to a confirmed reservation in under 2 minutes without help (tested with 3 people). |
| Accessibility | Automated audit scores 95 or higher on every page. Every text pair meets AA in both themes. Full keyboard path through J1 works. |
| Performance | Home page meets NFR-13 on the test device. Baseline recorded before the redesign and compared after. |
| Security | No CSP violation or SRI error in the browser console on any page. No hard-coded hex colours outside the tokens file. |
| Brand | Every page uses tokens only. A grep check for stray hex values passes. |
| Honesty | No fabricated numbers appear in the interface (FR-19). |

---

## 13. Dependencies and constraints

- Colour system and homepage design are inputs: `docs/design/color-system.md` and the approved homepage design.
- CSP forbids inline styles and scripts: the design must be built with classes and external files.
- Project rule for agents: do not commit or push. Leave changes in the working tree for the owner to review.

---

## 14. Rollout notes

1. Back up the production database.
2. Set production environment variables (`NODE_ENV`, `SECRET`, `ATLAS`, Cloudinary keys, public and server Mapbox tokens).
3. Run `node init/migrate.js --force` once. Do not run the seeder in production.
4. Smoke test: sign up, log in, create a listing with a photo, reserve, cancel, review, check console for CSP errors, confirm the session cookie is Secure.

---

## 15. Assumptions

| # | Assumption |
| --- | --- |
| A1 | The main audience is travellers in and around India, so INR is the default currency. |
| A2 | A host cannot reserve their own listing. Verify the code enforces this; add it if not. |
| A3 | The performance targets in NFR-13 are acceptable. |
| A4 | English only for now. |
| A5 | Everything listed under out of scope is out of scope until you say otherwise. |
| A6 | The success criteria in section 12 are acceptable as proposed. |
| A7 | The booking flow is a reservation only, with no payment step. |

---

## 16. Decisions that need your approval

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Scope of the redesign | (a) Home page only. (b) Every page uses the new navigation and cards. | (b), so the product feels like one brand. Larger effort. |
| D2 | Guests field | The new search bar shows "Guests", but bookings store no guest count. (a) Remove the field from the search bar. (b) Add guest count to bookings and a maximum-guests field to listings. | (a) for MVP. (b) is a data change and a new rule. |
| D3 | Currency selector in the navigation | **Decided (LD2):** the client converter is removed. Prices show in the listing's own currency. Price filters apply within one chosen currency. | Closed |
| D4 | GST or tax | (a) Keep tax hidden (`GST_RATE` null). (b) Show a tax line at a rate you set. | Your call: depends on whether GST applies to your hosts. |
| D5 | Payments | (a) Reservation only, no payment (current). (b) Add a payment provider. | (a) for MVP, but note guests are not charged, so reservations are promises only. |
| D6 | Admin or moderation | (a) None. (b) A minimal admin role that can remove listings and reviews. | (a) for MVP. |
| D7 | Fonts | (a) Self-host Instrument Serif, Geist and Geist Mono (keeps strict CSP). (b) Allow Google Fonts in the CSP. | (a). |
| D8 | Photos on cards | The design shows a photo counter (for example 1/12), but each listing has one photo. (a) Remove the counter. (b) Support multiple photos. | (a) for MVP. |
| D9 | Reviews | **Decided:** (b) only after a completed stay. New reviews carry `verifiedStay`; older reviews stay visible without the label. | Closed |
| D10 | Success targets | Confirm or change the numbers in section 12. | Accept as proposed. |
| D11 | Coordinates on cards | (a) Show coordinates when a stay has a pin, and the place name alone when it has none. (b) Never show coordinates. | (a). It is the brand's signature detail. |

---

## 17. Brand and visual requirements

These apply to FR-16 to FR-19. The full detail is in `docs/design/color-system.md`.

- **Palette.** Stone and Night themes. Primary deep teal ink `#0E2B29` (light) and stone `#EDE9DF` (dark). Brass accent `#8A6420` (light) and `#D3A85A` (dark), under 5% of any screen. Background `#F1EFE9` and `#0A1312`.
- **Type.** Instrument Serif for headlines and stay titles, Geist for body and controls, Geist Mono for small labels and coordinates.
- **Shape.** Photographs and cards use a 4 px radius. Buttons and filter pills are fully rounded. No shadows except a single soft shadow on the search bar and floating cards.
- **Signature detail.** Each stay shows its place name with latitude and longitude. [Decision D11: coordinates come from the listing's pin, so listings without a pin show only the place name.]
- **One primary action per view.**
- **Not allowed.** Gradients, glassmorphism, neon, coloured shadows, emoji, invented statistics, stock testimonials.
- **Photography.** Real listing photos only.
- **Dark theme.** Same components, tokens only.
- **Tokens.** Colours are referenced by token name. No hex values in component styles.

---

## 18. Launch decisions and added requirements (2026-11)

These override earlier sections where they disagree. Implementation status is in `LAUNCH_IMPLEMENTATION_REPORT.md`.

| ID | Decision |
| --- | --- |
| LD1 | Request to book, pay at the property. The host accepts or declines. Only an accepted booking is "Confirmed" and holds nights. No payment provider. |
| LD2 | No client currency converter. Prices show in the listing's own currency. |
| LD3 | `GST_RATE` stays null. The breakdown says taxes are not included. |
| LD4 | In production a user must verify their email before creating a listing or sending a booking request. |
| LD5 | Legal pages are drafts with placeholders and a notice, controlled by `LEGAL_REVIEWED`. |
| LD6 | Experiences and Destinations are not built. |
| LD7 | Dark mode follows `prefers-color-scheme`. No toggle. |
| LD8 | Minimal admin: hide and unhide listings, resolve reports and support messages. |
| LD9 | `APP_TIMEZONE` (default `Asia/Kolkata`) defines "today". Stays are calendar dates. |

| ID | Requirement | Status |
| --- | --- | --- |
| FR-16 | Password: 8 to 128 characters, at least one letter and one digit, enforced in the browser and on the server. | Built |
| FR-17 | Reviews need a completed stay at that listing (D9). | Built |
| FR-18 | Account: change profile and password, download data, delete the account. | Built |
| FR-19 | Support: Help page, Contact form with a reference, stored and forwarded. Draft legal pages. | Built |
| FR-20 | Email: verification, password reset and change, each booking state change for both parties, support, reports, account deletion. | Built; real delivery unverified |
| FR-21 | Availability: hosts block nights and set a minimum stay. Requests are refused over blocked or confirmed nights. | Built |
| FR-22 | Capacity: bedrooms, beds, bathrooms and maximum guests on each listing. Search and booking enforce guest count. | Built |
| FR-23 | Sorting: newest, price up, price down, highest rated. | Built |
| FR-24 | Amenities and up to the configured number of photos, with a gallery. | Built |
| FR-25 | Reporting a listing, and an admin dashboard limited to LD8. Hidden listings leave search, map and sitemap, and open only for their owner and admins. | Built |

FR-7 now sends a request rather than reserving (LD1). FR-10 includes the password rule in FR-16.
