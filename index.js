require('babel/register')({
  // gotta do this here as babelrc affects both browser and server
  blacklist: [
    'es6.arrowFunctions',
    'es6.blockScoping',
    'es6.constants',
    'es6.classes',
    'es6.forOf',
    'es6.templateLiterals',
  ],
})
require('./server')
