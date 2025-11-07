#!/bin/sh
set -e

corepack enable
yarn set version latest
yarn install
exec yarn dev