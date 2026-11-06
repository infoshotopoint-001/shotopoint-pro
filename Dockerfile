FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=5000 UPLOAD_DIR=/app/uploads
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/uploads && rm -rf /app/node_modules/.cache
EXPOSE 5000
CMD ["node", "server.js"]
