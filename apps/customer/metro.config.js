const path = require("path");
const Module = require("module");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request === "react-native/package.json") {
    try {
      return require.resolve("react-native/package.json", { paths: [projectRoot, monorepoRoot] });
    } catch (e) {
      // fallback if not found
    }
  }
  return originalResolveFilename.apply(this, arguments);
};

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
