# Sign-up mode, honest terms and the listing form: report

Nothing was committed or staged. Every change is in the working tree. The seed script and migrations were not run against a real database, and `.env` was not read.

## 1. Files changed and migrations

**Migrations (new, not yet run on any real database):**

- `migrations/007-user-starting-mode.js`: existing users get `startingMode: "guest"`.
- `migrations/008-listing-details.js`: existing listings get the flexible policy, `city` from `location`, default times, `maxNights`, `hasWorkspace`, a public map circle and `detailsIncomplete: true`.

**Server:** `app.js`, `middleware.js`, `schema.js`, `controllers/` (`accountController`, `adminController`, `bookingController`, `listings`, `pageController`, `reportController`, `userController`, `wishlistController`), `models/` (`booking`, `listing`, `user`), `routes/` (`accountRoute`, `listingRoute`, `userRoute`), `utils/` (`availability`, `constants`, `emails`, `seo`, new `location`), `init/index.js` (seed defaults only).

**Views:**

- New: `includes/listingForm.ejs`, `includes/formField.ejs`, `includes/guestNeedsFilter.ejs`
- Deleted: `includes/listingExtras.ejs`
- Changed: `listings/` (`new`, `edit`, `show`, `mine`, `index`), `users/` (`login`, `signup`, `_settings`), `bookings/` (`show`, `hosting`), `includes/` (`priceBreakdown`, `bookingRow`, `listingCard`, `filters`), `legal/` (`cancellation-policy`, `house-rules`), `pages/help`

**Browser:** `public/js/` (`auth`, `booking`, `listingForm`, `map`), `public/css/style.css`.

