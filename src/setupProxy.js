const createProxyMiddleware = require("http-proxy-middleware");
require("dotenv").config();

module.exports = function setupProxy(app) {
  app.use(
    createProxyMiddleware(["/login", "/callback", "/logout", "/checkAuth", "graphql"], {
      target: `http://localhost:${process.env.BACKEND_PORT}`,
      changeOrigin: true,
      logLevel: "debug",
    })
  );
};
