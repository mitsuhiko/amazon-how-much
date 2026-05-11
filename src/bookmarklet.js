(async function amazonParcelTaxlet() {
  'use strict';

  const APP_ID = 'amazon-parcel-taxlet';
  const PRICE_PER_PARCEL = 2;
  const PHYSICAL_ORDER_ID = /\b\d{3}-\d{7}-\d{7}\b/;
  const DIGITAL_ORDER_ID = /\bD\d{2}-\d{7}-\d{7}\b/i;

  const hostOk = /(^|\.)amazon\.de$/i.test(location.hostname);
  if (!hostOk) {
    alert('Open an Amazon.de page while signed in, then click this bookmarklet again.');
    return;
  }

  const existing = document.getElementById(APP_ID);
  if (existing) existing.remove();

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 365);
  cutoff.setHours(0, 0, 0, 0);

  const state = {
    stopped: false,
    activeFrame: null,
    pages: 0,
    pageErrors: 0,
    orders: new Map(),
    deliveryGroups: 0,
    physicalCardsSeen: 0,
    datedCardsSeen: 0,
    logs: [],
  };

  const host = document.createElement('div');
  host.id = APP_ID;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .apx-panel, .apx-panel * { box-sizing: border-box; }
      .apx-panel {
        position: fixed;
        right: 18px;
        top: 18px;
        z-index: 2147483647;
        width: min(430px, calc(100vw - 36px));
        max-height: calc(100vh - 36px);
        overflow: auto;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #201a14;
        background: #fff8ec;
        border: 2px solid #201a14;
        border-radius: 16px;
        box-shadow: 10px 10px 0 rgba(32,26,20,.22);
      }
      .apx-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        padding: 16px 16px 10px;
        border-bottom: 2px solid #201a14;
        background: linear-gradient(135deg, #ffcf57, #ffebad);
      }
      .apx-title { font-weight: 900; font-size: 18px; line-height: 1.15; margin: 0; letter-spacing: -.02em; }
      .apx-sub { font-size: 12px; margin-top: 4px; opacity: .82; line-height: 1.35; }
      .apx-close {
        appearance: none; border: 2px solid #201a14; background: #fff8ec; color: #201a14;
        border-radius: 999px; width: 30px; height: 30px; font-size: 20px; line-height: 22px;
        cursor: pointer; font-weight: 800;
      }
      .apx-body { padding: 14px 16px 16px; }
      .apx-status { font-size: 13px; line-height: 1.35; min-height: 36px; margin-bottom: 12px; }
      .apx-meter { height: 10px; border: 2px solid #201a14; border-radius: 999px; overflow: hidden; background: #fff; margin: 8px 0 12px; }
      .apx-bar {
        width: 36%; height: 100%; background: repeating-linear-gradient(135deg, #2d7ff9 0 10px, #75b2ff 10px 20px);
        animation: apx-slide .9s linear infinite;
      }
      @keyframes apx-slide { to { transform: translateX(28px); } }
      @media (prefers-reduced-motion: reduce) { .apx-bar { animation: none; } }
      .apx-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin: 10px 0 12px; }
      .apx-stat { background: #fff; border: 2px solid #201a14; border-radius: 12px; padding: 10px; }
      .apx-num { display: block; font-weight: 900; font-size: 26px; line-height: 1; letter-spacing: -.04em; }
      .apx-label { display: block; font-size: 11px; line-height: 1.25; margin-top: 5px; opacity: .78; }
      .apx-result { display: none; margin-top: 12px; padding: 12px; background: #e9f7dc; border: 2px solid #201a14; border-radius: 12px; font-size: 13px; line-height: 1.45; }
      .apx-result strong { font-weight: 900; }
      .apx-note { font-size: 11px; line-height: 1.35; opacity: .75; margin: 10px 0 0; }
      .apx-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .apx-btn {
        appearance: none; border: 2px solid #201a14; border-radius: 999px; padding: 8px 11px;
        background: #201a14; color: #fff8ec; font-weight: 800; font-size: 12px; cursor: pointer;
      }
      .apx-btn.secondary { background: #fff8ec; color: #201a14; }
      .apx-btn:disabled { opacity: .45; cursor: not-allowed; }
      details { margin-top: 10px; font-size: 12px; }
      summary { cursor: pointer; font-weight: 800; }
      pre { white-space: pre-wrap; word-break: break-word; max-height: 130px; overflow: auto; background: rgba(32,26,20,.06); border-radius: 10px; padding: 8px; }
    </style>
    <div class="apx-panel" role="dialog" aria-live="polite" aria-label="Amazon parcel tax estimator">
      <div class="apx-head">
        <div>
          <h1 class="apx-title">Amazon.de parcel-tax estimate</h1>
          <div class="apx-sub">Scans your rendered order pages locally. No data is sent anywhere.</div>
        </div>
        <button class="apx-close" id="apx-close" title="Close">×</button>
      </div>
      <div class="apx-body">
        <div class="apx-status" id="apx-status">Starting…</div>
        <div class="apx-meter" aria-hidden="true"><div class="apx-bar" id="apx-bar"></div></div>
        <div class="apx-stats">
          <div class="apx-stat"><span class="apx-num" id="apx-orders">0</span><span class="apx-label">physical orders in last 365 days</span></div>
          <div class="apx-stat"><span class="apx-num" id="apx-deliveries">0</span><span class="apx-label">visible delivery/shipment boxes</span></div>
          <div class="apx-stat"><span class="apx-num" id="apx-pages">0</span><span class="apx-label">order-history pages scanned</span></div>
          <div class="apx-stat"><span class="apx-num" id="apx-cost">€0</span><span class="apx-label">€2 × physical orders</span></div>
        </div>
        <div class="apx-result" id="apx-result"></div>
        <p class="apx-note">This is an estimate. Amazon does not expose a clean parcel-tax field; one order may be split into multiple deliveries, and multiple orders can sometimes arrive together.</p>
        <div class="apx-actions">
          <button class="apx-btn secondary" id="apx-stop">Stop</button>
          <button class="apx-btn secondary" id="apx-copy" disabled>Copy CSV</button>
          <button class="apx-btn secondary" id="apx-download" disabled>Download CSV</button>
        </div>
        <details>
          <summary>Scan log</summary>
          <pre id="apx-log"></pre>
        </details>
      </div>
    </div>
  `;

  const $ = (id) => shadow.getElementById(id);
  const els = {
    status: $('apx-status'),
    orders: $('apx-orders'),
    deliveries: $('apx-deliveries'),
    pages: $('apx-pages'),
    cost: $('apx-cost'),
    result: $('apx-result'),
    log: $('apx-log'),
    stop: $('apx-stop'),
    copy: $('apx-copy'),
    download: $('apx-download'),
    close: $('apx-close'),
    bar: $('apx-bar'),
  };

  els.close.addEventListener('click', () => stopAndRemove());
  els.stop.addEventListener('click', () => {
    state.stopped = true;
    els.stop.disabled = true;
    log('Stopping after current page…');
    if (state.activeFrame) state.activeFrame.remove();
  });
  els.copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(makeCsv());
      log('CSV copied to clipboard.');
    } catch (err) {
      log('Could not copy CSV: ' + err.message);
    }
  });
  els.download.addEventListener('click', () => {
    const blob = new Blob([makeCsv()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'amazon-de-parcel-tax-estimate.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  function stopAndRemove() {
    state.stopped = true;
    if (state.activeFrame) state.activeFrame.remove();
    host.remove();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function formatDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function euro(n) {
    return '€' + n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function text(el) {
    return (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  function log(msg) {
    const line = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    state.logs.push(line);
    if (state.logs.length > 80) state.logs.shift();
    els.log.textContent = state.logs.join('\n');
  }

  function setStatus(msg) {
    els.status.textContent = msg;
    updateStats();
  }

  function updateStats() {
    const orderCount = state.orders.size;
    els.orders.textContent = String(orderCount);
    els.deliveries.textContent = String(state.deliveryGroups);
    els.pages.textContent = String(state.pages);
    els.cost.textContent = euro(orderCount * PRICE_PER_PARCEL);
  }

  const monthMap = new Map(Object.entries({
    january: 0, jan: 0, januar: 0,
    february: 1, feb: 1, februar: 1,
    march: 2, mar: 2, maerz: 2, maer: 2, marz: 2, mrz: 2,
    april: 3, apr: 3,
    may: 4, mai: 4,
    june: 5, jun: 5, juni: 5,
    july: 6, jul: 6, juli: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9, oktober: 9, okt: 9,
    november: 10, nov: 10,
    december: 11, dec: 11, dezember: 11, dez: 11,
  }));
  const monthPattern = Array.from(monthMap.keys()).sort((a, b) => b.length - a.length).join('|');

  function normalizeMonthName(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/é/g, 'e')
      .replace(/\./g, '');
  }

  function makeDate(y, m, d) {
    const date = new Date(Number(y), Number(m), Number(d));
    if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) || date.getDate() !== Number(d)) return null;
    return date;
  }

  function parseFirstDate(raw) {
    const s = String(raw || '').replace(/\s+/g, ' ');
    let m;

    const reDayMonth = new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th|\\.)?\\s+(' + monthPattern + '|März|Mär|Mrz|März\\.)\\s+(20\\d{2})\\b', 'i');
    m = s.match(reDayMonth);
    if (m) {
      const mon = monthMap.get(normalizeMonthName(m[2]));
      if (mon !== undefined) return makeDate(m[3], mon, m[1]);
    }

    const reMonthDay = new RegExp('\\b(' + monthPattern + '|März|Mär|Mrz|März\\.)\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b', 'i');
    m = s.match(reMonthDay);
    if (m) {
      const mon = monthMap.get(normalizeMonthName(m[1]));
      if (mon !== undefined) return makeDate(m[3], mon, m[2]);
    }

    m = s.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2}|\d{2})\b/);
    if (m) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return makeDate(y, Number(m[2]) - 1, Number(m[1]));
    }

    return null;
  }

  function ordersUrl(year, startIndex) {
    const path = '/-/en/your-orders/orders';
    const u = new URL(path, location.origin);
    u.searchParams.set('language', 'en');
    u.searchParams.set('timeFilter', 'year-' + year);
    u.searchParams.set('startIndex', String(startIndex));
    u.searchParams.set('ref_', 'apx_taxlet');
    return u.href;
  }

  async function loadRenderedPage(url) {
    const frame = document.createElement('iframe');
    state.activeFrame = frame;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:1200px;height:1000px;opacity:.01;pointer-events:none;z-index:-1;background:white;';
    frame.src = url;
    document.body.appendChild(frame);

    const loaded = new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      frame.addEventListener('load', finish, { once: true });
      setTimeout(finish, 15000);
    });

    await loaded;
    const started = Date.now();
    let lastSignature = '';
    let stableCount = 0;

    while (!state.stopped && Date.now() - started < 22000) {
      let doc;
      try { doc = frame.contentDocument; } catch (_) { doc = null; }
      if (doc && doc.body) {
        const bodyText = text(doc.body);
        if (/Amazon Sign-In|Sign in|Anmelden|Einloggen/i.test(doc.title + ' ' + bodyText.slice(0, 1000))) {
          return { frame, doc, signIn: true, timedOut: false };
        }

        const cards = doc.querySelectorAll('.order-card').length;
        const headers = doc.querySelectorAll('.order-header').length;
        const boxes = doc.querySelectorAll('.delivery-box').length;
        const noOrders = /No orders|Keine Bestellungen|0 orders|0 Bestellungen/i.test(bodyText);
        const signature = cards + ':' + headers + ':' + boxes + ':' + bodyText.length;

        if ((headers > 0 || boxes > 0 || noOrders || (cards === 0 && /Your Orders|Meine Bestellungen/i.test(doc.title))) && bodyText.length > 300) {
          if (signature === lastSignature) stableCount += 1;
          else stableCount = 0;
          lastSignature = signature;
          if (stableCount >= 2) return { frame, doc, signIn: false, timedOut: false };
        }
      }
      await sleep(500);
    }

    return { frame, doc: frame.contentDocument, signIn: false, timedOut: true };
  }

  function parseCard(card) {
    const header = card.querySelector('.order-header') || card;
    const headerText = text(header);
    const idMatch = headerText.match(PHYSICAL_ORDER_ID);
    const digitalMatch = headerText.match(DIGITAL_ORDER_ID);
    if (!idMatch || digitalMatch) return null;

    const orderId = idMatch[0];
    const orderDate = parseFirstDate(headerText);
    const detailLink = Array.from(card.querySelectorAll('a[href]')).find((a) => /order-details/i.test(a.href));
    const boxes = Array.from(card.querySelectorAll('.delivery-box'));
    const deliveryDates = boxes.map((box) => parseFirstDate(text(box))).filter(Boolean);

    return {
      orderId,
      orderDate,
      orderDateText: orderDate ? formatDate(orderDate) : '',
      deliveryBoxCount: boxes.length,
      deliveryDates: deliveryDates.map(formatDate).join(';'),
      detailPath: detailLink ? new URL(detailLink.href).pathname : '',
    };
  }

  function parsePage(doc, year, startIndex) {
    const cards = Array.from(doc.querySelectorAll('.order-card'));
    const parsed = [];
    const allDates = [];

    for (const card of cards) {
      const cardText = text(card.querySelector('.order-header') || card);
      const anyDate = parseFirstDate(cardText);
      if (anyDate) allDates.push(anyDate);

      const order = parseCard(card);
      if (!order) continue;
      state.physicalCardsSeen += 1;
      if (order.orderDate) state.datedCardsSeen += 1;
      parsed.push(order);
    }

    const nextStart = getNextStart(doc, startIndex);
    const bodyText = text(doc.body);
    const numOrders = (doc.querySelector('.num-orders') && text(doc.querySelector('.num-orders'))) || '';

    return { year, startIndex, cards: cards.length, parsed, allDates, nextStart, numOrders, bodyTextSample: bodyText.slice(0, 300) };
  }

  function getNextStart(doc, currentStart) {
    const candidates = Array.from(doc.querySelectorAll('a[href*="startIndex"]'))
      .map((a) => {
        let u;
        try { u = new URL(a.href, location.href); } catch (_) { return null; }
        if (!/\/your-orders\/orders$/.test(u.pathname)) return null;
        const start = Number(u.searchParams.get('startIndex'));
        if (!Number.isFinite(start)) return null;
        return { start, label: text(a) };
      })
      .filter(Boolean);

    const explicit = candidates.find((c) => c.start > currentStart && /^(next|weiter|nächste|naechste)|→|›/i.test(c.label));
    if (explicit) return explicit.start;

    const greater = candidates.map((c) => c.start).filter((n) => n > currentStart).sort((a, b) => a - b);
    return greater[0] ?? null;
  }

  function includeOrder(order) {
    if (!order.orderDate) return false;
    return order.orderDate >= cutoff && order.orderDate <= now;
  }

  function addOrder(order) {
    if (state.orders.has(order.orderId)) return;
    state.orders.set(order.orderId, order);
    state.deliveryGroups += order.deliveryBoxCount;
  }

  function makeCsv() {
    const rows = [['order_date', 'order_id', 'visible_delivery_boxes', 'visible_delivery_dates', 'detail_path']];
    Array.from(state.orders.values())
      .sort((a, b) => (a.orderDateText < b.orderDateText ? -1 : 1))
      .forEach((o) => rows.push([o.orderDateText, o.orderId, String(o.deliveryBoxCount), o.deliveryDates, o.detailPath]));
    return rows.map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n';
  }

  async function scan() {
    log('Scanning last 365 days: ' + formatDate(cutoff) + ' through ' + formatDate(now) + '.');

    const years = [];
    for (let y = now.getFullYear(); y >= cutoff.getFullYear(); y--) years.push(y);

    for (const year of years) {
      let startIndex = 0;
      const seenStarts = new Set();
      let pageCountForYear = 0;

      while (!state.stopped && startIndex !== null && !seenStarts.has(startIndex) && pageCountForYear < 100) {
        seenStarts.add(startIndex);
        pageCountForYear += 1;
        setStatus('Scanning Amazon.de orders for ' + year + ', page starting at ' + startIndex + '…');
        log('Loading ' + year + ' / startIndex=' + startIndex);

        let loaded;
        try {
          loaded = await loadRenderedPage(ordersUrl(year, startIndex));
          if (loaded.signIn) {
            throw new Error('Amazon asked for sign-in inside the scan iframe. Open your orders page, make sure you are signed in, then try again.');
          }
          if (loaded.timedOut) log('Warning: page render timed out; parsing whatever rendered.');

          const page = parsePage(loaded.doc, year, startIndex);
          state.pages += 1;

          let added = 0;
          for (const order of page.parsed) {
            if (includeOrder(order)) {
              addOrder(order);
              added += 1;
            }
          }

          log('Found ' + page.parsed.length + ' physical order card(s), added ' + added + '. ' + (page.numOrders || ''));
          updateStats();

          if (year === cutoff.getFullYear() && page.allDates.length && page.allDates.every((d) => d < cutoff)) {
            log('Reached orders older than cutoff for ' + year + '; stopping this year.');
            break;
          }

          startIndex = page.nextStart;
        } catch (err) {
          state.pageErrors += 1;
          log('Error: ' + (err && err.message || String(err)));
          throw err;
        } finally {
          if (loaded && loaded.frame) loaded.frame.remove();
          if (state.activeFrame && state.activeFrame.parentNode) state.activeFrame.remove();
          state.activeFrame = null;
        }

        await sleep(700);
      }
    }

    finish();
  }

  function finish() {
    state.stopped = true;
    els.stop.disabled = true;
    els.copy.disabled = state.orders.size === 0;
    els.download.disabled = state.orders.size === 0;
    els.bar.style.animation = 'none';
    els.bar.style.width = '100%';

    const orders = state.orders.size;
    const orderCost = orders * PRICE_PER_PARCEL;
    const deliveryCost = state.deliveryGroups * PRICE_PER_PARCEL;

    setStatus('Done. Scanned ' + state.pages + ' page(s).');
    els.result.style.display = 'block';
    els.result.innerHTML = `
      <strong>${orders}</strong> physical Amazon.de order(s) placed from <strong>${formatDate(cutoff)}</strong> to <strong>${formatDate(now)}</strong>.<br>
      Order-proxy estimate: <strong>${orders} × €${PRICE_PER_PARCEL} = ${euro(orderCost)}</strong>.<br>
      Visible delivery/shipment boxes: <strong>${state.deliveryGroups}</strong>${state.deliveryGroups ? `, parcel-ish estimate <strong>${euro(deliveryCost)}</strong>.` : '.'}
    `;
    log('Done.');
  }

  try {
    await scan();
  } catch (err) {
    els.bar.style.animation = 'none';
    els.bar.style.background = '#ff6b5f';
    setStatus('Stopped with an error: ' + (err && err.message || String(err)));
    els.result.style.display = 'block';
    els.result.innerHTML = 'The scan did not complete. You can close this box and try again from the Amazon.de orders page.';
    els.stop.disabled = true;
  }
})();
