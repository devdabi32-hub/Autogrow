// Vercel Serverless Function — Cashfree Order Creation
// Environment variables required (set in Vercel Dashboard):
//   CASHFREE_APP_ID  → your App ID
//   CASHFREE_SECRET  → your Secret Key
//   ORDER_AMOUNT     → 1 (testing) or 999 (production)

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const orderId = 'AGM-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const amount  = parseFloat(process.env.ORDER_AMOUNT) || 1.00;

    const cfRes = await fetch('https://api.cashfree.com/pg/orders', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-client-id':     process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET,
        'x-api-version':   '2023-08-01',
      },
      body: JSON.stringify({
        order_id:       orderId,
        order_amount:   amount,
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

    if (!cfRes.ok) {
      console.error('[create-order] Cashfree error:', data);
      return res.status(400).json({ success: false, error: data.message || 'Order creation failed' });
    }

    return res.status(200).json({
      success:            true,
      payment_session_id: data.payment_session_id,
      order_id:           data.order_id,
    });

  } catch (err) {
    console.error('[create-order] Exception:', err);
    return res.status(500).json({ success: false, error: 'Server error. Please retry.' });
  }
};
