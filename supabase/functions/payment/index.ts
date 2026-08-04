// Cashfree Payment Edge Function
// Handles: POST /payment/create-order  and  GET /payment/verify-payment
//
// Supabase secrets required (set via: supabase secrets set KEY=value):
//   CASHFREE_APP_ID   → your Cashfree App ID
//   CASHFREE_SECRET   → your Cashfree Secret Key

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID")!;
const CASHFREE_SECRET = Deno.env.get("CASHFREE_SECRET")!;
const CF_API = "https://api.cashfree.com/pg";
const CF_VERSION = "2023-08-01";

const ORDER_AMOUNT = 1.00; // ₹1 — change to 999.00 when going live

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname.endsWith("/create-order")) {
    return createOrder(req);
  }

  if (req.method === "GET" && url.pathname.endsWith("/verify-payment")) {
    return verifyPayment(url);
  }

  return json({ error: "Not found" }, 404);
});

async function createOrder(req: Request) {
  try {
    const { customer_name, email, phone, return_url } = await req.json();

    if (!customer_name || !email || !phone) {
      return json({ success: false, error: "Missing required fields" }, 400);
    }

    const orderId =
      "AGM-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 7).toUpperCase();

    // Build return URL: Cashfree replaces {order_id} automatically
    const base = return_url
      ? return_url.split("?")[0]
      : "https://yourdomain.com";
    const cfReturnUrl = `${base}?order_id={order_id}`;

    const payload = {
      order_id: orderId,
      order_amount: ORDER_AMOUNT,
      order_currency: "INR",
      customer_details: {
        customer_id: "CUST-" + Date.now(),
        customer_name,
        customer_email: email,
        customer_phone: phone,
      },
      order_meta: {
        return_url: cfReturnUrl,
      },
    };

    const res = await fetch(`${CF_API}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET,
        "x-api-version": CF_VERSION,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[create-order] Cashfree error:", data);
      return json(
        { success: false, error: data.message || "Order creation failed" },
        400
      );
    }

    return json({
      success: true,
      data: {
        order_id: data.order_id,
        payment_session_id: data.payment_session_id,
      },
    });
  } catch (err) {
    console.error("[create-order] Exception:", err);
    return json({ success: false, error: "Server error. Please retry." }, 500);
  }
}

async function verifyPayment(url: URL) {
  try {
    const orderId = url.searchParams.get("order_id");
    if (!orderId) {
      return json({ success: false, error: "order_id is required" }, 400);
    }

    const res = await fetch(
      `${CF_API}/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET,
          "x-api-version": CF_VERSION,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return json({ success: false, error: data.message }, 400);
    }

    return json({
      success: true,
      data: {
        order_id: data.order_id,
        status: data.order_status,   // "PAID" | "ACTIVE" | "EXPIRED"
        amount: data.order_amount,
        payment_time: data.order_tags?.payment_time ?? data.created_at,
      },
    });
  } catch (err) {
    console.error("[verify-payment] Exception:", err);
    return json({ success: false, error: "Server error. Please retry." }, 500);
  }
}
