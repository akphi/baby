const path = require("path");
require("dotenv").config();

// See https://nodered.org/docs/user-guide/runtime/configuration
module.exports = {
  flowFile: path.resolve(__dirname, "../home-storage/zigbee-flows.json"),
  flowFilePretty: true,
  userDir: path.resolve(__dirname, "../home-storage/.node-red/"),
  uiPort: 1880,
  uiHost: "0.0.0.0",
  apiMaxLength: "50mb",
  logging: {
    console: {
      level: "info",
      metrics: false,
      audit: false,
    },
  },
  exportGlobalContextKeys: false,
  functionExternalModules: true,
  functionTimeout: 0,
  debugMaxLength: 1000,
  mqttReconnectTime: 15000,
  serialReconnectTime: 15000,
};
