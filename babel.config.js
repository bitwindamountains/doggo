// babel-preset-expo is the default; inline-import turns Drizzle's .sql migration files
// into strings at build time (for Metro and Jest alike).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
