// Local Test Server — sirf testing ke liye
// Chalaane ke liye: node server.js
// Phir browser mein kholo: http://localhost:3000
//
// ⚠️  Yeh file ONLY local testing ke liye hai.
//     Production mein Vercel handle karta hai (api/create-order.js).

const http = require('http');
const fs   = require('fs');
const path = require('path');

// ── Credentials (testing ke liye yahan hain, production mein Vercel env vars use karo) ──
const CASHFREE_APP_ID = '1193887a91ad87569c7eb4e6bf77883911';
const CASHFREE_SECRET = 'cfsk_ma_prod_bac8c6dcce5a5adf93c4a190aaad5a45_7700912b';
const ORDER_AMOUNT    = 1.00;   // ← testing: 1  |  production: 999
const PORT            = 3000;

// ── MIME types ──
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

http.createServer(async (req, res) => {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // ── API: POST /api/create-order ──────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/create-order') {
    try {
      const orderId = 'AGM-' + Date.now() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();

      const cfRes = await fetch('https://api.cashfree.com/pg/orders', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-client-id':     CASHFREE_APP_ID,
          'x-client-secret': CASHFREE_SECRET,
          'x-api-version':   '2023-08-01',
        },
        body: JSON.stringify({
          order_id:       orderId,
          order_amount:   ORDER_AMOUNT,
          order_currency: 'INR',
          customer_details: {
            customer_id:    'guest_' + Date.now(),
            customer_phone: '9999999999',
          },
          order_meta: {
            return_url: 'https://autogrow.iautomate.in/register',
          },
        }),
      });

      const data = await cfRes.json();
      console.log('[Cashfree]', cfRes.status, data.order_id || data.message);

      if (!cfRes.ok) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: data.message || 'Order creation failed' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success:            true,
        payment_session_id: data.payment_session_id,
        order_id:           data.order_id,
      }));

    } catch (err) {
      console.error('[create-order]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Server error' }));
    }
    return;
  }

  // ── Static file serving ──────────────────────────────────────────────────
  let urlPath = req.url.split('?')[0].split('#')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // Fallback to index.html for SPA-style routing
    const indexPath = path.join(__dirname, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(indexPath));
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  res.end(fs.readFileSync(filePath));

}).listen(PORT, () => {
  console.log('');
  console.log('✅  Server chal raha hai: http://localhost:' + PORT);
  console.log('💳  Browser mein kholo aur CTA button click karo');
  console.log('');
});
