# 🌍 Wanderlust

**🚀 Live Demo:** [https://ani-wanderlust.onrender.com](https://ani-wanderlust.onrender.com)

![Wanderlust Overview](https://img.shields.io/badge/Project-Wanderlust-blue?style=for-the-badge&logo=airbnb)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-563D7C?style=for-the-badge&logo=bootstrap&logoColor=white)

---

## 📖 What this project does

**Wanderlust** is a full-stack property listing web application (inspired by Airbnb) where users can explore available properties, view detailed information, read and post reviews, and even create their own listings.

The platform includes:

- 🔐 **Secure user authentication** & authorization
- 🕒 **Session management**
- ☁️ **Cloud-based image uploading** for property photos
- ✏️ **Full CRUD operations** for listings and reviews

---

## 🎯 Why it exists

This project was built as the **Major Project** for the _ApnaCollege web development curriculum_. It serves to showcase practical, hands-on learning of:

- Backend web architecture
- **MVC (Model-View-Controller)** design patterns
- RESTful API conventions
- Database management using MongoDB
- Security practices like password hashing and route authorization

---

## 🚀 How to run it

### 1. Clone the repository

Open your terminal and run the following command to clone the repository to your local machine:

```bash
git clone https://github.com/your-username/apnacollege---major-project.git
cd apnacollege---major-project
```

_(Note: Please replace the URL with your actual GitHub repository URL if it differs.)_

### 2. Install dependencies

Ensure you have [Node.js](https://nodejs.org/) installed, then run from the root directory:

```bash
npm install
```

### 3. Set up Environment Variables

Create a `.env` file in the root directory and configure the following credentials:

```env
NODE_ENV=development
SECRET=your_session_secret_string
CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret
```

### 4. Start the Server

```bash
node app.js
```

_The server will log `Server is listening to port 8080`. Open your browser and go to [http://localhost:8080/listings](http://localhost:8080/listings)._

---

## 🛠️ What tech it uses

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (using Mongoose ODM) with `connect-mongo` for session storage
- **Authentication:** Passport.js (`passport-local`, `passport-local-mongoose`)
- **Templating Engine:** EJS (Embedded JavaScript) with `ejs-mate` for standardized page layouts
- **Image Storage:** Cloudinary (integrated via `cloudinary` and `multer`)
- **Data Validation:** Joi schema validation
- **Styling/UI:** CSS/Bootstrap (served statically from the `public` directory) and Flash messages (`connect-flash`) for user alerts.

---

## 📂 How it’s structured

The project strictly follows the **MVC (Model-View-Controller)** architecture. Here is a high-level overview of the directory structure:

```text
📦 apna-college-major-project
 ┣ 📂 controllers       # Core logic handling requests and DB operations
 ┣ 📂 init              # Scripts and dummy data to seed the database
 ┣ 📂 models            # Mongoose schemas (Listing, User, Review)
 ┣ 📂 public            # Static assets (CSS, JS, Images)
 ┣ 📂 routes            # Express routers (Listings, Reviews, Users)
 ┣ 📂 utils             # Helper functions (Error Wrappers, Custom Errors)
 ┣ 📂 views             # EJS templates for UI rendering
 ┃ ┣ 📂 includes        # Reusable view partials (navbar, footer, flash)
 ┃ ┣ 📂 layouts         # Boilerplate HTML layouts (ejs-mate)
 ┃ ┣ 📂 listings        # Listing specific views (index, show, new, edit)
 ┃ ┗ 📂 users           # Authentication views (login, signup)
 ┣ 📜 .env              # Environment variables
 ┣ 📜 app.js            # Main entry point and server configuration
 ┣ 📜 cloudConfig.js    # Cloudinary integration configuration
 ┣ 📜 middleware.js     # Custom Express middlewares (Auth & Validation)
 ┗ 📜 schema.js         # Server-side Joi validation schemas
```

---

<div align="center">
  <i>Developed with ❤️ for the ApnaCollege Web-Dev Bootcamp.</i>
</div>
