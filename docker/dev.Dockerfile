FROM node:24.22.1-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Версия должна совпадать с packageManager в package.json
RUN npm install -g pnpm@12.15.0 \
  && git config --system --add safe.directory /app

WORKDIR /app
