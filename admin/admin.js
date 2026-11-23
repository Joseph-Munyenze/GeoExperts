/* Land listings manager: talks to server.js (/api/admin/*). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var TOKEN_KEY = "gx_admin_token";
  var token = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) {}
  var master = { features: [] };
  var pending = null; // {fileName, featureCollection, result}

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtPrice(n) { return n == null ? "On request" : "KES " + Number(n).toLocaleString("en-KE"); }
  function fmtAcres(a) { return a == null ? "–" : (+a).toLocaleString("en-KE", { maximumFractionDigits: 3 }) + " ac"; }
  function msg(el, text, kind) { el.textContent = text || ""; el.className = "note msgline" + (kind ? " " + kind : ""); }
  function show(id, on) { $(id).hidden = !on; }

  // ---------- API ----------
  function api(method, path, body) {
    var opts = { method: method, headers: {} };
    if (token) opts.headers.Authorization = "Bearer " + token;
    if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch("../api/admin/" + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401 && path !== "login") { signOutLocal(); throw new Error(data.error || "Please sign in again."); }
        if (!r.ok) { var e = new Error(data.error || "Request failed (" + r.status + ")"); e.data = data; throw e; }
        return data;
      });
    });
  }

  // ---------- sign in ----------
  function signOutLocal() {
    token = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
    show("appView", false); show("signOut", false); show("loginView", true);
  }
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    msg($("loginMsg"), "Signing in…");
    api("POST", "login", { password: $("pw").value }).then(function (d) {
      token = d.token;
      try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e2) {}
      $("pw").value = ""; msg($("loginMsg"), "");
      startApp();
    }).catch(function (err) {
      if (err instanceof TypeError) { show("loginView", false); show("noServer", true); return; }
      msg($("loginMsg"), err.message, "err");
    });
  });
  $("signOut").addEventListener("click", function (e) {
    e.preventDefault();
    api("POST", "logout").catch(function () {}).then(signOutLocal);
  });

  // ---------- map ----------
  var map = null, currentLayer = null, previewLayer = null;
  function initMap() {
    if (map || !window.L) return;
    map = L.map("adminMap").setView([-1.29, 36.82], 7);
    var esri = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, maxNativeZoom: 18, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics" });
    var s2 = L.tileLayer("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg", { maxZoom: 19, maxNativeZoom: 15, attribution: '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by EOX (Copernicus Sentinel data 2016)' });
    var osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" });
    esri.addTo(map);
    L.control.layers({ "High-resolution imagery (Esri)": esri, "Sentinel-2 cloudless (open)": s2, "Street map": osm }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
  }
  function layerFor(features, styleFn, label) {
    return L.geoJSON({ type: "FeatureCollection", features: features }, {
      style: styleFn,
      pointToLayer: function (f, ll) { return L.circleMarker(ll, Object.assign({ radius: 8 }, styleFn(f))); },
      onEachFeature: function (f, l) {
        var p = f.properties;
        l.bindTooltip(esc(p.name) + (label ? " (" + label + ")" : ""), { sticky: true });
        l.bindPopup("<b>" + esc(p.name) + "</b><br>" + esc(p.land_use) + " · " + fmtAcres(p.size_acres) + "<br>" + fmtPrice(p.price_kes) + "<br>Status: " + esc(p.status));
      }
    });
  }
  function styleCurrent(f) {
    var off = !ParcelSchema.isPublic(f);
    return { color: off ? "#5d667b" : "#b38f00", fillColor: off ? "#9aa3b8" : "#ffd54a", weight: 2, fillOpacity: off ? 0.25 : 0.3 };
  }
  function stylePreview() { return { color: "#0277bd", fillColor: "#4fc3f7", weight: 2, dashArray: "6 4", fillOpacity: 0.3 }; }
  function drawCurrent(fit) {
    if (!map) return;
    if (currentLayer) map.removeLayer(currentLayer);
    currentLayer = layerFor(master.features, styleCurrent).addTo(map);
    if (fit && master.features.length) map.fitBounds(currentLayer.getBounds().pad(0.1), { maxZoom: 17 });
  }
  function drawPreview(features) {
    if (!map) return;
    if (previewLayer) { map.removeLayer(previewLayer); previewLayer = null; }
    if (!features || !features.length) return;
    previewLayer = layerFor(features, stylePreview, "preview").addTo(map);
    map.fitBounds(previewLayer.getBounds().pad(0.1), { maxZoom: 17 });
  }

  // ---------- current listings ----------
  function loadListings(fit) {
    return api("GET", "listings").then(function (gj) {
      master = gj; if (!master.features) master.features = [];
      renderCurrent(); drawCurrent(fit);
    });
  }
  function renderCurrent() {
    var f = master.features;
    $("stTotal").textContent = f.length;
    $("stPublic").textContent = f.filter(ParcelSchema.isPublic).length;
    $("stUpdated").textContent = master.updated ? new Date(master.updated).toLocaleString() : "–";
    $("currentRows").innerHTML = f.length ? f.map(function (x) {
      var p = x.properties, id = esc(x.id);
      return '<tr class="' + (ParcelSchema.isPublic(x) ? "" : "is-hidden") + '"><td><b>' + esc(p.name) + '</b><br><span class="note">' + id + '</span></td><td>' + esc(p.land_use) + '</td><td>' + fmtAcres(p.size_acres) + '</td>' +
        '<td><input type="text" inputmode="decimal" value="' + (p.price_kes == null ? "" : p.price_kes) + '" placeholder="On request" data-price="' + id + '" aria-label="Price for ' + esc(p.name) + '"></td>' +
        '<td><select data-status="' + id + '" aria-label="Status for ' + esc(p.name) + '">' + ParcelSchema.STATUSES.map(function (s) { return '<option value="' + s + '"' + (s === p.status ? " selected" : "") + ">" + s.charAt(0).toUpperCase() + s.slice(1) + "</option>"; }).join("") + '</select></td>' +
        '<td><div class="acts"><button class="btn alt" type="button" data-zoom="' + id + '">Zoom</button><button class="btn danger" type="button" data-del="' + id + '">Delete</button></div></td></tr>';
    }).join("") : '<tr><td colspan="6">No listings yet. Upload a GeoJSON or KML file above.</td></tr>';
  }
  function findFeature(id) { return master.features.filter(function (f) { return f.id === id; })[0]; }
  $("currentRows").addEventListener("change", function (e) {
    var s = e.target.getAttribute("data-status"), pr = e.target.getAttribute("data-price");
    if (s) {
      api("PATCH", "listings/" + encodeURIComponent(s), { status: e.target.value }).then(function () {
        msg($("currentMsg"), "Status saved and published.", "ok"); return loadListings(false);
      }).catch(function (err) { msg($("currentMsg"), err.message, "err"); });
    }
    if (pr) {
      api("PATCH", "listings/" + encodeURIComponent(pr), { price_kes: e.target.value.trim() }).then(function () {
        msg($("currentMsg"), "Price saved and published.", "ok"); return loadListings(false);
      }).catch(function (err) { msg($("currentMsg"), err.message, "err"); });
    }
  });
  $("currentRows").addEventListener("click", function (e) {
    var z = e.target.closest("[data-zoom]"), d = e.target.closest("[data-del]");
    if (z && map) {
      var f = findFeature(z.getAttribute("data-zoom"));
      if (f) { var l = L.geoJSON(f); map.fitBounds(l.getBounds().pad(0.3), { maxZoom: 18 }); }
    }
    if (d) {
      var feat = findFeature(d.getAttribute("data-del"));
      if (!feat || !confirm("Delete \"" + feat.properties.name + "\" from the website? A backup is saved first.")) return;
      api("DELETE", "listings/" + encodeURIComponent(feat.id)).then(function (r) {
        msg($("currentMsg"), "Deleted \"" + r.deleted + "\".", "ok"); loadListings(false); loadBackups();
      }).catch(function (err) { msg($("currentMsg"), err.message, "err"); });
    }
  });
  $("downloadBtn").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify({ type: "FeatureCollection", features: master.features }, null, 2)], { type: "application/geo+json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "geoexpert-land-listings-" + new Date().toISOString().slice(0, 10) + ".geojson";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  });

  // ---------- KML -> GeoJSON ----------
  function kids(el, name) { return Array.prototype.filter.call(el.children, function (c) { return c.localName === name; }); }
  function all(el, name) { return Array.prototype.slice.call(el.getElementsByTagNameNS("*", name)); }
  function text(el) { return el ? el.textContent.trim() : ""; }
  function coords(el) {
    return text(el).split(/\s+/).filter(Boolean).map(function (t) { var p = t.split(","); return [parseFloat(p[0]), parseFloat(p[1])]; });
  }
  function kmlToGeoJSON(src) {
    var doc = new DOMParser().parseFromString(src, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("This KML file could not be read (it is not valid XML).");
    var features = all(doc, "Placemark").map(function (pm) {
      var props = {};
      var nm = kids(pm, "name")[0], ds = kids(pm, "description")[0];
      if (nm) props.name = text(nm);
      if (ds) props.description = text(ds);
      all(pm, "Data").forEach(function (d) { props[d.getAttribute("name")] = text(kids(d, "value")[0]); });
      all(pm, "SimpleData").forEach(function (d) { props[d.getAttribute("name")] = text(d); });
      var polys = all(pm, "Polygon").map(function (pg) {
        var outer = all(pg, "outerBoundaryIs")[0], rings = [];
        if (outer) rings.push(coords(all(outer, "coordinates")[0]));
        all(pg, "innerBoundaryIs").forEach(function (ib) { rings.push(coords(all(ib, "coordinates")[0])); });
        return rings;
      });
      var geom = null;
      if (polys.length > 1) geom = { type: "MultiPolygon", coordinates: polys };
      else if (polys.length === 1) geom = { type: "Polygon", coordinates: polys[0] };
      else {
        var pt = all(pm, "Point")[0];
        if (pt) geom = { type: "Point", coordinates: coords(all(pt, "coordinates")[0])[0] };
        else if (all(pm, "LineString").length) geom = { type: "LineString", coordinates: [] };
      }
      return { type: "Feature", properties: props, geometry: geom };
    });
    return { type: "FeatureCollection", features: features };
  }

  // ---------- upload + preview ----------
  $("file").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { alert("The file is larger than 15 MB."); this.value = ""; return; }
    var ext = (f.name.split(".").pop() || "").toLowerCase();
    if (ext === "kmz") { alert("KMZ is a zipped KML. Unzip it (rename to .zip and extract doc.kml) or re-save as KML, then upload the .kml file."); this.value = ""; return; }
    f.text().then(function (src) {
      var fc;
      try { fc = ext === "kml" ? kmlToGeoJSON(src) : JSON.parse(src); }
      catch (e) { throw new Error(ext === "kml" ? e.message : "This file is not valid GeoJSON: " + e.message); }
      var result = ParcelSchema.normaliseCollection(fc);
      pending = { fileName: f.name, featureCollection: fc, result: result };
      renderPreview();
    }).catch(function (e) {
      pending = null; show("previewView", true);
      $("previewSummary").textContent = f.name;
      $("previewErrors").innerHTML = '<div class="box err"><b>Could not read the file.</b><ul><li>' + esc(e.message) + "</li></ul></div>";
      $("previewWarnings").innerHTML = ""; $("previewRows").innerHTML = ""; show("skipWrap", false);
      $("publishBtn").disabled = true; drawPreview(null);
    });
  });
  function listBox(kind, title, items) {
    if (!items.length) return "";
    var shown = items.slice(0, 30).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
    return '<div class="box ' + kind + '"><b>' + title + "</b><ul>" + shown + (items.length > 30 ? "<li>…and " + (items.length - 30) + " more</li>" : "") + "</ul></div>";
  }
  function mode() { return document.querySelector('input[name="mode"]:checked').value; }
  function renderPreview() {
    var r = pending.result, n = r.features.length;
    show("previewView", true); msg($("publishMsg"), "");
    var existing = {}; master.features.forEach(function (f) { existing[f.id] = true; });
    var updates = r.features.filter(function (f) { return existing[f.id]; }).length;
    $("previewSummary").innerHTML = "<b>" + esc(pending.fileName) + "</b>: " + n + " valid parcel" + (n === 1 ? "" : "s") +
      (r.errors.length ? ", " + r.errors.length + " with problems" : "") + ". " +
      (mode() === "replace" ? "<b>Replace all</b>: the website will show only these listings (" + master.features.length + " current listing(s) will be removed; a backup is kept)." :
        "<b>Add or update</b>: " + (n - updates) + " new, " + updates + " updating existing listings with the same id.");
    $("previewErrors").innerHTML = listBox("err", "Problems (these features cannot be published):", r.errors);
    $("previewWarnings").innerHTML = listBox("warn", "Notes:", r.warnings);
    $("previewRows").innerHTML = r.features.map(function (f) {
      var p = f.properties;
      return "<tr><td><b>" + esc(p.name) + '</b><br><span class="note">' + esc(f.id) + "</span></td><td>" + esc(p.land_use) + "</td><td>" + fmtAcres(p.size_acres) + (p.size_computed ? '<br><span class="note">from boundary</span>' : "") +
        "</td><td>" + fmtPrice(p.price_kes) + "</td><td>" + esc(p.tenure || "–") + "</td><td>" + esc(p.status) + "</td><td>" + f.geometry.type + "</td></tr>";
    }).join("") || '<tr><td colspan="7">No valid parcels in this file.</td></tr>';
    show("skipWrap", r.errors.length > 0 && n > 0); $("skipInvalid").checked = false;
    $("publishBtn").disabled = n === 0;
    drawPreview(r.features);
  }
  document.querySelectorAll('input[name="mode"]').forEach(function (r) { r.addEventListener("change", function () { if (pending) renderPreview(); }); });
  function clearPreview() {
    pending = null; $("file").value = ""; show("previewView", false); drawPreview(null);
  }
  $("cancelBtn").addEventListener("click", clearPreview);
  $("publishBtn").addEventListener("click", function () {
    if (!pending) return;
    var r = pending.result;
    if (r.errors.length && !$("skipInvalid").checked) { msg($("publishMsg"), "Some features have problems. Fix the file, or tick the box to skip them.", "err"); return; }
    if (mode() === "replace" && !confirm("Replace ALL current listings with the " + r.features.length + " in this file?")) return;
    var btn = $("publishBtn"); btn.disabled = true; msg($("publishMsg"), "Publishing…");
    api("POST", "upload", { mode: mode(), fileName: pending.fileName, skipInvalid: $("skipInvalid").checked, featureCollection: pending.featureCollection })
      .then(function (d) {
        var text = "Published " + d.published + " parcel(s). The website now has " + d.total + " listing(s) in total.";
        clearPreview(); msg($("currentMsg"), text, "ok");
        loadListings(true); loadBackups();
        $("currentMsg").scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(function (err) {
        var extra = err.data && err.data.errors ? " " + err.data.errors.slice(0, 3).join("; ") : "";
        msg($("publishMsg"), err.message + extra, "err"); btn.disabled = false;
      });
  });

  // ---------- backups ----------
  function loadBackups() {
    return api("GET", "backups").then(function (d) {
      $("backupSel").innerHTML = d.backups.length ? d.backups.map(function (b) {
        return '<option value="' + esc(b.name) + '">' + new Date(b.time).toLocaleString() + " · " + (b.count == null ? "?" : b.count) + " listing(s) · " + esc(b.name.replace(/^listings-\d{4}-\d{2}-\d{2}T[\d-]+Z-/, "").replace(/\.geojson$/, "")) + "</option>";
      }).join("") : "<option value=''>No backups yet</option>";
      $("restoreBtn").disabled = !d.backups.length;
    }).catch(function () {});
  }
  $("restoreBtn").addEventListener("click", function () {
    var name = $("backupSel").value;
    if (!name || !confirm("Restore this backup? The current listings are backed up first.")) return;
    api("POST", "restore", { name: name }).then(function (d) {
      msg($("backupMsg"), "Restored: the website now has " + d.total + " listing(s).", "ok");
      loadListings(true); loadBackups();
    }).catch(function (err) { msg($("backupMsg"), err.message, "err"); });
  });

  // ---------- field guide ----------
  var NOTES = {
    id: "Optional. Keep the same id to update a listing later; new ids are created if missing.",
    name: "Shown as the listing title, e.g. \"Plot 214\". Required (a default is used if missing).",
    location: "Town or area. If missing, the text before the first comma in the name is used.",
    land_use: "e.g. Residential, Commercial, Agricultural. Builds the website's Land use filter.",
    size_acres: "Number in acres. If missing on a polygon, it is calculated from the boundary.",
    size_ha: "Hectares, converted to acres (used only if there is no acres field).",
    price_kes: "Number in KES. 2800000, \"KES 2,800,000\" and \"2.8M\" all work. Blank = Price on request.",
    tenure: "e.g. Freehold, Leasehold 99 yrs.",
    description: "Short notes such as access, water and power. HTML is removed.",
    status: "available (default), under offer, sold or hidden. Sold and hidden are not shown on the website."
  };
  $("guideRows").innerHTML = Object.keys(ParcelSchema.ALIASES).map(function (k) {
    return "<tr><td><code>" + k + "</code></td><td>" + ParcelSchema.ALIASES[k].map(esc).join(", ") + "</td><td>" + esc(NOTES[k] || "") + "</td></tr>";
  }).join("") + '<tr><td><b>Geometry</b></td><td>Polygon, MultiPolygon or Point</td><td>WGS 84 longitude/latitude (EPSG:4326). Lines are rejected. Projected coordinates (e.g. UTM 37S) must be reprojected first.</td></tr>';

  // ---------- start ----------
  function startApp() {
    show("loginView", false); show("noServer", false); show("appView", true); show("signOut", true);
    initMap();
    setTimeout(function () { if (map) map.invalidateSize(); }, 100);
    loadListings(true).catch(function (e) { msg($("currentMsg"), e.message, "err"); });
    loadBackups();
  }
  if (location.protocol === "file:") { show("noServer", true); }
  else if (token) startApp();
  else show("loginView", true);
})();
