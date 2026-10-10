const packageJson = require("./package.json");

module.exports = () => {
  const IS_UAT = process.env.APP_ENV === 'uat';
  const appVersion = process.env.APP_VERSION || packageJson.version || "1.0.0";
  const buildNumber = process.env.APP_BUILD_NUMBER || "1";
  const versionCode = parseInt(buildNumber, 10) || 1;

  return {
    expo: {
      name: IS_UAT ? "Net Worth Manager (UAT)" : "Net Worth Manager",
      slug: "net-worth-manager",
      version: appVersion,
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "automatic",
      splash: {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#0B0F17"
      },
      ios: {
        supportsTablet: true,
        infoPlist: {
          ITSAppUsesNonExemptEncryption: false
        },
        bundleIdentifier: IS_UAT ? "com.nozel.networthmanager.uat" : "com.nozel.networthmanager",
        buildNumber: String(buildNumber)
      },
      android: {
        versionCode: versionCode,
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#0B0F17"
        },
        package: IS_UAT ? "com.nozel.networthmanager.uat" : "com.nozel.networthmanager"
      },
      web: {
        favicon: "./assets/favicon.png"
      },
      extra: {
        env: IS_UAT ? 'uat' : 'prod',
        eas: {
          projectId: "f1189fd3-3878-4806-b9ae-d358674e80d2"
        }
      },
      owner: "nozelrosario.org"
    }
  };
};
