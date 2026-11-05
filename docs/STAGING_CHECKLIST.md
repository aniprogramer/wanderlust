# Wanderlust: Staging Checklist

Automated tests mock Cloudinary, Mapbox and SMTP. This script checks the real ones, so run it on a staging deployment with its own database before launch and after changing any of those accounts.

Tester: ________ Date: ________ Commit: ________

## Setup

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| 1 | Deploy with `NODE_ENV=production` and one required variable removed | App refuses to start and names the variable | |
| 2 | Restore the variable. Run `npm run migrate` | Each migration reports applied | |
| 3 | Open `/health` | `{"status":"ok"}` | |
| 4 | Check response headers on the home page | HSTS and CSP present; session cookie is `Secure` after login | |

## Accounts and email

Use an inbox you can read, and check the spam folder on each one.

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| 5 | Sign up as Guest | Verification email arrives within a minute; links use `APP_URL` | |
| 6 | Before verifying, try to send a booking request | Refused with a prompt to verify | |
| 7 | Click the link | "Email confirmed"; the banner disappears | |
| 8 | Forgot password, using the link in the email | Reset works, a "password changed" email arrives, other sessions are logged out | |
| 9 | Check SPF and DKIM in the message headers | Both pass | |
| 10 | Send the Contact form | Confirmation to the sender; message reaches `SUPPORT_EMAIL` with a reference | |

## Listings and photos

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| 11 | Sign up and verify as Host. Create a listing with a real JPEG cover and 2 gallery photos | Saved; photos appear in the Cloudinary folder; gallery works | |
| 12 | Upload a text file renamed `.jpg` | Refused with a clear message; nothing in Cloudinary | |
| 13 | Upload a file over 5 MB | Refused with a clear message | |
| 14 | Check an image URL on a phone-width home page | URL includes a width transform; a smaller file is loaded | |
| 15 | Edit: change the price, remove one photo, add one | Saved; the removed photo is gone from Cloudinary | |
| 16 | Delete a listing with no upcoming stays | Gone; its photos are gone from Cloudinary | |

## Maps and geocoding

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| 17 | Create a listing with an address and no pin | Pin appears at the right place | |
| 18 | Enter an address that does not exist | Listing saves with a message that it has no pin | |
| 19 | Open `/listings/map` | Tiles load; clusters appear; pins open the stay | |
| 20 | **S5:** In the Mapbox dashboard, restrict the public token to the staging and production URLs. Reload the map, then call the token from another origin | Map still works on the site; other origin is refused | |
| 21 | Confirm the server token is secret (`sk.`) and absent from the page source | Not found in the HTML | |

## Booking requests

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| 22 | As Guest, request 3 nights | Reference shown; guest gets a "request sent" email; host gets a "new request" email | |
| 23 | As Host, accept | Status Confirmed; guest email; nights disabled in the calendar | |
| 24 | Request overlapping dates as another guest | Calendar blocks them; a forced request is refused | |
| 25 | Request again and decline with a reason | Guest email includes the reason | |
| 26 | Cancel a confirmed stay as Guest, then one as Host | The other party is emailed; nights are free | |
| 27 | Leave a request unanswered past 48 hours | Shows as expired; guest is told | |
| 28 | Review a stay after its check-out | Review shows "Verified stay" | |

## Moderation and account

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| 29 | `npm run make-admin -- <user> --yes`. Open `/admin` | Dashboard loads | |
| 30 | Report a listing as Guest | Report in `/admin`; email at `SUPPORT_EMAIL` | |
| 31 | Hide it | Gone from search, map and sitemap; the owner still sees it with a notice | |
| 32 | Export data, then delete the test account | JSON download; "account deleted" email; login no longer works | |

## Legal and search

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| 33 | Open each legal page | Draft notice shows while `LEGAL_REVIEWED=false`; no placeholder left once the variables are set | |
| 34 | Open `/robots.txt` and `/sitemap.xml` | Absolute URLs use `APP_URL` | |
| 35 | Trigger an error with `SENTRY_DSN` set | The event arrives with no password or token in it | |

## Real devices

Automated checks cannot replace these.

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| 36 | Phone (iOS Safari and Android Chrome): search, open a stay, send a request | Works with no sideways scroll | |
| 37 | Screen reader (VoiceOver or NVDA): log in, search, send a request | Everything is announced sensibly | |
| 38 | Dark mode set in the operating system | Every page above is readable | |
