#!/bin/sh
set -eu
cd /home/site/wwwroot
exec node server/sync.cjs
