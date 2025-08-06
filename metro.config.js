const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add support for .bin and .wav assets
config.resolver.assetExts.push("bin", "wav");

module.exports = config;
