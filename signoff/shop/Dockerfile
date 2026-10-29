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
COPY signoff/shop ./signoff/shop

ARG VITE_API_URL=http://localhost:8000
ARG PUBLIC_SIGNOFF_URL=http://localhost:5173
ARG VITE_PAYPAL_CLIENT_ID=test
ENV VITE_API_URL=$VITE_API_URL \
    PUBLIC_SIGNOFF_URL=$PUBLIC_SIGNOFF_URL \
    VITE_PAYPAL_CLIENT_ID=$VITE_PAYPAL_CLIENT_ID
RUN npm run -w @signoff/shop build

FROM nginx:1.27-alpine
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/signoff/shop/dist /usr/share/nginx/html
EXPOSE 80
