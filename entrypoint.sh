#!/usr/bin/env sh
set -e

# Honcho が Procfile を読んで web と worker を並列起動します
exec honcho start -f /app/Procfile
