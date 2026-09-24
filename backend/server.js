const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET =
  process.env.JWT_SECRET || "mishwark-demo-secret";

const users = new Map();
const otps = new Map();
const trips = new Map();

function phoneOf(value) {
  return String(value || "").trim().replace(/[^\d+]/g, "");
}

function makeToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = jwt.verify(
      header.substring(7),
      JWT_SECRET
    );

    next();
  } catch (_) {
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

/* =========================
   HOME / HEALTH
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Mishwark Backend يعمل",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Mishwark Backend يعمل",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Mishwark Backend يعمل",
  });
});

/* =========================
   OTP
========================= */

function requestOtp(req, res) {
  const phone = phoneOf(req.body?.phone);

  if (phone.length < 10) {
    return res.status(400).json({
      error: "Invalid phone number",
    });
  }

  otps.set(phone, {
    code: "123456",
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  res.json({
    ok: true,
    phone,
    devCode: "123456",
    expiresInSeconds: 300,
  });
}

function verifyOtp(req, res) {
  const phone = phoneOf(req.body?.phone);
  const code = String(req.body?.code || "");
  const role =
    String(req.body?.role || "PASSENGER").toUpperCase();

  const otp = otps.get(phone);

  if (!otp) {
    return res.status(401).json({
      error: "OTP not requested",
    });
  }

  if (Date.now() > otp.expiresAt) {
    otps.delete(phone);

    return res.status(401).json({
      error: "OTP expired",
    });
  }

  if (code !== otp.code) {
    return res.status(401).json({
      error: "Invalid OTP",
    });
  }

  otps.delete(phone);

  let user = users.get(phone);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      phone,
      role: role === "DRIVER" ? "DRIVER" : "PASSENGER",
      createdAt: new Date().toISOString(),
    };

    users.set(phone, user);
  } else {
    user.role =
      role === "DRIVER" ? "DRIVER" : "PASSENGER";
  }

  const token = makeToken(user);

  res.json({
    token,
    user,
  });
}

/*
 * التطبيق يستخدم /auth/...
 * والنسخة القديمة من APK قد تستخدم /api/auth/...
 * لذلك نقبل الاثنين.
 */

app.post("/auth/request-otp", requestOtp);
app.post("/api/auth/request-otp", requestOtp);

app.post("/auth/verify-otp", verifyOtp);
app.post("/api/auth/verify-otp", verifyOtp);

/* =========================
   DEVICE TOKEN
========================= */

function deviceToken(req, res) {
  res.json({
    ok: true,
  });
}

app.post("/devices/token", auth, deviceToken);
app.post("/api/devices/token", auth, deviceToken);

/* =========================
   ROUTE ESTIMATE
========================= */

function distanceMeters(
  lat1,
  lng1,
  lat2,
  lng2
) {
  const R = 6371000;

  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;

  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) *
      Math.cos(p2) *
      Math.sin(dl / 2) ** 2;

  return Math.round(
    2 * R * Math.asin(Math.sqrt(a))
  );
}

app.post("/routes/estimate", (req, res) => {
  const origin = req.body?.origin;
  const destination = req.body?.destination;

  if (!origin || !destination) {
    return res.status(400).json({
      error: "origin and destination are required",
    });
  }

  const distance = distanceMeters(
    Number(origin.lat),
    Number(origin.lng),
    Number(destination.lat),
    Number(destination.lng)
  );

  const duration = Math.max(
    60,
    Math.round(distance / 8)
  );

  const fare = Math.max(
    15,
    Math.round(10 + distance / 1000 * 6)
  );

  res.json({
    distanceMeters: distance,
    durationSeconds: duration,
    polyline: null,
    estimatedFare: fare,
    currency: "EGP",
  });
});

app.post("/api/routes/estimate", (req, res) => {
  const origin = req.body?.origin;
  const destination = req.body?.destination;

  if (!origin || !destination) {
    return res.status(400).json({
      error: "origin and destination are required",
    });
  }

  const distance = distanceMeters(
    Number(origin.lat),
    Number(origin.lng),
    Number(destination.lat),
    Number(destination.lng)
  );

  const duration = Math.max(
    60,
    Math.round(distance / 8)
  );

  const fare = Math.max(
    15,
    Math.round(10 + distance / 1000 * 6)
  );

  res.json({
    distanceMeters: distance,
    durationSeconds: duration,
    polyline: null,
    estimatedFare: fare,
    currency: "EGP",
  });
});

/* =========================
   CREATE TRIP
========================= */

