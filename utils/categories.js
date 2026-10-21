// UI visual categories with photo thumbnails matching the reference design
const UI_CATEGORIES = [
  {
    id: "all",
    label: "All",
    categoryParam: "",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=160&h=110&q=80",
  },
  {
    id: "beach",
    label: "Beach",
    categoryParam: "Beachfront",
    image:
      "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=160&h=110&q=80",
  },
  {
    id: "mountains",
    label: "Mountains",
    categoryParam: "Mountains",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=160&h=110&q=80",
  },
  {
    id: "cabins",
    label: "Cabins",
    categoryParam: "Cabins",
    image:
      "https://images.unsplash.com/photo-1587381420270-3e1a5b9e6904?auto=format&fit=crop&w=160&h=110&q=80",
  },
  {
    id: "cities",
    label: "Cities",
    categoryParam: "Cities",
    image:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=160&h=110&q=80",
  },
  {
    id: "countryside",
    label: "Countryside",
    categoryParam: "Countryside",
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=160&h=110&q=80",
  },
  {
    id: "luxe",
    label: "Luxe",
    categoryParam: "Luxury",
    image:
      "https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?auto=format&fit=crop&w=160&h=110&q=80",
  },
  {
    id: "tinyhomes",
    label: "Tiny Homes",
    categoryParam: "Tiny Homes",
    image:
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=160&h=110&q=80",
  },
  {
    id: "views",
    label: "Amazing Views",
    categoryParam: "Trending",
    image:
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=160&h=110&q=80",
  },
  {
    id: "lakefront",
    label: "Lakefront",
    categoryParam: "Unique Stays",
    image:
      "https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=160&h=110&q=80",
  },
];

const CATEGORY_MAP = {
  // Canonical names (matching constants.js CATEGORIES)
  trending: "Trending",
  beachfront: "Beachfront",
  mountains: "Mountains",
  cabins: "Cabins",
  cities: "Cities",
  countryside: "Countryside",
  luxury: "Luxury",
  budget: "Budget",
  "tiny homes": "Tiny Homes",
  "unique stays": "Unique Stays",

  // Slugs, variations, and UI aliases
  beach: "Beachfront",
  mountain: "Mountains",
  cabin: "Cabins",
  city: "Cities",
  luxe: "Luxury",
  "tiny-homes": "Tiny Homes",
  tinyhome: "Tiny Homes",
  "tiny-home": "Tiny Homes",
  "unique-stays": "Unique Stays",
  uniquestays: "Unique Stays",
  "amazing views": "Trending",
  "amazing-views": "Trending",
  lakefront: "Unique Stays",
};

const normalizeCategory = (input) => {
  if (!input || typeof input !== "string") return null;
  const key = input.trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
  return CATEGORY_MAP[key] || CATEGORY_MAP[input.trim().toLowerCase()] || null;
};

module.exports = { UI_CATEGORIES, CATEGORY_MAP, normalizeCategory };
