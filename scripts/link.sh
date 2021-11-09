#!/bin/sh

echo $PWD

rm -rf node_modules/mocha-given || true
mkdir -p node_modules/mocha-given

cd node_modules/mocha-given

ln -s ../../package.json
ln -s ../../index.js
ln -s ../../lib

cd -
