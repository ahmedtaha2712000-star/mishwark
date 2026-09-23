const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.url === "/") {
    res.end(JSON.stringify({
      app: "Mishwark",
      status: "online"
    }));
    return;
  }

  if (req.url === "/api/health") {
    res.end(JSON.stringify({
      status: "ok",
      message: "Mishwark Backend يعمل"
    }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({
    error: "Not Found"
  }));
});

server.listen(PORT, () => {
  console.log(`Mishwark Backend running on port ${PORT}`);
});
