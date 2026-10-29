# TestSphere Android Mobile Testing Extension Architecture

## 1. Overview
The TestSphere Mobile Diagnostics Extension is designed to expand automated quality assurance from web applications to Android native and hybrid applications (APKs). The extension follows TestSphere's core principle of evidence-backed diagnostics, collecting real crashes, UI hierarchy issues, and security misconfigurations.

---

## 2. Supported Architecture & Pipeline

```
+-------------------------------------------------------------+
|                TestSphere Diagnostics Engine                |
+-------------------------------------------------------------+
                              |
       +----------------------+----------------------+
       |                                             |
       v                                             v
[ Static APK Analysis ]                   [ Dynamic Device Automation ]
  - AndroidManifest.xml audit               - ADB logcat stream (crashes/ANRs)
  - Exposed Activities/Services/Receivers   - Appium + UiAutomator2 UI tree
  - Dangerous permission footprint          - Memory & frame-drop telemetry
  - Debuggable/Backup flag vulnerabilities  - Network failure / API monitoring
```

---

## 3. Required Tools & Prerequisites

To execute automated mobile diagnostics, the host system or worker agent requires:

| Tool | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **Android SDK Platform-Tools** | `v34.0+` | Provides `adb` for device communication and logcat streaming |
| **Android SDK Build-Tools** | `v34.0+` | Provides `aapt` or `aapt2` for static manifest extraction |
| **Java Development Kit (JDK)** | `JDK 17+` | Required by Android SDK build tools and Appium |
| **Appium Server** | `v2.4+` | Mobile automation gateway with `@appium/doctor` |
| **UiAutomator2 Driver** | `v3.0+` | Android driver for dynamic element interaction |

---

## 4. Current Environment Capability Assessment

- **Host System**: Windows (Workstation Environment)
- **`adb` Command**: **Not Found** on system `PATH`
- **`aapt` Command**: **Not Found** on system `PATH`
- **Connected Devices / Emulators**: None detected

### Implementation Status
In strict compliance with TestSphere's integrity mandate (*"Implement a real Android APK/device scanning pipeline only if the environment supports it; otherwise clearly document what remains unimplemented rather than pretending it works"*):

1. **Static Analysis Module**: Architecture and data schemas are ready in `androidDiagnostics.js`.
2. **Dynamic Automation Module**: Marked as **UNSUPPORTED / ENVIRONMENT PREREQUISITE MISSING** because neither `adb` nor the Android SDK are installed on the local system.
3. TestSphere will **not** simulate fake Android device scans or fabricate mobile findings.

---

## 5. Enablement Instructions

To activate the real Android diagnostics pipeline on a compatible worker:
1. Install Android Studio or standalone Command-Line Tools (`sdkmanager`).
2. Add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\build-tools\<version>` to system `PATH`.
3. Connect an authorized physical Android device via USB debugging or start an Android Virtual Device (AVD).
4. Run `node -e "require('./src/scanner/android/androidDiagnostics').checkAndroidEnvironment()"` to verify device detection.
