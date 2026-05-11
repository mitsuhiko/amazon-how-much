import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/bookmarklet.js', import.meta.url), 'utf8').trim();
const href = `javascript:${encodeURIComponent(source)}`;

mkdirSync(new URL('../dist', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/bookmarklet.txt', import.meta.url), href + '\n');
writeFileSync(new URL('../dist/.nojekyll', import.meta.url), '');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Amazon.de parcel-tax estimator bookmarklet</title>
  <style>
    :root {
      --ink: #201a14;
      --paper: #fff8ec;
      --sun: #ffcf57;
      --blue: #2d7ff9;
      --green: #e9f7dc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 18% 10%, rgba(255,207,87,.36), transparent 28rem),
        radial-gradient(circle at 86% 18%, rgba(45,127,249,.20), transparent 24rem),
        var(--paper);
    }
    main { max-width: 920px; margin: 0 auto; padding: 56px 22px 80px; }
    .hero {
      border: 3px solid var(--ink);
      border-radius: 28px;
      background: rgba(255,248,236,.86);
      box-shadow: 14px 14px 0 rgba(32,26,20,.18);
      overflow: hidden;
    }
    header { padding: 34px; background: linear-gradient(135deg, var(--sun), #ffebb1); border-bottom: 3px solid var(--ink); }
    h1 { margin: 0; font-size: clamp(34px, 6vw, 72px); line-height: .92; letter-spacing: -.06em; }
    .lede { max-width: 680px; margin: 18px 0 0; font-size: 18px; line-height: 1.5; }
    section { padding: 28px 34px; }
    .install { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; padding: 22px; border: 3px dashed var(--ink); border-radius: 20px; background: white; }
    .bookmarklet {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 48px; padding: 0 18px; border: 3px solid var(--ink); border-radius: 999px;
      background: var(--blue); color: white; text-decoration: none; font-weight: 900;
      box-shadow: 5px 5px 0 rgba(32,26,20,.22);
    }
    .bookmarklet:focus { outline: 4px solid var(--sun); outline-offset: 3px; }
    .hint { font-size: 14px; line-height: 1.45; max-width: 560px; }
    ol { line-height: 1.65; padding-left: 1.4em; }
    code, textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    textarea { width: 100%; min-height: 110px; border: 2px solid var(--ink); border-radius: 14px; padding: 12px; background: white; }
    button { border: 2px solid var(--ink); border-radius: 999px; background: var(--ink); color: var(--paper); font-weight: 850; padding: 10px 14px; cursor: pointer; }
    .note { margin-top: 20px; padding: 16px; border: 2px solid var(--ink); border-radius: 16px; background: var(--green); font-size: 14px; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <div class="hero">
      <header>
        <h1>Amazon.de parcel-tax estimator</h1>
        <p class="lede">A local-only bookmarklet that scans your rendered Amazon.de order pages, sums visible order totals, and estimates what a €2-per-parcel tax plus VAT-on-tax would mean for you.</p>
      </header>
      <section>
        <div class="install">
          <a class="bookmarklet" id="bookmarklet" href="#">Amazon parcel taxlet</a>
          <div class="hint"><strong>Install:</strong> drag the blue button into your bookmarks bar. Then open Amazon.de orders while signed in and click the bookmark.</div>
        </div>
        <ol>
          <li>Go to <code>https://www.amazon.de/your-orders/orders</code> and sign in.</li>
          <li>Click the bookmarklet.</li>
          <li>Wait while it loads hidden same-origin order pages for the current and previous year.</li>
          <li>Read the purchase-total, tax-share, VAT-on-tax, and optional delivery-box estimates.</li>
        </ol>
        <div class="note"><strong>Privacy:</strong> the bookmarklet runs entirely in your browser. It does not send order data anywhere. The CSV export is generated locally.</div>
        <h2>If dragging does not work</h2>
        <p>Create a new bookmark manually, name it “Amazon parcel taxlet”, and paste this entire URL as the bookmark URL:</p>
        <p><button id="copy">Copy bookmarklet URL</button></p>
        <textarea id="code" readonly spellcheck="false"></textarea>
      </section>
    </div>
  </main>
  <script>
    const href = ${JSON.stringify(href)};
    document.getElementById('bookmarklet').href = href;
    document.getElementById('code').value = href;
    document.getElementById('copy').addEventListener('click', async () => {
      await navigator.clipboard.writeText(href);
      document.getElementById('copy').textContent = 'Copied';
      setTimeout(() => document.getElementById('copy').textContent = 'Copy bookmarklet URL', 1500);
    });
  </script>
</body>
</html>
`;

writeFileSync(new URL('../dist/index.html', import.meta.url), html);
console.log(`Wrote dist/bookmarklet.txt (${href.length} chars) and dist/index.html`);
