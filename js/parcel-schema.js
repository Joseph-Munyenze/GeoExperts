/*
 * Parcel schema: shared by the public site, the admin page and the server.
 * Turns any uploaded GeoJSON FeatureCollection into clean land-listing features.
 *
 * Standard feature properties written to data/parcels.geojson:
 *   id, name, location, land_use, size_acres, price_kes, tenure, description, status
 *
 * Accepted alternative column names (case-insensitive) are listed in ALIASES below,
 * so files exported from QGIS, ArcGIS or Google Earth work without renaming fields.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ParcelSchema = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ALIASES = {
    id: ["id", "parcel_id", "listing_id", "fid"],
    name: ["name", "title", "parcel_name", "plot_name", "parcel", "plot"],
    location: ["location", "town", "locality", "place", "area_name"],
    land_use: ["land_use", "landuse", "use", "type", "zoning", "category"],
    size_acres: ["size_acres", "acres", "area_acres", "size", "acreage"],
    size_ha: ["size_ha", "hectares", "area_ha", "ha"],
    price_kes: ["price_kes", "price", "asking_price", "amount", "price_ksh"],
    tenure: ["tenure", "ownership", "title_type"],
    description: ["description", "desc", "notes", "details", "remarks"],
    status: ["status", "availability"]
  };
  var STATUSES = ["available", "under offer", "sold", "hidden"];
  var PUBLIC_STATUSES = ["available", "under offer"];
  var SQM_PER_ACRE = 4046.8564224;

  function lowerKeys(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (k) { out[String(k).trim().toLowerCase()] = obj[k]; });
    return out;
  }
  function pick(props, key) {
    var names = ALIASES[key];
    for (var i = 0; i < names.length; i++) {
      var v = props[names[i]];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  }
  function stripHtml(v) {
    return String(v).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  }
  function cleanText(v, max) {
    if (v === undefined || v === null) return "";
    return stripHtml(v).slice(0, max || 500);
  }
  /** "KES 2,800,000" -> 2800000, "2.8M" -> 2800000, "450k" -> 450000 */
  function parseMoney(v) {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "number") return isFinite(v) && v >= 0 ? Math.round(v) : null;
    var s = String(v).toLowerCase().replace(/kes|ksh|kshs|\/=|,|\s/g, "");
    var m = s.match(/^(\d+(?:\.\d+)?)(m|k)?$/);
    if (!m) return null;
    var n = parseFloat(m[1]) * (m[2] === "m" ? 1e6 : m[2] === "k" ? 1e3 : 1);
    return Math.round(n);
  }
  function parseNumber(v) {
    if (v === undefined || v === null || v === "") return null;
    var n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, "").replace(/[^\d.\-]/g, ""));
    return isFinite(n) && n > 0 ? n : null;
  }
  function titleCase(v) {
    var s = cleanText(v, 60).toLowerCase();
    return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // ---------- geometry ----------
  function validPos(p) {
    return Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1]) &&
      Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
  }
  var PROJECTED = "has coordinates outside the longitude/latitude range. The file looks projected (e.g. UTM 37S): re-export it in WGS 84 (EPSG:4326)";
  function looksProjected(p) { return Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]) && (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90); }
  function cleanRing(ring) {
    if (!Array.isArray(ring)) return null;
    var out = [];
    for (var i = 0; i < ring.length; i++) {
      if (looksProjected(ring[i])) return PROJECTED;
      if (!validPos(ring[i])) return null;
      out.push([+(+ring[i][0]).toFixed(7), +(+ring[i][1]).toFixed(7)]);
    }
    if (out.length < 3) return null;
    var a = out[0], b = out[out.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
    return out.length >= 4 ? out : null;
  }
  function cleanPolygon(coords) {
    if (!Array.isArray(coords) || !coords.length) return null;
    var rings = [];
    for (var i = 0; i < coords.length; i++) {
      var r = cleanRing(coords[i]);
      if (!r || typeof r === "string") return r || null;
      rings.push(r);
    }
    return rings;
  }
  /** Returns a clean Point / Polygon / MultiPolygon geometry, or an error string. */
  function cleanGeometry(g) {
    if (!g || !g.type) return "has no geometry";
    if (g.type === "Point") {
      if (looksProjected(g.coordinates)) return PROJECTED;
      if (!validPos(g.coordinates)) return "has invalid point coordinates";
      return { type: "Point", coordinates: [+(+g.coordinates[0]).toFixed(7), +(+g.coordinates[1]).toFixed(7)] };
    }
    if (g.type === "Polygon") {
      var p = cleanPolygon(g.coordinates);
      if (typeof p === "string") return p;
      return p ? { type: "Polygon", coordinates: p } : "has an invalid polygon (it needs at least 3 distinct corners)";
    }
    if (g.type === "MultiPolygon") {
      if (!Array.isArray(g.coordinates) || !g.coordinates.length) return "has an empty multipolygon";
      var parts = [];
      for (var i = 0; i < g.coordinates.length; i++) {
        var q = cleanPolygon(g.coordinates[i]);
        if (typeof q === "string") return q;
        if (!q) return "has an invalid multipolygon part";
        parts.push(q);
      }
      return parts.length === 1 ? { type: "Polygon", coordinates: parts[0] } : { type: "MultiPolygon", coordinates: parts };
    }
    if (g.type === "GeometryCollection") {
      var polys = [], pt = null;
      (g.geometries || []).forEach(function (x) {
        var c = cleanGeometry(x);
        if (typeof c === "string") return;
        if (c.type === "Polygon") polys.push(c.coordinates);
        else if (c.type === "MultiPolygon") polys = polys.concat(c.coordinates);
        else if (c.type === "Point" && !pt) pt = c;
      });
      if (polys.length) return polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys };
      if (pt) return pt;
      return "has no usable point or polygon";
    }
    return "is a " + g.type + " (only points and polygons are supported)";
  }
  /** Geodesic-enough polygon area (m²) for parcel-sized shapes: local equal-area projection per ring. */
  function ringArea(ring) {
    var lat0 = 0;
    ring.forEach(function (p) { lat0 += p[1]; });
    lat0 = (lat0 / ring.length) * Math.PI / 180;
    var R = 6378137, kx = R * Math.cos(lat0) * Math.PI / 180, ky = R * Math.PI / 180, s = 0;
    for (var i = 0; i < ring.length - 1; i++) {
      s += (ring[i][0] * kx) * (ring[i + 1][1] * ky) - (ring[i + 1][0] * kx) * (ring[i][1] * ky);
    }
    return Math.abs(s) / 2;
  }
  function polygonArea(rings) {
    var a = ringArea(rings[0]);
    for (var i = 1; i < rings.length; i++) a -= ringArea(rings[i]);
    return Math.max(a, 0);
  }
  function geometryAreaSqm(g) {
    if (g.type === "Polygon") return polygonArea(g.coordinates);
    if (g.type === "MultiPolygon") return g.coordinates.reduce(function (s, p) { return s + polygonArea(p); }, 0);
    return 0;
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "parcel";
  }
  function makeId(name, i) {
    return slug(name) + "-" + Date.now().toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /**
   * Normalise one GeoJSON feature. Returns {feature} or {error}.
   * opts.keepIds: keep incoming ids (default true).
   */
  function normaliseFeature(f, index) {
    var label = "Feature " + (index + 1);
    if (!f || f.type !== "Feature") return { error: label + " is not a GeoJSON Feature" };
    var geom = cleanGeometry(f.geometry);
    var props = lowerKeys(f.properties);
    var name = cleanText(pick(props, "name"), 120);
    if (name) label += " (" + name + ")";
    if (typeof geom === "string") return { error: label + " " + geom };

    var warnings = [];
    if (!name) { name = "Parcel " + (index + 1); warnings.push(label + ": no name column found, called it \"" + name + "\""); }

    var acres = parseNumber(pick(props, "size_acres"));
    if (acres === null) {
      var ha = parseNumber(pick(props, "size_ha"));
      if (ha !== null) acres = ha * 2.4710538;
    }
    var sizeComputed = false;
    if (acres === null && geom.type !== "Point") {
      acres = geometryAreaSqm(geom) / SQM_PER_ACRE;
      sizeComputed = true;
      warnings.push(label + ": size worked out from the boundary (" + acres.toFixed(3) + " acres)");
    }
    var price = parseMoney(pick(props, "price_kes"));
    if (price === null) warnings.push(label + ": no price found, shown as \"Price on request\"");

    var status = cleanText(pick(props, "status"), 30).toLowerCase().replace(/_/g, " ");
    if (STATUSES.indexOf(status) < 0) status = "available";

    var location = cleanText(pick(props, "location"), 80);
    if (!location && name.indexOf(",") > 0) location = name.split(",")[0].trim();

    var id = cleanText(pick(props, "id"), 80);
    id = id ? slug(id) : makeId(name, index);

    return {
      warnings: warnings,
      feature: {
        type: "Feature",
        id: id,
        properties: {
          id: id,
          name: name,
          location: location,
          land_use: titleCase(pick(props, "land_use")) || "Unspecified",
          size_acres: acres === null ? null : +acres.toFixed(3),
          size_computed: sizeComputed,
          price_kes: price,
          tenure: cleanText(pick(props, "tenure"), 60),
          description: cleanText(pick(props, "description"), 500),
          status: status
        },
        geometry: geom
      }
    };
  }

  /** Normalise a whole upload. Returns {features, errors, warnings}. */
  function normaliseCollection(gj) {
    var res = { features: [], errors: [], warnings: [] };
    if (!gj || typeof gj !== "object") { res.errors.push("File is not valid GeoJSON"); return res; }
    if (gj.crs && gj.crs.properties && gj.crs.properties.name &&
        !/4326|CRS84/i.test(gj.crs.properties.name)) {
      res.errors.push("File uses " + gj.crs.properties.name + ". Re-export it in WGS 84 (EPSG:4326) longitude/latitude.");
      return res;
    }
    var list = gj.type === "FeatureCollection" ? gj.features : gj.type === "Feature" ? [gj] : null;
    if (!Array.isArray(list)) { res.errors.push("Expected a GeoJSON FeatureCollection or Feature"); return res; }
    var seen = {};
    list.forEach(function (f, i) {
      var r = normaliseFeature(f, i);
      if (r.error) { res.errors.push(r.error); return; }
      var id = r.feature.id;
      while (seen[id]) id = id + "-" + (i + 1);
      seen[id] = true;
      r.feature.id = r.feature.properties.id = id;
      res.features.push(r.feature);
      res.warnings = res.warnings.concat(r.warnings);
    });
    if (!list.length) res.errors.push("The file contains no features");
    return res;
  }

  function isPublic(feature) {
    return PUBLIC_STATUSES.indexOf((feature.properties || {}).status || "available") >= 0;
  }

  return {
    ALIASES: ALIASES,
    STATUSES: STATUSES,
    normaliseFeature: normaliseFeature,
    normaliseCollection: normaliseCollection,
    geometryAreaSqm: geometryAreaSqm,
    parseMoney: parseMoney,
    isPublic: isPublic
  };
});
