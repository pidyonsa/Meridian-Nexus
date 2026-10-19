FROM node:22-bookworm-slim
ENV NODE_ENV=production GOOGLE_CLOUD_PROJECT=meridain-nexus GCLOUD_PROJECT=meridain-nexus GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-credentials.json
WORKDIR /app
COPY attendance/package.json attendance/package-lock.json attendance/
COPY refresh/package.json refresh/package-lock.json refresh/
RUN cd attendance && npm ci --omit=dev --no-audit --no-fund && cd ../refresh && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY . .
RUN node -e "require('node:module').createRequire('/app/refresh/index.cjs')('firebase-admin/app')"
USER node
CMD ["node","publisher-runner.cjs"]
