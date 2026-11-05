<div align="center">

<img src="./assets/banner.png" alt="Wanderlust Project Banner" width="100%" />

<br />
<br />

# 🌍 Wanderlust

**A full-stack accommodation marketplace inspired by Airbnb, enabling users to discover, list, and review unique places around the world.**

<br />

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-2ea44f?style=for-the-badge&logo=render&logoColor=white)](https://ani-wanderlust.onrender.com)
[![Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/aniprogramer/wanderlust)
[![Report Bug](https://img.shields.io/badge/Issues-Report%20Bug-d73a49?style=for-the-badge&logo=github&logoColor=white)](https://github.com/aniprogramer/wanderlust/issues)
[![Request Feature](https://img.shields.io/badge/Feature-Request-0366d6?style=for-the-badge&logo=github&logoColor=white)](https://github.com/aniprogramer/wanderlust/issues)

<br />

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.19-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.22-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Media%20CDN-3448C5?style=flat-square&logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![Passport.js](https://img.shields.io/badge/Passport.js-Authentication-34E27A?style=flat-square&logo=passport&logoColor=white)](https://www.passportjs.org/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=flat-square&logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
[![Render](https://img.shields.io/badge/Deployment-Render-46E3B7?style=flat-square&logo=render&logoColor=black)](https://render.com/)

<br />

<p align="center">
  <b>✅ Secure Authentication &amp; Authorization</b> &nbsp;•&nbsp;
  <b>✅ Property Listing Management</b> &nbsp;•&nbsp;
  <b>✅ Image Uploads with Cloudinary</b><br />
  <b>✅ Reviews &amp; Ratings System</b> &nbsp;•&nbsp;
  <b>✅ Responsive Design</b> &nbsp;•&nbsp;
  <b>✅ MVC Architecture</b> &nbsp;•&nbsp;
  <b>✅ Session-Based Authentication</b>
</p>

</div>

---

## 🚀 Live Demo

Visit the live application:

👉 **[https://ani-wanderlust.onrender.com](https://ani-wanderlust.onrender.com)**

Explore listings, create properties, upload images, and submit reviews in real time.

---

## 📌 Project Overview

**Wanderlust** is a full-stack web application engineered on the **Model-View-Controller (MVC)** architectural pattern. It delivers an end-to-end marketplace experience where hosts can publish accommodations and travelers can discover destinations with transparent community reviews and ratings.

### 💡 Problem Solved

Traditional starter web apps frequently omit essential production requirements: granular authorization, resilient session storage, centralized validation, and production cloud media pipelines. Wanderlust bridges this gap by demonstrating:

- **Strict role-based authorization** restricting edit/delete capabilities to verified record owners.
- **Cloud-hosted media offloading** (Cloudinary) preventing server filesystem bloat.
- **Persistent session storage** in MongoDB Atlas decoupled from server memory.
- **Standardized RESTful design** paired with atomic server-side (Joi) and client-side data validation.

---

## ✨ Features

| Feature                          | Description                                                                                                                                                                                                                                                                                                                                                    |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔐 **Authentication & Sessions** | User registration and authentication powered by Passport.js using salted PBKDF2 hashing. Sessions persist in MongoDB via `connect-mongo`.                                                                                                                                                                                                                      |
| 🛡️ **Role-Based Authorization**  | Custom route middleware ensures only the original listing owner can edit/delete listings, and only review authors can delete their reviews.                                                                                                                                                                                                                    |
| 🏠 **Full Property CRUD**        | Complete Create, Read, Update, and Delete lifecycle for listings with localized pricing, descriptions, and regional metadata.                                                                                                                                                                                                                                  |
| ☁️ **Cloud Media Storage**       | Multi-part image file uploads handled via `multer` and streamed directly to Cloudinary cloud infrastructure with auto-generated URLs.                                                                                                                                                                                                                          |
| ⭐ **Review & Rating Engine**    | Community review system linked relationally to listings with numeric ratings and text feedback.                                                                                                                                                                                                                                                                |
| 🗑️ **Cascading Deletion**        | Mongoose `post('findOneAndDelete')` document middleware automatically cascades deletion to remove all associated reviews when a listing is removed.                                                                                                                                                                                                            |
| ✅ **Dual-Layer Validation**     | Input validation on both ends: HTML5/Bootstrap client-side validation and schema-based Joi validation on server requests.                                                                                                                                                                                                                                      |
| 🔔 **Flash Notifications**       | Instant user feedback banners across page reloads via `connect-flash` for operations like login, logout, create, and unauthorized access.                                                                                                                                                                                                                      |
| 🗺️ **Interactive Mapbox Maps**   | Location picker (click, drag or search an address) on the create/edit forms, automatic server-side geocoding, coordinates stored as GeoJSON, an interactive map with marker on every listing, and a clustered map of all search results at `/listings/map`. Invalid addresses are rejected gracefully; without a token the app still works, just without maps. |
| 📅 **Bookings & Availability**   | Date-range calendar (Flatpickr) showing unavailable nights, server-side validation (no past dates, max 30 nights, hosts can't book their own listing) and atomic double-booking prevention through a unique partial MongoDB index. Guests manage trips at `/bookings`, hosts see reservations at `/bookings/hosting`, and both can cancel upcoming stays.      |
| ❤️ **Wishlist**                  | Save/unsave listings from any card; duplicate-free (`$addToSet`), persisted on the user document and shown at `/wishlist`. The heart state on a page of cards costs one small query for the signed-in user.                                                                                                                                                    |
| 🔎 **Search & Filters**          | Full-text search (title, location, country, description) plus category, property type, country, price range, minimum rating and date-availability filters. Query-string based, paginated (12/page), filter values persist across pages, indexed in MongoDB, and collapsible on mobile.                                                                         |
| 🧪 **Automated Tests**           | Jest + Supertest suite (unit + integration) running against an in-memory MongoDB. Cloudinary and Mapbox are mocked.                                                                                                                                                                                                                                            |
| 🔒 **Security Hardening**        | CSRF tokens on every write (`csrf-sync`), `helmet` with a strict Content-Security-Policy (no inline scripts), rate limits on login, signup and geocoding (`express-rate-limit`), `SameSite=Lax` cookies (`Secure` in production), POST-only logout, upload type and size limits (JPEG/PNG/WebP, 5 MB) and Joi validation on signup and login.                  |
| 💱 **Per-Listing Currency**      | Each listing is priced in its own currency (INR, USD, EUR, GBP, AUD, CAD, JPY or AED) and formatted with `Intl.NumberFormat`.                                                                                                                                                                                                                                  |
| 📱 **Responsive UI**             | Mobile-first layout constructed with Bootstrap 5 cards, grid system, responsive navigation, and FontAwesome iconography.                                                                                                                                                                                                                                       |

---

## 📸 Screenshots

<div align="center">

|                           Explore Destinations & Categories                           |                           Property Details & Reservation Engine                           |
| :-----------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------: |
|    <img src="./assets/explore-listings.png" alt="Explore Listings" width="100%" />    |       <img src="./assets/listing-details.png" alt="Listing Details" width="100%" />       |
| _Curated stays with category pills, full-text search, live pricing, and saved hearts_ | _Photo gallery, verified ratings, host profile, Mapbox pin, and dynamic booking calendar_ |

|                          Interactive Clustered Map View                          |                            Trips & Reservation Dashboard                            |
| :------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------: |
| <img src="./assets/map-view.png" alt="Mapbox Clustered Map View" width="100%" /> |     <img src="./assets/booking-trips.png" alt="Trips Dashboard" width="100%" />     |
| _Mapbox integration with coordinates geocoding and clustered property discovery_ | _Traveler trips dashboard with real-time status badges, price breakdown, and dates_ |

|                         Saved Wishlist Collections                          |                         Host Onboarding & Property Creation                         |
| :-------------------------------------------------------------------------: | :---------------------------------------------------------------------------------: |
|    <img src="./assets/wishlist.png" alt="Saved Wishlist" width="100%" />    |      <img src="./assets/create-listing.png" alt="Host a Home" width="100%" />       |
| _Single-click bookmarking persisted to MongoDB user document (`$addToSet`)_ | _Multi-image Cloudinary upload with interactive pin picker, pricing, and amenities_ |

|                             Mobile-First Responsive Experience                              |
| :-----------------------------------------------------------------------------------------: |
|          <img src="./assets/mobile-view.png" alt="Mobile Layout" width="340px" />           |
| _Fully responsive viewport optimized for mobile gestures, sticky actions, and fluid layout_ |

</div>

---

## 🛠️ Tech Stack

### Frontend

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Bootstrap 5](https://img.shields.io/badge/Bootstrap_5-7952B3?style=flat-square&logo=bootstrap&logoColor=white)
![EJS](https://img.shields.io/badge/EJS-Templates-B4CA65?style=flat-square&logo=ejs&logoColor=black)
![ejs-mate](https://img.shields.io/badge/ejs--mate-Layout_Engine-blue?style=flat-square)

### Backend

![Node.js](https://img.shields.io/badge/Node.js_%3E%3D20.19-339933?style=flat-square&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js_4.x-000000?style=flat-square&logo=express&logoColor=white)
![REST API](https://img.shields.io/badge/Architecture-RESTful-orange?style=flat-square)

### Database & Storage

![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose_ODM-880000?style=flat-square&logo=mongoose&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/MongoDB_Atlas-Cloud_DB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_CDN-3448C5?style=flat-square&logo=cloudinary&logoColor=white)
![Mapbox](https://img.shields.io/badge/Mapbox_GL_JS-Maps_&_Geocoding-000000?style=flat-square&logo=mapbox&logoColor=white)

### Security & Utilities

![Passport.js](https://img.shields.io/badge/Passport.js-Local_Strategy-34E27A?style=flat-square&logo=passport&logoColor=white)
![Joi](https://img.shields.io/badge/Joi-Schema_Validation-gray?style=flat-square)
![Express Session](https://img.shields.io/badge/Express_Session-State_Management-blueviolet?style=flat-square)
![Connect Mongo](https://img.shields.io/badge/Connect_Mongo-Session_Store-47A248?style=flat-square)
![Multer](https://img.shields.io/badge/Multer-Multipart_Form_Data-red?style=flat-square)

### Deployment & Tooling

![Render](https://img.shields.io/badge/Render-Web_Service-46E3B7?style=flat-square&logo=render&logoColor=black)
![Git](https://img.shields.io/badge/Git-VCS-F05032?style=flat-square&logo=git&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-Test_Runner-C21325?style=flat-square&logo=jest&logoColor=white)
![Supertest](https://img.shields.io/badge/Supertest-HTTP_Assertions-green?style=flat-square)
![Flatpickr](https://img.shields.io/badge/Flatpickr-Date_Range_Calendar-ef5350?style=flat-square)

![Prettier](https://img.shields.io/badge/Code_Style-Prettier-F7B93E?style=flat-square&logo=prettier&logoColor=white)

---

## 🏛️ System Architecture

Wanderlust implements the standard **Model-View-Controller (MVC)** design pattern to cleanly separate data structures, business logic, and presentation markup.

```
       HTTP Request
            │
            ▼
     ┌──────────────┐
     │  app.js      │ ─── Express Middleware Pipeline (Sessions, Flash, Passport)
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │  routes/     │ ─── Route Declarations & Middleware (isLoggedIn, isOwner, Joi validators)
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │ controllers/ │ ─── Business Logic (Listing, Review, Booking, Wishlist, User)
     └───┬────────┬─┘
         │        │
         ▼        ▼
┌──────────────┐  ┌──────────────┐
│   models/    │  │   views/     │
│  (Mongoose)  │  │ (EJS + Mate) │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 ▼
 [MongoDB Atlas]    HTML Response
```

### 📂 Directory Structure

```text
wanderlust/
├── controllers/            # Business logic separated from HTTP routes
│   ├── listings.js         # Listing CRUD, search/index, map view, geocoding
│   ├── bookingController.js# Create / list / cancel reservations
│   ├── wishlistController.js
│   ├── reviewController.js # Review creation & deletion (refreshes ratings)
│   └── userController.js   # Authentication workflows
├── init/                   # Database seeding (geocodes if MAPBOX_TOKEN is set)
├── models/
│   ├── listing.js          # GeoJSON geometry, category, rating, text index, Listing.search()
│   ├── booking.js          # Reservation + unique partial index (double-booking guard)
│   ├── review.js
│   └── user.js             # Includes wishlist references
├── public/
│   ├── css/
│   └── js/                 # script.js (validation), map.js (Mapbox), booking.js (calendar)
├── routes/                 # listingRoute, reviewRoute, bookingRoute, wishlistRoute, userRoute
├── tests/
│   ├── unit/               # utils, schema, middleware, models
│   ├── integration/        # auth, listings, reviews, bookings, wishlist, search
│   ├── helpers.js          # in-memory MongoDB + login helpers
│   └── setupEnv.js
├── utils/
│   ├── constants.js        # Categories, property types, limits (single source of truth)
│   ├── dates.js            # UTC day parsing / night enumeration
│   ├── geocode.js          # Mapbox forward geocoding
│   ├── queryString.js      # Filter-preserving links
│   ├── ExpressError.js
│   └── wrapAsync.js
├── views/
│   ├── includes/           # navbar, footer, flash, listingCard, filters, mapbox, bookingRow, listingExtras
│   ├── layouts/
│   ├── listings/           # index, map, show, new, edit
│   ├── bookings/           # index (my trips), hosting
│   ├── wishlist/
│   └── users/
├── .env.example
├── app.js                  # Express app (exported for tests) + server bootstrap
├── cloudConfig.js
├── jest.config.js
├── middleware.js           # Auth, ownership, booking-party and Joi validation middleware
└── schema.js               # Joi schemas: listing, review, booking, search
```

---

## ⚡ Installation & Local Setup

Follow these steps to run Wanderlust on your local workstation.

### Prerequisites

- [Node.js](https://nodejs.org/) (Version `>= 20.19.0` required by Mongoose 9 and the MongoDB driver 7)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- [MongoDB](https://www.mongodb.com/) (Local server or a [MongoDB Atlas](https://www.mongodb.com/atlas) cluster URI)
- [Cloudinary](https://cloudinary.com/) (Free account for media management)
- [Mapbox](https://www.mapbox.com/) (Free account; a public `pk.` token enables maps and geocoding)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/aniprogramer/wanderlust.git
cd wanderlust
```

### Step 2: Install Project Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Create a `.env` file in the project root directory:

```bash
cp .env.example .env
```

Fill in `.env`. `.env.example` lists every variable with a placeholder. For local work you need `ATLAS` (a local MongoDB is fine), `SECRET` and the `CLOUD_*` keys. Without SMTP settings in development, nothing is emailed. Production also needs the SMTP settings, `APP_URL` and `SUPPORT_EMAIL`, and refuses to start without them.

### Step 4: Seed Sample Database Records

Populate your database with initial listings:

```bash
ALLOW_DESTRUCTIVE_SEED=true node init/index.js --yes
```

The seed guard never runs in production. Elsewhere it needs both the variable and `--yes`, and it refuses any database URL containing a value from `PROTECTED_DB_MARKERS`.

The seeder **deletes every existing listing** together with its reviews, bookings and wishlist entries, then creates the sample listings under a `seed-host` user. When `NODE_ENV=production` it refuses to run; pass `--force` (`node init/index.js --force`) only if you really mean to wipe production data.

_Console output:_ `connected to DB` → `data is initialized!`. With `MAPBOX_TOKEN` set, seeded listings are geocoded so they appear on the map.

#### Upgrading an existing database

If your database already has data from an older version, apply the outstanding migrations once after pulling:

```bash
npm run migrate:status   # what has run
npm run migrate          # apply the rest
```

Each migration runs once and is safe to repeat. See `docs/RUNBOOK.md`.

### Step 5: Start the Application Server

```bash
npm start
```

_Console output:_ `Server is listening to port 8080`

Open your web browser and navigate to:

```
http://localhost:8080/listings
```

---

## 🔐 Environment Variables

The full table is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) section 12, and `.env.example` lists every name.

| Variable                                                                                     | Required in production | Purpose                                                              |
| :------------------------------------------------------------------------------------------- | :--------------------: | :------------------------------------------------------------------- |
| `ATLAS`, `SECRET`                                                                            |        **Yes**         | Database, session signing                                            |
| `APP_URL`                                                                                    |        **Yes**         | Links in email, canonical URLs, sitemap                              |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`                                           |        **Yes**         | Email (`SMTP_PORT`, `SMTP_SECURE` optional)                          |
| `SUPPORT_EMAIL`                                                                              |        **Yes**         | Receives contact messages and listing reports                        |
| `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`                                            |        **Yes**         | Photos                                                               |
| `MAPBOX_TOKEN`, `MAPBOX_SERVER_TOKEN`                                                        |           No           | Maps, address lookup                                                 |
| `APP_TIMEZONE`                                                                               |           No           | What "today" means. Default `Asia/Kolkata`                           |
| `LEGAL_ENTITY_NAME`, `LEGAL_ADDRESS`, `GRIEVANCE_OFFICER`, `GOVERNING_LAW`, `LEGAL_REVIEWED` |     Before launch      | Legal pages show placeholders and a draft notice until these are set |
| `SOCIAL_FACEBOOK_URL`, `SOCIAL_INSTAGRAM_URL`, `SOCIAL_LINKEDIN_URL`                         |           No           | Footer icons                                                         |
| `ALLOW_DESTRUCTIVE_SEED`, `PROTECTED_DB_MARKERS`                                             |           No           | Seed script safety                                                   |
| `SENTRY_DSN`                                                                                 |           No           | Error tracking                                                       |
| `NODE_ENV`, `PORT`                                                                           |           No           | Runtime environment, port (default `8080`)                           |

### Health check and operations

`GET /health` returns `{"status":"ok"}` when the database is connected and a 503 otherwise. Deploying, backups, rotating secrets and incidents are in [`docs/RUNBOOK.md`](docs/RUNBOOK.md). The checks against real services are in [`docs/STAGING_CHECKLIST.md`](docs/STAGING_CHECKLIST.md).

---

## 📖 Usage Guide

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐     ┌─────────────┐
│ 1. Sign Up  │ ──► │ 2. Create Stay │ ──► │ 3. Upload    │ ──► │ 4. Review   │
│  or Log In  │     │    Listing     │     │    Images    │     │   & Rate    │
└─────────────┘     └────────────────┘     └──────────────┘     └─────────────┘
```

1. **User Authentication**
   - Click **Sign up** on the navigation bar to register with a unique username, email, and password.
   - Login creates an authenticated session stored securely in MongoDB Atlas.

2. **Explore Accommodations**
   - Browse the homepage to view active property listings worldwide.
   - Click on any listing card to inspect detailed descriptions, pricing per night, host identity, location, and customer reviews.

3. **Publish a Property Listing**
   - Click **Airbnb your home** in the top navigation bar.
   - Fill in property details: Title, Description, Location, Country, and Price.
   - Select an image from your local system — it is automatically streamed to Cloudinary CDN and stored on the listing record.

4. **Edit or Remove a Listing**
   - Navigate to any listing you created.
   - You will see the **Edit** and **Delete** control buttons (hidden for non-owners).
   - Attempting to bypass the UI via direct HTTP calls is rejected by the server-side `isOwner` middleware.

5. **Search & Filter**
   - Use the navbar search or **Filters** on the home page (keywords, country, category, property type, price, rating, availability dates). Click a category icon to filter instantly; **Map view** shows the same results as clustered pins.

6. **Save to Wishlist**
   - Tap the heart on any card; find saved stays under **Wishlist**.

7. **Book a Stay**
   - Pick check-in/check-out on the listing's calendar (greyed dates are taken) and click **Reserve**. Track and cancel trips under **Trips**; hosts manage guests under **Hosting**.

8. **Submit a Review**
   - Any logged-in traveler can submit a rating (1 to 5 stars) and a textual review.
   - Review authors can delete their own reviews at any time.

---

## 🧪 Testing

```bash
npm test                 # run the whole suite
npm run test:coverage    # with coverage report
npm run test:watch       # watch mode
npx playwright test      # browser tests: axe, keyboard, three widths in both themes
```

- **Stack:** Jest, Supertest, and `mongodb-memory-server` (a throw-away in-memory MongoDB; no database setup needed — the first run downloads a `mongod` binary, or set `MONGOMS_SYSTEM_BINARY=/path/to/mongod` to use an installed one).
- **Unit tests** (`tests/unit`): date utilities, Joi schemas, middleware, models, query-string and geocoding helpers.
- **Integration tests** (`tests/integration`): authentication flows, listing CRUD with authorization, reviews and rating aggregation, bookings (validation, overlap and race-condition protection, cancellation permissions), wishlist, search/filters/pagination, CSRF, security headers and rate limiting, upload limits, and the seeder.
- **Mocks:** Cloudinary uploads and the Mapbox geocoder are mocked; no network access or credentials required.
- Tests set `NODE_ENV=test`, which uses an in-memory session store instead of MongoDB and switches off rate limiting (the rate-limit test turns it back on with `ENABLE_RATE_LIMIT=1`).

---

## 🛡️ Security & Engineering Best Practices

- **Authentication via Salted Hashes**: Passwords are never stored in plaintext. `passport-local-mongoose` uses PBKDF2 with unique salts per user record.
- **Strict Authorization Gates**:
  - `isLoggedIn`: Verifies active session token before allowing listing/review creation. Preserves target redirect URL.
  - `isOwner`: Validates `listing.owner.equals(currUser._id)` before allowing mutations.
  - `isReviewAuthor`: Restricts review deletion exclusively to the comment's creator.
- **Session Security**: Session cookies set `httpOnly: true` to prevent Cross-Site Scripting (XSS) credential theft. Expire window set to 7 days with MongoDB-backed persistence via `connect-mongo`.
- **Server-Side Request Validation**: Joi schemas enforce strict data boundaries (valid numeric price, required strings, valid schema structures) before any database invocation occurs.
- **Cascading Data Integrity**: When a listing is removed, Mongoose middleware hooks cleanly delete all orphaned review subdocuments.
- **Double-Booking Prevention**: bookings store one entry per night under a unique partial index, so concurrent requests for the same night cannot both succeed, even across server instances.
- **Safe Asynchronous Flow**: Custom `wrapAsync` wrapper intercepts rejected Promises across controllers, routing failures through the centralized `ExpressError` handler.

---

## 🎯 Engineering Highlights

This project demonstrates core competencies across modern full-stack web engineering:

- **Architectural Separation**: Clean implementation of the MVC pattern decoupling presentation (EJS), routing (Express Router), and persistence (Mongoose).
- **Relational Data Modeling in NoSQL**: Managing document relationships via Mongoose `ref` ObjectIds and cascading middleware hooks.
- **Cloud Asset Pipeline**: Integrating cloud storage SDKs (Cloudinary + Multer) for scalable media asset lifecycle management.
- **RESTful API Principles**: Strict semantic mapping of standard HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`) with Express `method-override`.
- **Defensive Engineering**: Server-side schema validation (Joi) complementing front-end form validation to safeguard database state.

---

## 🗺️ Future Enhancements

- [ ] **Payment Gateway**: Integration with Stripe / Razorpay for direct in-app transactions.
- [ ] **Host Availability Rules**: Blocking dates manually, minimum stays and seasonal pricing.
- [ ] **Guest Count & Capacity**: Per-listing capacity checks and guest counts on bookings.
- [ ] **Email Notifications**: Booking confirmations and cancellations.

---

## 📄 License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).

---

<div align="center">
  <sub>Wanderlust — Full-Stack Accommodation Marketplace</sub>
</div>
