FROM node:20-alpine

WORKDIR /app

# Non-root user
RUN addgroup -S bot && adduser -S bot -G bot

# Copy lockfile first for deterministic install
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN chown -R bot:bot /app
USER bot

EXPOSE 3000
EXPOSE 8084

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8084/health || exit 1

CMD ["node", "src/index.js"]
