# Nexus extraction worker for Azure Container Apps jobs.
# The build context is assembled by build-context.cjs from the deployed processExtraction bundle, unchanged.
FROM node:22-bookworm-slim
# Shared libraries the @sparticuz/chromium headless browser needs outside AWS Lambda / Cloud Functions.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
      libdrm2 libexpat1 libgbm1 libglib2.0-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
      libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
# NEXUS_EXECUTOR=azure makes the deployed code skip its hand-off to Azure (it is already on Azure).
ENV NODE_ENV=production NEXUS_EXECUTOR=azure GOOGLE_CLOUD_PROJECT=meridain-nexus GCLOUD_PROJECT=meridain-nexus \
    FIREBASE_CONFIG='{"projectId":"meridain-nexus","storageBucket":"meridain-nexus.firebasestorage.app"}' \
    GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-credentials.json
USER node
CMD ["node", "azure-runner.js"]
