const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver = {
  ...(config.resolver || {}),
  // Workaround for packages incompatible with package.json exports in RN 0.79/Metro
  unstable_enablePackageExports: false,
};

module.exports = config;