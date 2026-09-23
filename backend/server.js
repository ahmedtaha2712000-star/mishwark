const http = require("http");

const PORT = process.env.PORT || 3000;

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
  ],

  trips: [
    {
      id: "DEMO-2026-001",
      from: "قويسنا",
      to: "شبين الكوم",
      price: 95,
      status: "SEARCHING_DRIVER"
    },
    {
      id: "MW-002",
      from: "القاهرة",
      to: "مدينة نصر",
      price: 85,
      status: "DRIVER_ARRIVING"
    }
  ]
};

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return;
  }

  if (req.url === "/") {
    sendJson(res, 200, {
      app: "Mishwark",
      status: "online"
    });
    return;
  }

  if (req.url === "/api/health") {
    sendJson(res, 200, {
      status: "ok",
      message: "Mishwark Backend يعمل"
    });
    return;
  }

  if (req.url === "/api/admin/dashboard") {
    sendJson(res, 200, {
      driversCount: dashboardData.drivers.length,
      passengersCount: dashboardData.passengers.length,
      todayTrips: dashboardData.trips.length,
      activeTrips: dashboardData.trips.filter(
        (trip) =>
          trip.status !== "COMPLETED" &&
          trip.status !== "CANCELLED"
      ).length,
      drivers: dashboardData.drivers,
      passengers: dashboardData.passengers,
      trips: dashboardData.trips
    });
    return;
  }

  if (req.url === "/api/admin/drivers") {
    sendJson(res, 200, dashboardData.drivers);
    return;
  }

  if (req.url === "/api/admin/passengers") {
    sendJson(res, 200, dashboardData.passengers);
    return;
  }

  if (req.url === "/api/admin/trips") {
    sendJson(res, 200, dashboardData.trips);
    return;
  }

  sendJson(res, 404, {
    error: "Not Found"
  });
});

server.listen(PORT, () => {
  console.log(`Mishwark Backend running on port ${PORT}`);
});
