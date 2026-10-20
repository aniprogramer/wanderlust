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

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
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

**Wanderlust** is a production-ready, full-stack web application engineered on the **Model-View-Controller (MVC)** architectural pattern. It delivers an end-to-end marketplace experience where hosts can publish accommodations and travelers can discover destinations with transparent community reviews and ratings.

### 💡 Problem Solved

Traditional starter web apps frequently omit essential production requirements: granular authorization, resilient session storage, centralized validation, and production cloud media pipelines. Wanderlust bridges this gap by demonstrating:

- **Strict role-based authorization** restricting edit/delete capabilities to verified record owners.
- **Cloud-hosted media offloading** (Cloudinary) preventing server filesystem bloat.
- **Persistent session storage** in MongoDB Atlas decoupled from server memory.
- **Standardized RESTful design** paired with atomic server-side (Joi) and client-side data validation.

---

## ✨ Features

| Feature                          | Description                                                                                                                                         |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔐 **Authentication & Sessions** | User registration and authentication powered by Passport.js using salted PBKDF2 hashing. Sessions persist in MongoDB via `connect-mongo`.           |
| 🛡️ **Role-Based Authorization**  | Custom route middleware ensures only the original listing owner can edit/delete listings, and only review authors can delete their reviews.         |
| 🏠 **Full Property CRUD**        | Complete Create, Read, Update, and Delete lifecycle for listings with localized pricing, descriptions, and regional metadata.                       |
| ☁️ **Cloud Media Storage**       | Multi-part image file uploads handled via `multer` and streamed directly to Cloudinary cloud infrastructure with auto-generated URLs.               |
| ⭐ **Review & Rating Engine**    | Community review system linked relationally to listings with numeric ratings and text feedback.                                                     |
| 🗑️ **Cascading Deletion**        | Mongoose `post('findOneAndDelete')` document middleware automatically cascades deletion to remove all associated reviews when a listing is removed. |
| ✅ **Dual-Layer Validation**     | Input validation on both ends: HTML5/Bootstrap client-side validation and schema-based Joi validation on server requests.                           |
| 🔔 **Flash Notifications**       | Instant user feedback banners across page reloads via `connect-flash` for operations like login, logout, create, and unauthorized access.           |
| 📱 **Responsive UI**             | Mobile-first layout constructed with Bootstrap 5 cards, grid system, responsive navigation, and FontAwesome iconography.                            |

---

## 📸 Screenshots

<div align="center">

|                         Explore Destinations (Homepage)                         |                        Property Details & Guest Reviews                        |
| :-----------------------------------------------------------------------------: | :----------------------------------------------------------------------------: |
| <img src="./assets/explore-listings.png" alt="Explore Listings" width="100%" /> | <img src="./assets/listing-details.png" alt="Listing Details" width="100%" />  |
|      _Browse available stays worldwide with responsive cards and pricing_       | _In-depth property view with host details, pricing, location, and review feed_ |

|                        Host a Home (Create Listing)                         |                         Mobile Responsive Layout                         |
| :-------------------------------------------------------------------------: | :----------------------------------------------------------------------: |
| <img src="./assets/create-listing.png" alt="Create Listing" width="100%" /> | <img src="./assets/mobile-view.png" alt="Mobile Layout" width="280px" /> |
|   _Cloudinary multipart upload with schema validation and error feedback_   |   _Fluid responsive viewport optimized for mobile phones and tablets_    |

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