**Docs:** `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `RUNBOOK.md`, this report.

**Tests:**

- New: `tests/unit/listingSchema.test.js`, `tests/unit/location.test.js`, `tests/integration/listingForm.test.js`, `tests/integration/stayTerms.test.js`, `tests/e2e/signup-listing.spec.js`
- Changed: `tests/helpers.js`, `tests/unit/` (`schema`, `middleware`), `tests/integration/` (`account`, `admin`, `auth`, `honesty`, `listings`, `migrate`, `mode`, `operations`, `pages`), `tests/e2e/` (`a11y`, `browser`, `launch`, `visual`, `server`)

## 2. Status by section

| Section | Status | Notes |
| --- | --- | --- |
| 0 Ground rules | Done | No new dependency, colour, font or shadow. The repository check passes. |
| 1 Account type at sign-up | Done | Includes the "default mode" setting in profile settings. |
| 2.1 Honest price | Done, with one limit | Cards and map pop-ups have no dates, so they show the nightly price. Cards add any cleaning fee. |
| 2.2 Honest reviews | Done | "New" now replaces "No reviews yet" on cards and beside the title. The empty state in the page's Reviews section still says "No reviews yet". |
| 2.3 Cancellation policy | Done | |
| 2.4 House rules section | Done | Placed above both columns, because on phones the booking panel comes first in the columns. |
| 2.5 Search filters | Done | Pets and workspace moved out of the amenities filter, so they are not offered twice. |
| 2.6 Host requests | Done | Request cards show the message, dates and breakdown. Accept and decline are tested. |
| 3 Listing form | Done, with one deviation | Pets allowed is one control, not two. See decision 3 below. |
| 4 Look | Done | Reuses existing components. Checked by eye in light and dark at phone and desktop widths. |
| 5 Tests | Done | See section 4. |
| 6 Docs | Done | |

Nothing is blocked.

## 3. Decisions where the brief left room

1. **Cancellation wording.** Flexible, Moderate and Strict use the 24 hour, 5 day and 14 day limits. The free period counts back from the earliest check-in time on the check-in day, treated as UTC like the rest of the booking dates. Listing times are local to the property, so the deadline can be off by the property's offset from UTC. A listing with no check-in time counts from midnight.
2. **Who is "late".** Only a confirmed booking, cancelled by either party after the deadline. Withdrawing a pending request is never late. Older bookings without stored terms are never flagged. The confirm dialog warns before a late cancellation. Cancelling is still allowed until the check-in day, as it was before.
3. **Pets.** The brief lists pets under both house rules and amenities. It is one checkbox under house rules, which also keeps the amenity in step, so the two can never disagree.
4. **Map circle.** 500 m radius, centred on a random point 100 to 350 m from the pin, so the pin is always inside and never at the centre. The circle stays the same across saves unless the pin moves out of it. Radius search and structured data use this point too, so the pin cannot be worked out from them.
5. **Who sees the exact pin.** The owner, and a guest with a confirmed stay that has not ended. Pending guests and admins viewing the public page do not.
6. **Country list.** No list existed, so `COUNTRIES` was added. A listing whose old free-text country is not on the list must choose again when next saved.
7. **Amenities added:** dryer, dedicated desk, garden, gym, grouped as Essentials, Working here, Outside and leisure, and Food.
8. **Unstated rules.** Migrated listings leave house rules, accessibility and safety unset, and the listing page does not show them, because "No pets" would be a claim the host never made. Saving the form records unticked boxes as "no".
9. **Publishing with no pin and no acknowledgement** saves the listing as a draft with a warning rather than losing the form. A listing that is already live stays live if a new address cannot be placed, and the host is warned.
10. **Moving a live listing to draft** is refused while it has upcoming confirmed bookings or open requests. Listings hidden by the team stay hidden, and their form offers only "Save changes".
11. **Admins cannot open drafts.** Draft means owner only.
12. **Changing an address.** Filling in a part that was never stored, such as the address line on a migrated listing, does not move the pin. Changing a stored part without moving the pin looks the address up again. If that lookup fails, the old pin is dropped and the host is told.
13. **Latest check-in** cannot be earlier than the earliest, so a check-in window cannot run past midnight.
14. **Price minimum** stays at 1, which matches the existing model rule for "positive".
15. **Sign-up landing page.** A new host lands on Your listings, and a new guest on the home page.

**Intentional test changes (behaviour changed on purpose, no test deleted):**

- Login tests now cover sign-up and the saved mode, because the login control is gone.
- "Unknown location is rejected" became "kept as a draft", as the brief asks.
- The public map test expects a circle, and the owner test expects the pin.
- The structured-data latitude is now near the pin, not on it.
- "An old stay is not called new" became "every stay with no reviews says New".
- "Blank category clears it" now uses an optional field, because category is required.
- The last-photo and no-photo tests expect an inline 400 instead of a redirect.

## 4. Tests

| Suite | Before | After |
| --- | --- | --- |
| Jest | 544 tests in 39 suites, all passing | 774 tests in 43 suites, all passing |
| Playwright | 105 tests: 103 passed, 2 failed (`visual: report` and `visual: admin`, a network name error in the environment) | 134 tests, all passing. The 2 earlier failures passed on these runs without any fix for them, so they may come back if the network name error does. |

## 5. What could not be verified

- **Real photo upload.** Cloudinary is mocked in Jest. In the browser tests, photo selection, previews and the cover choice ran, but nothing was uploaded.
- **Real geocoding and real Mapbox tiles.** Both are stubbed. The circle was seen on an empty stubbed map, not over real streets.
- **A real phone or tablet.** Widths were checked in headless Chromium only, not Safari, Firefox or a touch device.
- **Migrations on real data.** They ran only against the in-memory test database.
- **Real email.** Mail is mocked, so the new "Total before taxes" and cancellation lines were not seen in a mail client.

## 6. What the owner should check by eye

1. **The legal wording on `/cancellation-policy` and `/house-rules`, and the three policy descriptions.** I changed legal text, so have whoever owns those pages read them.
2. **The deadline being in UTC.** It is labelled UTC on the booking page. Decide whether that is acceptable for hosts far from UTC.
3. **The defaults migration 008 gives existing listings** (flexible, check-in 15:00 to 20:00, check-out 11:00), which are shown as "not confirmed yet" until the host saves. Take a backup and run `npm run migrate` on deploy.
4. **The circle over a real map,** both its colour and its size.
5. **Sign-up at 375 px,** which is now a longer page, and the listing form's length on a phone.
6. **The "No pin yet" flow** with your real geocoder: an address it cannot find, then the checkbox.
7. **A real upload** of six photos, with a cover choice and alt text, on staging.
