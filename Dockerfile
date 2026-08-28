FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.backend.json ./
COPY src/backend ./src/backend

# Backend compile only — skip UI devDependencies (vite/rolldown are Windows/Linux-specific).
RUN npm ci --omit=dev \
  && npm install --no-save typescript @types/node @types/express @types/pdfkit \
  && npm run build:backend

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist/backend ./dist/backend

RUN mkdir -p dist/backend/uploads

EXPOSE 8787

CMD ["node", "dist/backend/server.js"]
