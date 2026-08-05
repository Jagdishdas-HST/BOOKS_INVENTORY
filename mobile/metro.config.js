const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require('path');

const config = getDefaultConfig(__dirname);

// Optimization: Use a persistent cache directory for Metro
config.cacheStores = [
  new (require('metro-cache')).FileStore({
    root: path.join(__dirname, '.joylo-metro-cache'),
  }),
];

module.exports = withNativeWind(config, { input: "./global.css" });
