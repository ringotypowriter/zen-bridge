const config = {
  sourceDir: '.',
  artifactsDir: './dist',
  build: {
    overwriteDest: true,
  },
  run: {
    firefox: '/Applications/Zen Browser.app/Contents/MacOS/zen',
    startUrl: ['about:debugging'],
  },
};

if (process.env.WEB_EXT_API_KEY && process.env.WEB_EXT_API_SECRET) {
  config.sign = {
    apiKey: process.env.WEB_EXT_API_KEY,
    apiSecret: process.env.WEB_EXT_API_SECRET,
    channel: 'unlisted',
  };
}

module.exports = config;
