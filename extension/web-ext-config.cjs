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
    apiKey: process.env.WEB_EXT_API_KEY,
    apiSecret: process.env.WEB_EXT_API_SECRET,
    channel: 'unlisted',
  },
};
