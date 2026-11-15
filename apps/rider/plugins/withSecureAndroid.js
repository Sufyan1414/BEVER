// Hardens the generated AndroidManifest:
//  - allowBackup=false: stops `adb backup` / cloud backup from copying the app's private data (session tokens)
//  - usesCleartextTraffic=false: refuses plain http:// traffic
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withSecureAndroid(config) {
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application && c.modResults.manifest.application[0];
    if (app) {
      app.$['android:allowBackup'] = 'false';
      app.$['android:usesCleartextTraffic'] = 'false';
      app.$['android:fullBackupContent'] = 'false';
    }
    return c;
  });
};
