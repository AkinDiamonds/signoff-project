FROM node:20-alpine AS build
WORKDIR /app

# Manifests first: reused until package-lock.json changes. Every workspace
# manifest must exist because the root package.json lists them.
COPY package.json package-lock.json ./
COPY signoff/web/package.json ./signoff/web/package.json
COPY signoff/shop/package.json ./signoff/shop/package.json
COPY signoff/packages/ui/package.json ./signoff/packages/ui/package.json
COPY signoff/packages/api-client/package.json ./signoff/packages/api-client/package.json
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY signoff/packages ./signoff/packages
COPY signoff/web ./signoff/web
# web/src/app/mockFetch.ts imports ../../../fixtures/ui, so the fixtures must exist.
COPY signoff/fixtures ./signoff/fixtures

ARG VITE_API_URL=http://localhost:8000
ARG PUBLIC_SHOP_URL=http://localhost:5174
ENV VITE_API_URL=$VITE_API_URL \
    PUBLIC_SHOP_URL=$PUBLIC_SHOP_URL
RUN npm run -w @signoff/web build

FROM nginx:1.27-alpine
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/signoff/web/dist /usr/share/nginx/html
EXPOSE 80
