const path = require("path");
const Module = require("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request === "react-native/package.json") {
    return path.resolve(__dirname, "node_modules/react-native/package.json");
  }
  return originalResolveFilename.apply(this, arguments);
};

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { 
  input: "./global.css",
  configPath: path.resolve(__dirname, "tailwind.config.js")
});
