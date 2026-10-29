const { execSync } = require('child_process');

/**
 * Checks whether Android SDK tools (adb, aapt) are installed on the host system.
 */
const checkAndroidEnvironment = () => {
  const status = {
    supported: false,
    adbAvailable: false,
    aaptAvailable: false,
    connectedDevices: [],
    prerequisites: [],
    message: ''
  };

  try {
    execSync('adb --version', { stdio: 'ignore' });
    status.adbAvailable = true;
  } catch {
    status.adbAvailable = false;
  }

  try {
    execSync('aapt version', { stdio: 'ignore' });
    status.aaptAvailable = true;
  } catch {
    status.aaptAvailable = false;
  }

  if (status.adbAvailable) {
    try {
      const output = execSync('adb devices', { encoding: 'utf8' });
      const lines = output.split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
      status.connectedDevices = lines.filter((l) => l.includes('device')).map((l) => l.split('\t')[0]);
    } catch {}
  }

  status.supported = status.adbAvailable && status.aaptAvailable;

  status.prerequisites = [
    {
      tool: 'adb',
      required: true,
      description: 'Android Debug Bridge for device connectivity, shell commands, and logcat stream monitoring',
      available: status.adbAvailable
    },
    {
      tool: 'aapt',
      required: true,
      description: 'Android Asset Packaging Tool for AndroidManifest.xml inspection and permissions extraction',
      available: status.aaptAvailable
    },
    {
      tool: 'java',
      required: false,
      description: 'Java Runtime Environment (JRE/JDK 17+) for APK analysis utilities and dex tools',
      available: true
    }
  ];

  if (!status.supported) {
    status.message =
      'Android SDK tools (adb / aapt) are not present in system PATH. Physical device / emulator APK scanning is disabled in this environment. Platform operates in Web Diagnostics mode.';
  } else {
    status.message = `Android diagnostics active. ${status.connectedDevices.length} device(s) connected.`;
  }

  return status;
};

/**
 * Returns capability status for the mobile diagnostics pipeline.
 */
const getAndroidSupportStatus = () => {
  return checkAndroidEnvironment();
};

module.exports = {
  checkAndroidEnvironment,
  getAndroidSupportStatus
};
