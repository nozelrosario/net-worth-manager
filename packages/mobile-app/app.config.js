const packageJson = require("./package.json");

module.exports = () => {
  const appEnv = process.env.APP_ENV || "distribution";
  const IS_UAT = appEnv === "uat";
  const IS_DIST = appEnv === "distribution";
  const appVersion = process.env.APP_VERSION || packageJson.version || "1.0.0";
  const buildNumber = process.env.APP_BUILD_NUMBER || "1";
  const versionCode = parseInt(buildNumber, 10) || 1;

  const baseBundleId = IS_DIST
    ? "com.networthmanager.app"
    : process.env.APP_BUNDLE_ID || "com.networthmanager.app";
  const bundleIdentifier = IS_UAT ? `${baseBundleId}.uat` : baseBundleId;

  const extra = {
    env: appEnv,
    defaultAppUrl: IS_DIST ? "" : process.env.APP_URL || "",
  };

  if (!IS_DIST && process.env.EAS_PROJECT_ID) {
    extra.eas = {
      projectId: process.env.EAS_PROJECT_ID,
    };
  }

  const expoConfig = {
    name: IS_UAT ? "Net Worth Manager (UAT)" : "Net Worth Manager",
    slug: "net-worth-manager",
    scheme: "nwm",
    version: appVersion,
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0B0F17",
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      bundleIdentifier,
      buildNumber: String(buildNumber),
    },
    android: {
      versionCode,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0B0F17",
      },
      package: bundleIdentifier,
      permissions: ["CAMERA"],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow Net Worth Manager to scan QR codes for quick instance setup.",
        },
      ],
    ],
    extra,
  };

  if (!IS_DIST && process.env.EXPO_OWNER) {
    expoConfig.owner = process.env.EXPO_OWNER;
  }

  return { expo: expoConfig };
};
