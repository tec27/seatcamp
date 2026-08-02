#!/bin/sh
# exec so node replaces this shell rather than running as its child -- otherwise
# SIGTERM from `docker stop` is delivered to sh, which doesn't forward it, and
# node never gets a chance to shut down cleanly.
exec node ./index.js
