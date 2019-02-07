import lint from 'mocha-eslint'

lint(['*.js', 'lib/**/*.js', 'test/**/*.js', 'client/**/*.js'], { formatter: 'compact' })
