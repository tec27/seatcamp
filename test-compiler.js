// this is run before every test is run
require('babel-register')({
  // gotta do this here as babelrc affects both browser and server
  presets: [
    'node6',
  ],
})
