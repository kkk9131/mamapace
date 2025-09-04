/* Detox init */
const detox = require('detox');
const config = require('../.detoxrc');

jest.setTimeout(180000);

beforeAll(async () => {
  await detox.init(config, { initGlobals: false });
});

afterAll(async () => {
  await detox.cleanup();
});