![Node.js](https://img.shields.io/badge/Node.js_v20+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js_4.x-000000?style=flat-square&logo=express&logoColor=white)
![REST API](https://img.shields.io/badge/Architecture-RESTful-orange?style=flat-square)

### Database & Storage

![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose_ODM-880000?style=flat-square&logo=mongoose&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/MongoDB_Atlas-Cloud_DB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_CDN-3448C5?style=flat-square&logo=cloudinary&logoColor=white)

### Security & Utilities

![Passport.js](https://img.shields.io/badge/Passport.js-Local_Strategy-34E27A?style=flat-square&logo=passport&logoColor=white)
![Joi](https://img.shields.io/badge/Joi-Schema_Validation-gray?style=flat-square)
![Express Session](https://img.shields.io/badge/Express_Session-State_Management-blueviolet?style=flat-square)
![Connect Mongo](https://img.shields.io/badge/Connect_Mongo-Session_Store-47A248?style=flat-square)
![Multer](https://img.shields.io/badge/Multer-Multipart_Form_Data-red?style=flat-square)

### Deployment & Tooling

![Render](https://img.shields.io/badge/Render-Web_Service-46E3B7?style=flat-square&logo=render&logoColor=black)
![Git](https://img.shields.io/badge/Git-VCS-F05032?style=flat-square&logo=git&logoColor=white)
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
     │  routes/     │ ─── Route Declarations & Validation Middleware (isLoggedIn, isOwner)
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │ controllers/ │ ─── Core Business Logic (Listing, Review, User controllers)
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
├── controllers/          # Business logic separated from HTTP routes
│   ├── listings.js       # Listing CRUD controller methods
│   ├── reviews.js        # Review creation & deletion logic
│   └── users.js          # Authentication workflows (signup, login, logout)
├── init/                 # Database initialization and mock data
│   ├── data.js           # Sample property dataset
│   └── index.js          # Database seeding script
├── models/               # Mongoose schema definitions
│   ├── listing.js        # Listing schema with cascading review hook
│   ├── review.js         # Review schema referencing author
│   └── user.js           # User schema augmented by passport-local-mongoose
├── public/               # Static client assets
│   ├── css/              # Custom stylesheets
│   └── js/               # Client-side scripts (form validation)
├── routes/               # Express router modules
│   ├── listingRoute.js   # Listing endpoints mapped with controllers
│   ├── reviewRoute.js    # Review endpoints nested by listing ID
│   └── userRoute.js      # Authentication endpoints
├── utils/                # Error handling abstractions
│   ├── ExpressError.js   # Custom HTTP error class with status codes
│   └── wrapAsync.js      # Asynchronous error boundary wrapper
├── views/                # Server-rendered EJS templates
│   ├── includes/         # Partials (navbar, footer, flash alerts)
│   ├── layouts/          # Boilerplate HTML shell via ejs-mate
│   ├── listings/         # Listing views (index, show, new, edit)
│   └── users/            # Authentication forms (login, signup)
├── .env.example          # Sample environment variables reference
├── app.js                # Application entrypoint & server bootstrap
├── cloudConfig.js        # Cloudinary SDK credentials configuration
├── middleware.js         # Route security & request validation middlewares
├── package.json          # Node dependencies and project scripts
└── schema.js             # Joi validation schemas for listings & reviews
```

---

## ⚡ Installation & Local Setup

Follow these steps to run Wanderlust on your local workstation.

### Prerequisites

- [Node.js](https://nodejs.org/) (Version `>= 20.0.0` required)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- [MongoDB](https://www.mongodb.com/) (Local server or a [MongoDB Atlas](https://www.mongodb.com/atlas) cluster URI)
- [Cloudinary](https://cloudinary.com/) (Free account for media management)

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

Populate the `.env` file with your credentials:

```env
PORT=8080
NODE_ENV=development
ATLAS=mongodb+srv://<username>:<password>@cluster0.mongodb.net/wanderlust?retryWrites=true&w=majority
SECRET=your_long_random_session_secret_key
CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret
```

### Step 4: Seed Sample Database Records

Populate your database with initial listings:

```bash
node init/index.js
```

_Console output:_ `connected to DB` → `data is initialized!`

### Step 5: Start the Application Server

```bash
node app.js
```

_Console output:_ `Server is listening to port 8080`

Open your web browser and navigate to:

```
http://localhost:8080/listings
```

---

## 🔐 Environment Variables

| Variable           |  Type  | Required | Description                                                    | Example                                |
| :----------------- | :----: | :------: | :------------------------------------------------------------- | :------------------------------------- |
| `ATLAS`            | String | **Yes**  | MongoDB connection string (Local or MongoDB Atlas)             | `mongodb://127.0.0.1:27017/wanderlust` |
| `SECRET`           | String | **Yes**  | Cryptographic secret for signing session cookies               | `supersecretkey987654`                 |
| `CLOUD_NAME`       | String | **Yes**  | Cloudinary account cloud identifier                            | `dqxyz123`                             |
| `CLOUD_API_KEY`    | String | **Yes**  | Cloudinary public API credential key                           | `123456789012345`                      |
| `CLOUD_API_SECRET` | String | **Yes**  | Cloudinary private secret key                                  | `aBcDeF9876_xYz`                       |
| `NODE_ENV`         | String |    No    | Application runtime environment (`development` / `production`) | `development`                          |
| `PORT`             | Number |    No    | Port on which the HTTP server binds (Default: `8080`)          | `8080`                                 |

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

5. **Submit a Review**
   - Any logged-in traveler can submit a rating (1 to 5 stars) and a textual review.
   - Review authors can delete their own reviews at any time.

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

- [ ] **Interactive Mapbox Integration**: Visual geographic pinpointing and coordinate clustering for listings.
- [ ] **Booking & Availability Calendar**: Reservation system preventing double-booking across selected dates.
- [ ] **Payment Gateway**: Integration with Stripe / Razorpay for direct in-app transactions.
- [ ] **Saved / Wishlist Listings**: Personal bookmark collections for authenticated users.
- [ ] **Search & Category Filters**: Dynamic query filtering by pricing range, country, and stay type (cabins, beachfront, iconic cities).
- [ ] **Automated Test Suite**: Unit and integration test coverage using Jest and Supertest.

---

## 📄 License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).

---

<div align="center">
  <sub>Wanderlust — Full-Stack Accommodation Marketplace</sub>
</div>
