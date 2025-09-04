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

  it('02-Messages', async () => {
    // Open sidebar from Home (long press on tab labeled "ホーム")
    await element(by.label('ホーム')).longPress();
    await element(by.label('メッセージ')).tap();
    await new Promise((r) => setTimeout(r, 1000));
    await device.takeScreenshot('02-messages');
  });

  it('03-Rooms', async () => {
    // Open sidebar again and navigate to Rooms
    await element(by.label('ホーム')).longPress();
    await element(by.label('ルーム')).tap();
    await new Promise((r) => setTimeout(r, 1000));
    await device.takeScreenshot('03-rooms');
  });

  it('04-AnonymousRoom', async () => {
    // Navigate to Profile tab ("あなた") then to RoomsList and open anonymous entry
    await element(by.label('あなた')).tap();
    await element(by.text('参加ルーム')).tap();
    await element(by.id('anonymous-room-entry')).tap();
    await new Promise((r) => setTimeout(r, 1200));
    await device.takeScreenshot('04-anonymous');
  });

  it('05-Settings', async () => {
    // Open sidebar and go to Settings
    await element(by.label('ホーム')).longPress();
    await element(by.label('設定')).tap();
    await new Promise((r) => setTimeout(r, 1000));
    await device.takeScreenshot('05-settings');
  });
});
