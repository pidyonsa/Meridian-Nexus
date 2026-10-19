# Nexus scheduled functions on Azure Container Apps jobs. Build context from build-context.cjs: the deployed Google
# bundles, unchanged, in fns/<set>/, each installed from its own lock file.
FROM node:22-bookworm-slim
WORKDIR /app
COPY fns/core/package.json fns/core/package-lock.json fns/core/
COPY fns/scheduler/package.json fns/scheduler/package-lock.json fns/scheduler/
COPY fns/chat/package.json fns/chat/package-lock.json fns/chat/
COPY fns/support/package.json fns/support/package-lock.json fns/support/
RUN for d in core scheduler chat support; do (cd fns/$d && npm ci --omit=dev --no-audit --no-fund) || exit 1; done \
    && npm cache clean --force
COPY . .
ENV NODE_ENV=production GOOGLE_CLOUD_PROJECT=meridain-nexus GCLOUD_PROJECT=meridain-nexus \
    FIREBASE_CONFIG='{"projectId":"meridain-nexus","storageBucket":"meridain-nexus.firebasestorage.app"}' \
    GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-credentials.json
USER node
CMD ["node", "scheduled-runner.cjs"]
