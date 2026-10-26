# Maltech website

Static website assets are built from the root HTML, css/, js/ and images/ into dist/. Only that output is served; the local .preview/ workspace, app source and credentials are excluded.

## Deploy

`node scripts/build-site.cjs` builds the assets. `wrangler deploy` also runs this build through wrangler.jsonc.

The maltech-website Worker serves both maltech-young.co.uk and www.maltech-young.co.uk. Its WORKSHOP service binding targets the existing maltech-workshop-app Worker. The private WEBSITE_BRIDGE_SECRET must remain configured on both Workers and must never be committed or sent to the browser.

## Bookings

The browser uses same-origin GET/POST /api/public/bookings. The website Worker signs requests and forwards them through its service binding. The app validates the signature, date, service, shared capacity and idempotency key, then saves a requested booking and linked customer, vehicle and job card in the app's database. Website and staff bookings share the same calendar capacity. Customers receive a reference and must wait for staff confirmation. Booking emails/SMS are not sent by this integration.

Staff booking API permissions and private file access remain unchanged. App source is in the separate OneDrive Maltech Workshop App project, which includes migration 0010_website_bookings.sql and website-bookings tests. Tests use a fixture mirroring worker.mjs; update the fixture if this bridge changes.

Disable WEBSITE_BOOKINGS_ENABLED on the app to stop new website submissions. Existing records are preserved.
