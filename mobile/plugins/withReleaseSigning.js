const {
  withAppBuildGradle,
  createRunOncePlugin,
} = require("expo/config-plugins");

/**
 * Release APK signing - secrets/dlms-keystore.properties + dlms-release.keystore
 * (gitignored). Survives expo prebuild.
 */
function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes("dlms-keystore.properties")) {
      return config;
    }

    const propsBlock = `
// DLMS release signing (keystore lives in repo secrets/, never commit it)
def dlmsKeystorePropertiesFile = rootProject.file("../../secrets/dlms-keystore.properties")
def dlmsKeystoreProperties = new Properties()
if (dlmsKeystorePropertiesFile.exists()) {
    dlmsKeystoreProperties.load(new FileInputStream(dlmsKeystorePropertiesFile))
}
`;

    if (!contents.includes("dlmsKeystorePropertiesFile")) {
      contents = contents.replace(
        "android {",
        `${propsBlock}
android {`
      );
    }

    const releaseSigningConfig = `
        release {
            if (dlmsKeystorePropertiesFile.exists()) {
                keyAlias dlmsKeystoreProperties['keyAlias']
                keyPassword dlmsKeystoreProperties['keyPassword']
                storeFile rootProject.file(dlmsKeystoreProperties['storeFile'])
                storePassword dlmsKeystoreProperties['storePassword']
            }
        }`;

    contents = contents.replace(
      /signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\}/,
      (match) => `${match}${releaseSigningConfig}`
    );

    contents = contents.replace(
      /release\s*\{[^}]*signingConfig\s+signingConfigs\.debug/,
      (match) =>
        match.replace(
          "signingConfig signingConfigs.debug",
          "signingConfig dlmsKeystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug"
        )
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = createRunOncePlugin(
  withReleaseSigning,
  "with-dlms-release-signing",
  "1.0.0"
);
