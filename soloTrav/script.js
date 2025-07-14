/* --------------------------------------------------
   GLOBALS
-------------------------------------------------- */
let map;
let userMarker;
let geofenceCircle;
let geofenceCenter = null;
let geofenceRadius = 500;
const placeMarkers = []; // store POI markers so we can clear them

/* --------------------------------------------------
   INITIAL MAP + GEOLOCATION
-------------------------------------------------- */
function initMap(lat, lng) {
  map = L.map("map").setView([lat, lng], 15);

  // Basemap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // User marker
  userMarker = L.marker([lat, lng]).addTo(map)
    .bindPopup("You are here")
    .openPopup();

  // Click to set/move geofence center
  map.on("click", (e) => {
    geofenceCenter = e.latlng;
    drawGeofence();
    document.getElementById("status").textContent =
      "Geofence center set. We’ll warn you if you exit.";
  });
}

/* --------------------------------------------------
   GEOFENCE UTILS
-------------------------------------------------- */
function drawGeofence() {
  if (!geofenceCenter) return;

  if (geofenceCircle) map.removeLayer(geofenceCircle);

  geofenceCircle = L.circle(geofenceCenter, {
    radius: geofenceRadius,
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.15,
  }).addTo(map);
}

function setGeofence() {
  const val = parseInt(document.getElementById("radiusInput").value, 10);
  if (!isNaN(val) && val > 0) geofenceRadius = val;
  drawGeofence();
}

function checkGeofence(lat, lng) {
  if (!geofenceCenter) return;

  const dist = map.distance(geofenceCenter, L.latLng(lat, lng));
  const statusEl = document.getElementById("status");

  if (dist > geofenceRadius) {
    statusEl.textContent = `⚠️ Outside geofence (${Math.round(dist)} m)`;
    statusEl.style.color = "red";
  } else {
    statusEl.textContent = `✅ Inside geofence (${Math.round(dist)} m)`;
    statusEl.style.color = "green";
  }
}

/* --------------------------------------------------
   POSITION UPDATES
-------------------------------------------------- */
function updatePosition(pos) {
  const { latitude: lat, longitude: lng } = pos.coords;
  userMarker.setLatLng([lat, lng]);
  map.panTo([lat, lng]);
  checkGeofence(lat, lng);
}

/* --------------------------------------------------
   NEARBY POLICE / HOSPITAL (Overpass API)
-------------------------------------------------- */
function findNearby(type) {
  if (!userMarker) return alert("Location not ready yet.");

  // clear old markers
  placeMarkers.forEach((m) => map.removeLayer(m));
  placeMarkers.length = 0;

  const { lat, lng } = userMarker.getLatLng();
  const radius = 3000; // meters

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="${type}"](around:${radius},${lat},${lng});
      way["amenity"="${type}"](around:${radius},${lat},${lng});
      relation["amenity"="${type}"](around:${radius},${lat},${lng});
    );
    out center;
  `;

  fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
    .then((r) => r.json())
    .then((data) => {
      if (!data.elements.length) {
        alert(`No nearby ${type}s found within 3 km.`);
        return;
      }

      data.elements.forEach((el) => {
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (!lat || !lon) return;

        const name =
          el.tags?.name ||
          (type === "hospital" ? "Hospital" : "Police Station");

        // Font Awesome icon markup
        const htmlIcon =
          type === "hospital"
            ? '<i class="fa-solid fa-house-chimney-medical" style="font-size:28px;color:#d32f2f;"></i>'
            : '<i class="fa-solid fa-siren-on" style="font-size:28px;color:#1565c0;"></i>';

        const divIcon = L.divIcon({
          html: htmlIcon,
          className: "fa-marker",
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -24],
        });

        const marker = L.marker([lat, lon], { icon: divIcon })
          .addTo(map)
          .bindPopup(name);

        placeMarkers.push(marker);
      });
    })
    .catch((err) => {
      console.error(err);
      alert("Couldn’t load nearby places – try again later.");
    });
}

/* --------------------------------------------------
   GEOLOCATION INIT
-------------------------------------------------- */
navigator.geolocation.getCurrentPosition(
  (pos) => {
    const { latitude, longitude } = pos.coords;
    initMap(latitude, longitude);

    navigator.geolocation.watchPosition(updatePosition, console.error, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 7000,
    });
  },
  () => alert("⚠️ Location access denied — app can’t work without it.")
);