function createTrip(req, res) {
  const {
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
  } = req.body || {};

  if (
    !Number.isFinite(Number(pickupLat)) ||
    !Number.isFinite(Number(pickupLng)) ||
    !Number.isFinite(Number(destinationLat)) ||
    !Number.isFinite(Number(destinationLng))
  ) {
    return res.status(400).json({
      error: "Invalid coordinates",
    });
  }

  const distance = distanceMeters(
    Number(pickupLat),
    Number(pickupLng),
    Number(destinationLat),
    Number(destinationLng)
  );

  const fare = Math.max(
    15,
    Math.round(10 + distance / 1000 * 6)
  );

  const id = crypto.randomUUID();

  const trip = {
    id,
    passenger_id: req.user.sub,

    pickup_lat: Number(pickupLat),
    pickup_lng: Number(pickupLng),

    destination_lat: Number(destinationLat),
    destination_lng: Number(destinationLng),

    distance_meters: distance,
    estimated_fare: fare,
    final_fare: null,

    payment_method: "CASH",

    status: "SEARCHING_DRIVER",

    driver_id: null,
    driver_lat: null,
    driver_lng: null,

    rating: null,
    rating_comment: null,

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  trips.set(id, trip);

  res.status(201).json(trip);
}

app.post("/trips", auth, createTrip);
app.post("/api/trips", auth, createTrip);

/* =========================
   LIVE TRIP
========================= */

function liveTrip(req, res) {
  const trip = trips.get(req.params.id);

  if (!trip) {
    return res.status(404).json({
      error: "Trip not found",
    });
  }

  res.json(trip);
}

app.get("/trips/:id/live", auth, liveTrip);
app.get("/api/trips/:id/live", auth, liveTrip);

/* =========================
   MATCH DRIVER
========================= */

function matchDriver(req, res) {
  const trip = trips.get(req.params.id);

  if (!trip) {
    return res.status(404).json({
      error: "Trip not found",
    });
  }

  res.json({
    matched: false,
    message: "جاري البحث عن سائق",
    trip,
  });
}

app.post(
  "/trips/:id/match-driver",
  auth,
  matchDriver
);

app.post(
  "/api/trips/:id/match-driver",
  auth,
  matchDriver
);

/* =========================
   TRIP ACTION
========================= */

function tripAction(req, res) {
  const trip = trips.get(req.params.id);

  if (!trip) {
    return res.status(404).json({
      error: "Trip not found",
    });
  }

  const action = String(
    req.body?.action || ""
  ).toUpperCase();

  if (action === "CANCEL") {
    trip.status = "CANCELLED";
  } else if (action === "ACCEPT") {
    trip.status = "DRIVER_ACCEPTED";
    trip.driver_id = req.user.sub;
  } else if (action === "ARRIVING") {
    trip.status = "DRIVER_ARRIVING";
  } else if (action === "ARRIVED") {
    trip.status = "DRIVER_ARRIVED";
  } else if (action === "START") {
    trip.status = "TRIP_STARTED";
  } else if (action === "COMPLETE") {
    trip.status = "TRIP_COMPLETED";
  } else {
    return res.status(400).json({
      error: "Unsupported action",
    });
  }

  trip.updated_at = new Date().toISOString();

  res.json(trip);
}

app.post(
  "/trips/:id/action",
  auth,
  tripAction
);

app.post(
  "/api/trips/:id/action",
  auth,
  tripAction
);

/* =========================
   CASH PAYMENT
========================= */

function cashPayment(req, res) {
  const trip = trips.get(req.params.id);

  if (!trip) {
    return res.status(404).json({
      error: "Trip not found",
    });
  }

  trip.final_fare =
    trip.final_fare || trip.estimated_fare;

  trip.status = "COMPLETED";
  trip.updated_at = new Date().toISOString();

  res.json(trip);
}

app.post(
  "/trips/:id/cash-payment",
  auth,
  cashPayment
);

app.post(
  "/api/trips/:id/cash-payment",
  auth,
  cashPayment
);

/* =========================
   CASH PAYMENT ALTERNATIVE
========================= */

function cashPayment2(req, res) {
  const trip = trips.get(req.params.id);

  if (!trip) {
    return res.status(404).json({
      error: "Trip not found",
    });
  }

  if (Number.isFinite(
    Number(req.body?.finalFare)
  )) {
    trip.final_fare =
      Number(req.body.finalFare);
  }

  trip.status = "COMPLETED";
  trip.updated_at = new Date().toISOString();

  res.json(trip);
}

app.post(
  "/trips/:id/payment/cash",
  auth,
  cashPayment2
);

app.post(
  "/api/trips/:id/payment/cash",
  auth,
  cashPayment2
);

/* =========================
   RATING
========================= */

function rating(req, res) {
  const trip = trips.get(req.params.id);

  if (!trip) {
    return res.status(404).json({
      error: "Trip not found",
    });
  }

  const value = Number(
    req.body?.rating ?? req.body?.stars
  );

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 5
  ) {
    return res.status(400).json({
      error: "Rating must be between 1 and 5",
    });
  }

  trip.rating = value;
  trip.rating_comment =
    req.body?.comment || null;

  trip.updated_at = new Date().toISOString();

  res.json({
    ok: true,
    rating: value,
    trip,
  });
}

app.post(
  "/trips/:id/rating",
  auth,
  rating
);

app.post(
  "/api/trips/:id/rating",
  auth,
  rating
);

/* =========================
   DRIVER STATUS
========================= */

app.post(
  "/drivers/me/online",
  auth,
  (req, res) => {
    res.json({
      ok: true,
      online: !!req.body?.online,
    });
  }
);

app.post(
  "/api/drivers/me/online",
  auth,
  (req, res) => {
    res.json({
      ok: true,
      online: !!req.body?.online,
    });
  }
);

app.post(
  "/drivers/me/location",
  auth,
  (req, res) => {
    res.json({
      ok: true,
      lat: req.body?.lat ?? null,
      lng: req.body?.lng ?? null,
    });
  }
);

app.post(
  "/api/drivers/me/location",
  auth,
  (req, res) => {
    res.json({
      ok: true,
      lat: req.body?.lat ?? null,
      lng: req.body?.lng ?? null,
    });
  }
);

/* =========================
   404
========================= */

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
  });
});

/* =========================
   VERCEL / LOCAL
========================= */

if (require.main === module) {
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(
      `Mishwark Backend running on port ${port}`
    );
  });
}

module.exports = app;
