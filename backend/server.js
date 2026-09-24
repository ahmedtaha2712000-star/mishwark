const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "mishwark-demo-secret-change-before-production";

const users = new Map();
const otpStore = new Map();
const trips = new Map();

function normalizePhone(phone) {
  return String(phone || "")
    .trim()
    .replace(/[^\d+]/g, "");
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      phone: user.phone,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const token = header.substring(7);
    req.user = jwt.verify(token, JWT_SECRET);

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    next();
  };
}

function findTrip(id) {
  return trips.get(String(id));
}

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

function health(req, res) {
  res.json({
    status: "ok",
    message: "Mishwark Backend يعمل",
  });
}

app.get("/health", health);
app.get("/api/health", health);

/*
|--------------------------------------------------------------------------
| OTP
|--------------------------------------------------------------------------
*/

function requestOtp(req, res) {
  const phone = normalizePhone(req.body?.phone);

  if (!/^\+?\d{10,15}$/.test(phone)) {
    return res.status(400).json({
      error: "Invalid phone number",
    });
  }

  /*
   * Demo OTP
   * في النسخة التجريبية الكود ثابت:
   * 123456
   */
  otpStore.set(phone, {
    code: "123456",
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  return res.json({
    phone,
    expiresInSeconds: 300,
    devCode: "123456",
  });
}

function verifyOtp(req, res) {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code || "");
  const role =
    String(req.body?.role || "PASSENGER").toUpperCase() === "DRIVER"
      ? "DRIVER"
      : "PASSENGER";

  const otp = otpStore.get(phone);

  if (!otp || otp.expiresAt < Date.now()) {
    return res.status(401).json({
      error: "OTP expired or not found",
    });
  }

  if (code !== otp.code) {
    return res.status(401).json({
      error: "Invalid OTP",
    });
  }

  otpStore.delete(phone);

  let user = users.get(phone);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      phone,
      role,
      createdAt: new Date().toISOString(),
    };

    users.set(phone, user);
  } else {
    user.role = role;
  }

  const token = createToken(user);

  return res.json({
    token,
    user,
  });
}

/*
 * التطبيق الحالي يستخدم:
 * /auth/request-otp
 * /auth/verify-otp
 *
 * والـAPK الذي بُني بعنوان /api يستخدم:
 * /api/auth/request-otp
 * /api/auth/verify-otp
 *
 * لذلك نقبل الاثنين.
 */

app.post("/auth/request-otp", requestOtp);
app.post("/api/auth/request-otp", requestOtp);

app.post("/auth/verify-otp", verifyOtp);
app.post("/api/auth/verify-otp", verifyOtp);

/*
|--------------------------------------------------------------------------
| Auth Me
|--------------------------------------------------------------------------
*/

function me(req, res) {
  const user = [...users.values()].find((u) => u.id === req.user.sub);

  res.json({
    user: user || {
      id: req.user.sub,
      phone: req.user.phone,
      role: req.user.role,
    },
  });
}

app.get("/auth/me", auth, me);
app.get("/api/auth/me", auth, me);

/*
|--------------------------------------------------------------------------
| Devices
|--------------------------------------------------------------------------
*/

function saveDevice(req, res) {
  return res.json({
    ok: true,
  });
}

app.post("/devices/token", auth, saveDevice);
app.post("/api/devices/token", auth, saveDevice);

/*
|--------------------------------------------------------------------------
| Route Estimate
|--------------------------------------------------------------------------
*/

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;

  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;

  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) *
      Math.cos(p2) *
      Math.sin(dl / 2) ** 2;

  return Math.round(
    2 * R * Math.asin(Math.sqrt(a))
  );
}

function estimateRoute(req, res) {
  const origin = req.body?.origin;
  const destination = req.body?.destination;

  if (!origin || !destination) {
    return res.status(400).json({
      error: "origin and destination are required",
    });
  }

  const distance
