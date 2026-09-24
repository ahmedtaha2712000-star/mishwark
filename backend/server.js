const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));

const JWT_SECRET =
  process.env.JWT_SECRET || "mishwark-demo-secret";

/*
|--------------------------------------------------------------------------
| بيانات مؤقتة
|--------------------------------------------------------------------------
| ملاحظة: البيانات محفوظة في الذاكرة حاليًا.
| عند إعادة تشغيل الخادم قد تختفي.
|--------------------------------------------------------------------------
*/

const users = new Map();
const otps = new Map();
const trips = new Map();
const drivers = new Map();

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function phoneOf(value) {
  return String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");
}

function normalizePhone(value) {
  let phone = phoneOf(value);

  if (phone.startsWith("01") && phone.length === 11) {
    phone = "+20" + phone.substring(1);
  }

  if (phone.startsWith("20") && !phone.startsWith("+")) {
    phone = "+" + phone;
  }

  return phone;
}

function makeToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      phone: user.phone,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function createToken(user) {
  return makeToken(user);
}

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const token = header.substring(7);

    req.user = jwt.verify(token,
