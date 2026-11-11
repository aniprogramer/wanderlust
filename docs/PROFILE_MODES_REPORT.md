# Profiles, modes and pop-ups: report

Work done in the working tree. Nothing was staged or committed.

## 1. Defaults applied (M1 to M6)

| # | Applied as specified | Notes |
| --- | --- | --- |
| M1 | Yes | `session.mode` is `guest` or `host`, set at login and by `POST /mode` (CSRF, Joi-validated). Missing or invalid reads as guest. Logout (new session) and password reset clear it. Never stored on the user. |
| M2 | Yes | Guards in `middleware.js` (`requireMode`, `requireModeForRole`), plus a controller check on listing update and delete. Ownership guards still run after the mode guard. Admin routes are untouched. |
| M3 | Yes | Native radio group "Continue as" (guest default). A saved page from the other mode lands on the mode home with a message that says how to switch. |
| M4 | Yes | Every `req.flash` message is a pop-up. Field errors stay inline. Confirm dialogs unchanged. |
| M5 | Changed on request | One page per person, `GET /users/:username`. The owner also gets their settings on it. `/account` only redirects there. The menus say only "Profile". |
| M6 | Yes | Booking flow untouched. |

Changes from the brief:

- **PRD "A1".** In this repository A1 is the audience and currency assumption (India, INR), not the "every user has both abilities" rule. I kept A1, changed the sentence in 1.3 and the section 6 matrix, and recorded the mode decision as M1 (section 19) and as assumption A8.
- **Public "member since".** Users have no `createdAt`, so it is read from the ObjectId timestamp. This works for existing users with no migration.
- **Cancelling a booking** needs the mode that matches the role (a guest withdraws in guest mode, a host cancels in host mode). Reading a booking works in either mode.
- **"Your listings"** did not exist, so `GET /listings/mine` was added (with the "You have no listings yet" empty state).
- **Email change** also asks for the current password (not in the brief).
- **Hidden profiles.** `profileHidden` exists on the model and answers 404, but there is no admin button for it. It is set by hand.

## 2. Files changed and routes added

Routes added: `POST /mode`, `GET /listings/mine`, `GET /users/:username`, `POST /account/email`. `POST /account/profile` is now multipart and takes profile fields and a photo (no email). `GET /account` redirects to your profile; the form actions keep their `/account/...` paths. All are in the table in `docs/ARCHITECTURE.md` section 10.2.

New files: `utils/mode.js`, `utils/profile.js`, `controllers/profileController.js`, `routes/profileRoute.js`, `migrations/006-user-profile.js`, views `listings/mine`, `users/profile`, `includes/{modeSwitch,avatar,userLink,banner}`, tests `unit/mode`, `integration/{mode,toasts,profiles}`, `e2e/toasts.spec`.

Changed (main ones): `app.js`, `middleware.js`, `schema.js`, `models/user.js`, `utils/constants.js`, the account, user, booking and listing controllers, the listing, booking, review, wishlist, user and account routes, `public/js/flash.js`, `public/css/{style,tokens}.css` (one new token, `--z-toast`), the layout, navbar, sidebar, flash, login, account, privacy and help views, and the four docs.

Removed: `views/includes/auth/alerts.ejs` (its messages are pop-ups now). `flash.ejs` is now the pop-up container.

## Follow-up: floating reminder and one profile

- The email-confirmation reminder was still an in-page banner that pushed the page down. It is now a floating info pop-up (last in the stack, closes itself, comes back on the next page). The stack sits 80px from the top, below the header row, so it never covers the mode switch or the menu. A Playwright test checks the page does not move when it leaves.
- Profile and Account are one page. Your own `/users/:username` shows the public profile with your settings underneath; other people see only the public part. `/account` redirects there, and the menus have Profile and Log out only.

## 3. "Become a host" removed from

- Home hero: the "Become a host" button.
- Home account menu (logged out): "Host your home".
- Home editorial row: the "Become a host" panel (the two remaining panels are half width).
- Navbar: the "Become a host" link.
- Help: "How do I list my place?" no longer says to choose Become a host.
- CSS: `.wl-hero-host-btn`, `.wl-hero-host-link`, `.wl-card-hosting`.

A search of `views/`, `public/`, `utils/`, `tests/e2e/` and `docs/` finds no other uses. `tests/integration/noBecomeHost.test.js` renders the main pages as a visitor and a signed-in user and fails on "become a host", "host your home" or "sign up as a host".

