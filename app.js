// Import required modules:
// - express: lightweight web framework for building server-side applications
// - mongoose: ODM (Object Data Modeling) library for MongoDB
// Initialize an Express application instance

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");

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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

app.get("/", (req, res) => {
  res.redirect("/listings");
});

// Index Route
app.get("/listings", async (req, res) => {
  const allListings = await Listing.find({});
  res.render("./listings/index.ejs", { allListings });
});

// Create Route
app.get("/listings/new", (req, res) => {
  res.render("./listings/new.ejs");
});

app.post("/listings", async (req, res) => {
  try {
    let listingData = req.body.listing;

    const newListing = new Listing(listingData);
    await newListing.save();

    res.redirect("/listings");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error saving listing");
  }
});

// Show Route
app.get("/listings/:id", async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  res.render("./listings/show", { listing });
});

// Edit and Update Routes
app.get("/listings/:id/edit", async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id);
  res.render("./listings/edit.ejs", { listing });
});

app.put("/listings/:id", async (req, res) => {
  const { id } = req.params;

  await Listing.findByIdAndUpdate(id, req.body.listing, {
    runValidators: true,
  });

  res.redirect(`/listings/${id}`);
});

//Delete Route
app.delete("/listings/:id", async (req, res) => {
  let { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send("Invalid listing ID");
  }

  await Listing.findByIdAndDelete(id);

  res.redirect("/listings");
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
