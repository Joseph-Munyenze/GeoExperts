# Geoexpert Land Surveyors Ltd: website + land listings CMS

The public website (Home, Services, Land for sale, Projects) comes with a hidden admin page.
Use the admin page to update **Land for sale** by uploading a GeoJSON or KML file.

## 1. Run it in VS Code
Requires **Node.js 18 or newer** (https://nodejs.org). No `npm install` is needed: the server uses only Node's built-in modules.

1. Unzip the folder and open it in VS Code (**File > Open Folder**).
2. Open a terminal (**Terminal > New Terminal**) and run:
   ```
   npm start
   ```
3. The first time it runs, the server creates a `.env` file and prints an **admin password** in the terminal.
4. Open:
   - Website: http://localhost:3000/
   - Admin (CMS): http://localhost:3000/admin/

To change the admin password, edit `ADMIN_PASSWORD` in `.env` (at least 8 characters) and restart the server with Ctrl+C, then `npm start`.

> Opening `index.html` by double-clicking it, or with Live Server, shows the site but cannot load or update listings. Always use `npm start`.

## 2. Update land for sale
1. Go to http://localhost:3000/admin/ and sign in.
2. **Upload** a `.geojson` / `.json` or `.kml` file. It should have one feature per parcel: polygon boundaries or points, in **WGS 84 longitude/latitude (EPSG:4326)**.
3. Choose how to use it:
   - **Add or update**: keeps current listings. A feature with the same `id` as an existing listing replaces it.
   - **Replace all**: the website shows only the listings in this file.
4. **Check the preview.** It shows a table, the parcels on a satellite map, and any problems or notes. Problems include lines instead of polygons, projected UTM coordinates, or empty geometry.
5. Click **Publish to website**. The Land for sale page updates straight away.

In **Current listings** you can also:
- change a listing's **status**: Available, Under offer (shown with a badge), Sold or Hidden. Sold and Hidden are not shown on the website.
- edit a listing's **price**.
- **zoom** to a listing or **delete** it.
- **download** all listings as GeoJSON.

Every change saves a **backup** first. Restore any backup from the Backups section.

Templates: `samples/listings-template.geojson` and `samples/listings-template.kml`.

### Fields
| Field | Also accepted as | Notes |
|---|---|---|
| `id` | parcel_id, listing_id, fid | Keep the same id to update a listing later |
| `name` | title, parcel_name, plot_name, parcel, plot | Listing title |
| `location` | town, locality, place, area_name | Falls back to the text before the first comma in the name |
| `land_use` | landuse, use, type, zoning, category | Builds the Land use filter |
| `size_acres` | acres, area_acres, size, acreage | Calculated from the polygon if missing |
| `size_ha` | hectares, area_ha, ha | Converted to acres |
| `price_kes` | price, asking_price, amount, price_ksh | 2800000, "KES 2,800,000" and "2.8M" all work; blank shows "Price on request" |
| `tenure` | ownership, title_type | e.g. Freehold, Leasehold 99 yrs |
| `description` | desc, notes, details, remarks | HTML is removed |
| `status` | availability | available (default), under offer, sold, hidden |

Field names are not case-sensitive.
In KML, put the fields in `<ExtendedData>`. The placemark `<name>` and `<description>` are read too.
KMZ files must be unzipped to KML first.

## 3. Project structure
| Path | Contents |
|---|---|
| `index.html`, `css/style.css`, `js/app.js` | Public website |
| `js/parcel-schema.js` | Shared rules that clean and check uploaded parcels (used by the website, the admin page and the server) |
| `admin/` | Admin page (`index.html`, `admin.js`, `admin.css`) |
| `server.js` | Web server + admin API (sign-in, upload, edit, delete, backups) |
| `data/listings.geojson` | **All** listings, including sold and hidden. Private: the server never serves it |
| `data/parcels.geojson` | Public copy the website reads (available and under offer only). Written automatically |
| `data/backups/` | Automatic backups. Private |
| `samples/` | Upload templates |
| `.env` | Admin password and port. Private: never share or commit it |

## 4. Contact details
In `js/app.js`, near the top, replace the placeholders:
```js
var CONTACT={email:"info@geoexpert.co.ke",phone:"+254700000000",phoneLabel:"+254 700 000 000"};
```
The WhatsApp links in `index.html` (`https://wa.me/254700000000`) also need changing.

## 5. Putting it online
The site needs a host that runs Node.js and keeps files on disk between restarts, so uploaded listings are not lost. A small VPS works, or a platform with a persistent disk mounted at `data/`.
- Set `ADMIN_PASSWORD` (and `PORT` if the host requires it) as environment variables.
- Serve the site over **HTTPS**, so the admin password is not sent in plain text.
- Static-only hosts (GitHub Pages, Netlify drop) can show the site but cannot run the admin page.

## Basemaps (Land for sale)
- **Sentinel-2 cloudless 2016 by EOX** (default): open data, CC BY 4.0, 10 m resolution.
- **Esri World Imagery**: higher resolution, free to use with attribution, but not open data.
- **OpenStreetMap**: street map.

## Files referenced but not included
The Services page links to `Geoexpert_PostGIS_Database_Setup.sql` and `Geoexpert_GIS_Remote_Sensing_Architecture.md`.
Put them in the project root so those download buttons work.
