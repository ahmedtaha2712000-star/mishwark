const http = require("http");

const PORT = process.env.PORT || 3000;

/* =========================
   بيانات تجريبية
========================= */

const dashboardData = {
  drivers: [
    {
      name: "محمد أحمد",
      car: "هيونداي إلنترا",
      rating: 4.9,
      status: "متصل"
    },
    {
      name: "أحمد محمود",
      car: "كيا سيراتو",
      rating: 4.8,
      status: "متصل"
    },
    {
      name: "محمود علي",
      car: "تويوتا كورولا",
      rating: 4.7,
      status: "غير متصل"
    }
  ],

  passengers: [
    {
      name: "أحمد طه",
      status: "نشط",
      trips: 24
    },
    {
      name: "محمد علي",
      status: "نشط",
      trips: 11
    }
  ]
};

/* =========================
   تخزين مؤقت
========================= */

const users = new Map();
const trips = new Map();

let tripCounter = 1;

/* =========================
   Helpers
========================= */

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, {
    error: message
  });
}

function getToken(req) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  return auth.substring(7);
}

function getUserFromToken(req) {
  const token = getToken(req);

  if (!token) {
    return null;
  }

  for (const user of users.values()) {
    if (user.token === token) {
      return user;
    }
  }

  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

/* =========================
   Auth
========================= */

async function requestOtp(req, res) {
  const body = await readBody(req);

  const phone = String(body.phone || "").trim();

  if (!phone) {
    return sendError(
      res,
      400,
      "رقم الهاتف مطلوب"
    );
  }

  users.set(phone, {
    phone,
    role: null,
    otp: "123456",
    token: null
  });

  sendJson(res, 200, {
    success: true,
    message: "تم تجهيز رمز التحقق",
    devCode: "123456"
  });
}

async function verifyOtp(req, res) {
  const body = await readBody(req);

  const phone = String(body.phone || "").trim();
  const code = String(body.code || "").trim();
  const role = String(body.role || "PASSENGER").trim();

  if (!phone) {
    return sendError(
      res,
      400,
      "رقم الهاتف مطلوب"
    );
  }

  if (code !== "123456") {
    return sendError(
      res,
      401,
      "رمز التحقق غير صحيح"
    );
  }

  let user = users.get(phone);

  if (!user) {
    user = {
      phone,
      otp: "123456",
      token: null
    };
  }

  user.role = role;
  user.token =
    "mishwark-" +
    role.toLowerCase() +
    "-" +
    Date.now();

  users.set(phone, user);

  sendJson(res, 200, {
    success: true,
    token: user.token,
    role: user.role,
    phone: user.phone
  });
}

/* =========================
   إنشاء رحلة
========================= */

async function createTrip(req, res) {
  const user = getUserFromToken(req);

  if (!user) {
    return sendError(
      res,
      401,
      "يجب تسجيل الدخول أولاً"
    );
  }

  const body = await readBody(req);

  const pickupLat = Number(body.pickupLat);
  const pickupLng = Number(body.pickupLng);
  const destinationLat = Number(body.destinationLat);
  const destinationLng = Number(body.destinationLng);

  if (
    !Number.isFinite(pickupLat) ||
    !Number.isFinite(pickupLng) ||
    !Number.isFinite(destinationLat) ||
    !Number.isFinite(destinationLng)
  ) {
    return sendError(
      res,
      400,
      "بيانات الموقع غير صحيحة"
    );
  }

  const id =
    "MW-" +
    String(tripCounter++).padStart(4, "0");

  const trip = {
    id,

    passengerPhone: user.phone,

    pickup: {
      lat: pickupLat,
      lng: pickupLng
    },

    destination: {
      lat: destinationLat,
     
