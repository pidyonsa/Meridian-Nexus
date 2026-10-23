# Firestore -> Azure SQL sync job (Container Apps job job-nexus-sql-sync). Build context: azure-portal/.
#   az acr build -r acrnexusautop2fzlrpwgvno2 -t nexus-sql-sync:<tag> -f sync/Dockerfile .
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server/db.cjs server/db.cjs
COPY sync/collections.cjs sync/firestore.cjs sync/google.cjs sync/sql-store.cjs sync/run.cjs sync/
USER node
CMD ["node", "sync/run.cjs"]
