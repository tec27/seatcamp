// TODO(tec27): detect if in iojs and disable options that transpile things supported natively
require('babel/register', {
  loose: 'all',
})

require('./server')
