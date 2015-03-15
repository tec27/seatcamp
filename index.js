// TODO(tec27): detect if in iojs and disable options that transpile things supported natively
function isIojs() {
  try {
    eval("(function*(){})");
    return true;
  } catch(err) {
    return false;
  }
}

var blacklist = !isIojs() ? [] : [
  'es6.blockScoping',
  'es6.constants',
  'es6.templateLiterals',
  'regenerator',
]

require('babel/register', {
  loose: 'all',
  blacklist: blacklist
})

require('./server')
