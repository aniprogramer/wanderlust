// Import required modules:
// - express: lightweight web framework for building server-side applications
// - mongoose: ODM (Object Data Modeling) library for MongoDB
// Initialize an Express application instance

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing");

// Connection string for MongoDB, pointing to the local server (127.0.0.1) on port 27017,
// and using the "wanderlust" database.

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

// Asynchronous function to establish a connection to MongoDB using Mongoose.
// Ensures the app waits until the database connection is successfully opened before proceeding.
async function main() {
  await mongoose.connect(MONGO_URL);
}

// Execute the main() function to connect to MongoDB.
// If the connection succeeds, log "connected to DB".
// If it fails, catch the error and log it for debugging.
main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

app.get("/", (req, res) => {
  res.send("Hi, I am root");
});

// app.get("/testListing", async (req, res) => {
//   let sampleListing = new Listing({
//     title: "My new Villa",
//     description: "By the beach",
//     price: 1200,
//     location: "Tulum, Quintana Roo",
//     country: "Mexico",
//   });

//   await sampleListing.save();
//   console.log("sample was saved");
//   res.send("successful testing");
// });

app.listen(8080, () => {
  console.log("Server is listening to port 8080");
});
