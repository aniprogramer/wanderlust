(() => {
  const el = document.getElementById("map");
  if (!el || !window.mapboxgl) return;

  mapboxgl.accessToken = el.dataset.token;
  const { mode } = el.dataset;
  const brand = "#fe424d";
  const map = new mapboxgl.Map({
    container: el,
    style: "mapbox://styles/mapbox/streets-v12",
    center: [78, 22],
    zoom: 1.5,
  });
  map.addControl(new mapboxgl.NavigationControl(), "top-right");

  // ---- Listing page: single marker ----
  if (mode === "show") {
    const center = [Number(el.dataset.lng), Number(el.dataset.lat)];
    map.setCenter(center).setZoom(11);
    new mapboxgl.Marker({ color: brand })
      .setLngLat(center)
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(el.dataset.title))
      .addTo(map);
  }

  // ---- Create / edit form: click or drag to pick, search from the typed address ----
  if (mode === "picker") {
    const lat = document.getElementById("lat");
    const lng = document.getElementById("lng");
    const status = document.getElementById("map-status");
    const marker = new mapboxgl.Marker({ color: brand, draggable: true });

    const place = (lngLat, fly = false) => {
      marker.setLngLat(lngLat).addTo(map);
      lng.value = lngLat.lng ?? lngLat[0];
      lat.value = lngLat.lat ?? lngLat[1];
      if (fly) map.flyTo({ center: lngLat, zoom: 10 });
      status.textContent = "Location set. Drag the pin to fine-tune.";
    };

    if (lat.value && lng.value) {
      place([Number(lng.value), Number(lat.value)], true);
    }
    map.on("click", (e) => place(e.lngLat));
    marker.on("dragend", () => place(marker.getLngLat()));

    const search = async () => {
      const q = [locationInput.value, countryInput.value]
        .filter(Boolean)
        .join(", ");
      if (!locationInput.value || !countryInput.value) return;
      try {
        const res = await fetch(`/listings/geocode?q=${encodeURIComponent(q)}`);
        const { coordinates } = await res.json();
        if (coordinates) place(coordinates, true);
        else
          status.textContent =
            "Couldn't find that place. Click the map to set it manually.";
      } catch {
        status.textContent =
          "Search unavailable. Click the map to set the location.";
      }
    };
    const locationInput = document.getElementById("location");
    const countryInput = document.getElementById("country");
    // Typing invalidates the old pin so a stale point is never submitted with a new address.
    const clearPin = () => {
      lat.value = lng.value = "";
      marker.remove();
    };
    for (const input of [locationInput, countryInput]) {
      input.addEventListener("input", clearPin);
      input.addEventListener("change", search);
    }
  }

  // ---- Map view: clustered listings ----
  if (mode === "cluster") {
    const data = JSON.parse(document.getElementById("map-data").textContent);
    map.on("load", () => {
      map.addSource("listings", {
        type: "geojson",
        data,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "listings",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": brand,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30],
          "circle-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "listings",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 13,
        },
        paint: { "text-color": "#fff" },
      });
      map.addLayer({
        id: "point",
        type: "circle",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": brand,
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      if (data.features.length) {
        const bounds = new mapboxgl.LngLatBounds();
        data.features.forEach((f) => bounds.extend(f.geometry.coordinates));
        map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 0 });
      }

      map.on("click", "clusters", async (e) => {
        const [feature] = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        const zoom = await map
          .getSource("listings")
          .getClusterExpansionZoom(feature.properties.cluster_id);
        map.easeTo({ center: feature.geometry.coordinates, zoom });
      });

      map.on("click", "point", (e) => {
        const { id, title, price, currency, image } = e.features[0].properties;
        // Built with DOM nodes (not HTML strings) so listing text can't inject markup
        const link = document.createElement("a");
        link.href = `/listings/${id}`;
        link.className = "text-decoration-none text-dark";
        const img = document.createElement("img");
        img.src = image;
        img.alt = "";
        img.className = "map-popup-img";
        const name = document.createElement("strong");
        name.textContent = title;
        const cost = document.createElement("div");
        cost.textContent = `${new Intl.NumberFormat(
          currency === "INR" ? "en-IN" : "en-US",
          {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          },
        ).format(price)} / night`;
        link.append(img, name, cost);
        new mapboxgl.Popup({ offset: 12 })
          .setLngLat(e.features[0].geometry.coordinates)
          .setDOMContent(link)
          .addTo(map);
      });

      for (const layer of ["clusters", "point"]) {
        map.on(
          "mouseenter",
          layer,
          () => (map.getCanvas().style.cursor = "pointer"),
        );
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
    });
  }
})();