## 4. Visibility as implemented, and the test for each row

| Row | Test |
| --- | --- |
| Public page shows the allowlist (name, username, photo or initials, bio, city and country, languages, member since, verified badge) | `profiles.test.js` "a stranger sees the allowlist and nothing else" |
| Never shown: email, pending email, admin flag, terms version, wishlist, bookings, price, hash and salt, photo file name | "email, pending email, admin flag, ... never appear" |
| The view-model is picked, so a new User field stays private | "the view-model is built by picking" |
| Markup in name and bio is escaped | "markup in a name or bio is escaped" |
| Initials tile, empty optional fields | "without a photo or display name", "optional fields that are empty" |
| Hidden or unknown user is a plain 404 with the same page | "an unknown or hidden user is a plain 404" |
| Host: published listings only, paginated | "a host's published listings", "a long list is paginated" |
| Guest: reviews with stay name, "Verified stay" only where true, hidden stays excluded | "a guest's reviews show the stay and the Verified stay label" |
| Email shared only on a confirmed booking, to the two parties | "both parties see each other's email; a third user does not" |
| Never in lists or on public pages | "no email in lists or on public pages" |
| Pending shares nothing; cancelling takes it away | "a pending request shares nothing, and cancelling takes it away again" |
| Names link to the profile (host, review author, other party, menus); deleted user is plain text | "names link to the public profile", "a deleted reviewer is plain text" |
| Reports and admin flag: admins only | Not new. The admin routes are unchanged and existing in `admin.test.js`. The admin flag is asserted absent from the public page above. |

## 5. Tests added, with before and after

| Suite | Before | After |
| --- | --- | --- |
| Jest | 465 passed, 465 tests, 35 suites (start of this stage 1 work) | 544 passed, 544 tests, 39 suites |
| Playwright | 89 passed | 105 passed |

New Jest tests are in `unit/mode`, `integration/mode`, `integration/toasts`, `integration/profiles` and one added to `integration/migrate`. New Playwright tests are `e2e/toasts.spec.js` (9) plus six screens (profile, visitor profile, your listings) in the visual and axe lists.

Existing tests changed on purpose:

- `helpers.login` takes a mode and reads its token from `/account`, because `/wishlist` is now guest-only. Tests that act as a host log in with `"host"`.
- `operations`: `/bookings/hosting` is checked from a host-mode session.
- `account`: profile, email and username tests now follow the new endpoints (`/account/email`, multipart profile), the old behaviour (email changes at once, loses verification) was replaced by the pending-email flow.
- `bookings` and `bookingFlow`: names are asserted as profile links, not "@name", and the guest email on the hosting list is gone on purpose (it is on the booking page only).
- `honesty` and the e2e flash test: class names changed to the pop-up, and the timer is 6 seconds (was 5).
- e2e `login` helpers pick a mode. Some visual and axe screens of host pages had been passing by being redirected, and now log in as host.
- Earlier in this work: the 2 `repoCheck` failures were fixed by removing a raw-colour hero gradient and 10 other raw colours.

## 6. Not verified

- Real photo upload to Cloudinary: tested with the uploader mocked (upload, replace, remove, rollback, delete). Face-aware cropping (`gravity: auto`) is untested against the real service.
- Real email delivery: the mailer is the test outbox. The email-change link was followed in tests only.
- Migration 006 was run in tests against a test database, not a real one.
- Screen readers: roles, live regions and names are asserted and axe passes, but nobody listened to a real screen reader.
- Pop-up stacking with real server-rendered messages was tested by adding copies in the browser, not by an action that flashes three messages.

## 7. Decisions for the owner

1. **Default mode: guest.** A host who logs in without choosing lands in guest mode and must switch to see Reservations.
2. **Login control.** Choosing host at login sends a guest-page return URL to the host home with a message.
3. **6-second pop-up timer.** Success and info only. Errors and warnings stay until closed.
4. **Booking rule for guests in host mode.** The stay page still shows the booking and review forms in host mode. Submitting one is refused with a message that says to switch. Hiding them in host mode is a small change if you prefer.
5. **Small screens.** The home page has no navbar on phones, so the mode's links sit in the account menu there. The menu has the same items on large screens.
6. **Email change asks for the current password.**
7. **Profile addresses use the username.** A rename changes the profile URL and breaks old links.
