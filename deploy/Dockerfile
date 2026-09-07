ARG EXALTO_PRODUCT_ORIGIN=https://seal.exalto.ai
FROM node:24-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG EXALTO_PRODUCT_ORIGIN
ENV VITE_PRODUCT_ORIGIN=$EXALTO_PRODUCT_ORIGIN
RUN npm run build

FROM caddy:2.10-alpine

ARG EXALTO_PRODUCT_ORIGIN
ENV EXALTO_PRODUCT_ORIGIN=$EXALTO_PRODUCT_ORIGIN

COPY Caddyfile.fly /etc/caddy/Caddyfile
COPY --from=builder /app/dist /usr/share/caddy

EXPOSE 80
