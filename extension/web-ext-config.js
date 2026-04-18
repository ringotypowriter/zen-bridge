module.exports = {
  sourceDir: '.',
  artifactsDir: './dist',
  build: {
    overwriteDest: true,
  },
  run: {
    firefox: '/Applications/Zen Browser.app/Contents/MacOS/zen',
    startUrl: ['about:debugging'],
  },
  sign: {
    apiKey: process.env.AMO_API_KEY,
    apiSecret: process.env.AMO_API_SECRET,
    id: 'zen-bridge@yachiyo.local',
  },
};
