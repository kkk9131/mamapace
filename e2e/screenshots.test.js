describe('App Store Screenshots', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      languageAndLocale: { language: 'ja', locale: 'ja_JP' },
    });
    await device.setOrientation('portrait');
  });

  it('01-Home', async () => {
    // Give time for first screen to render
    await new Promise((r) => setTimeout(r, 1500));
    await device.takeScreenshot('01-home');
  });
});

