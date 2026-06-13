FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/llm/package.json packages/llm/
COPY packages/core/package.json packages/core/
COPY packages/engine/package.json packages/engine/
COPY packages/cli/package.json packages/cli/
COPY packages/extension/package.json packages/extension/
COPY apps/web/package.json apps/web/
COPY scripts/ scripts/
COPY patches/ patches/

RUN apt-get update && apt-get install -y \
  libatomic1 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
  && rm -rf /var/lib/apt/lists/*

RUN rm -f package-lock.json && npm install && npx playwright install chromium

COPY . .
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
