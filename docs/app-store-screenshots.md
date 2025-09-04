App Store screenshots via Detox

Outputs
- iPhone 6.7-inch: `screenshots/ios.ss.67/*/01-home.png`
- iPhone 5.5-inch: `screenshots/ios.ss.55/*/01-home.png`
- iPad Pro 12.9-inch: `screenshots/ios.ss.ipad129/*/01-home.png`

Prerequisites
- Xcode with listed simulators installed
  - iPhone 15 Pro Max (6.7")
  - iPhone 8 Plus (5.5")
  - iPad Pro (12.9-inch) (6th generation)
- Detox CLI: `npm i -g detox-cli` (or use npx)

Build and capture
- iPhone 6.7" 1290×2796
  - `npm run ss:ios:67:build`
  - `npm run ss:ios:67`

- iPhone 5.5" 1242×2208
  - `npm run ss:ios:55:build`
  - `npm run ss:ios:55`

- iPad Pro 12.9" 2048×2732
  - `npm run ss:ios:ipad129:build`
  - `npm run ss:ios:ipad129`

Notes
- The test launches the app and captures the first screen.
- If you need navigation to specific screens, add steps into `e2e/screenshots.test.js` before `takeScreenshot()`.
- Artifacts are stored under `screenshots/` as configured in `.detoxrc.js`.

