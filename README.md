# Amazon.de parcel-tax estimator bookmarklet

Local-only bookmarklet to estimate how many Amazon.de physical orders/delivery groups you had in the last 365 days, what a €2-per-parcel tax would cost, and how that tax compares to parsed purchase totals.

## Build

```bash
node tools/build.mjs
```

This creates:

- `dist/index.html` — installer page with a draggable bookmarklet link
- `dist/bookmarklet.txt` — raw bookmarklet URL

## Try it

1. Open `dist/index.html` in a browser.
2. Drag **Amazon parcel taxlet** into your bookmarks bar.
3. Open `https://www.amazon.de/your-orders/orders` and sign in.
4. Click the bookmarklet.

## GitHub Pages deployment

Pushing to `main` runs `.github/workflows/pages.yml`, builds `dist/`, and deploys it with GitHub Pages Actions. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## How it works

The bookmarklet injects a small overlay into Amazon.de. It loads same-origin Amazon order-history pages in hidden iframes for the current year and previous year, waits for Amazon's own client-side rendering/decryption, then counts physical retail order cards with order IDs matching:

```js
/\b\d{3}-\d{7}-\d{7}\b/
```

It also parses visible order totals from order headers, sums those purchase amounts, and counts visible `.delivery-box` elements as a rough shipment/delivery-group proxy.

For tax-on-tax, the bookmarklet cannot know the VAT class from the order-history list, so it shows both requested VAT endpoints: 10% and 20% VAT on the €2 parcel tax.

No data is sent anywhere. CSV export is generated locally in the browser.

## Limitations

- It estimates orders/delivery groups, not guaranteed legal parcel-tax liability.
- Order totals are parsed from visible order headers and may be missing if Amazon changes the DOM.
- VAT class is not exposed in the order list, so VAT-on-tax is shown as 10%/20% alternatives.
- One order can be split into multiple parcels; multiple orders may be bundled.
- Digital/subscription orders are skipped by physical order-id format.
