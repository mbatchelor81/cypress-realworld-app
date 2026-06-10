/*
 * Server bootstrap.
 *
 * Kept as a CommonJS module because the backend is executed via ts-node in
 * CommonJS mode, where top-level await is not available. The Express app is
 * defined and exported from ./app; here we only resolve the port and listen.
 */
const app = require("./app").default;
const { getBackendPort } = require("../src/utils/portUtils");

getBackendPort().then((port: number) => {
  app.listen(port);
});
