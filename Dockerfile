# syntax=docker/dockerfile:1.7

FROM node:22.23.2-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json vite.config.ts vitest.config.ts index.html ./
COPY app ./app
COPY blog ./blog
COPY faq ./faq
COPY public ./public
COPY examples ./examples
COPY src ./src

RUN npm run build \
    && test -f dist/index.html

FROM nginxinc/nginx-unprivileged:1.28.1-alpine

USER root

COPY --chown=101:101 deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /tmp/branchscript-dist

RUN rm -rf /srv/branchscript /usr/share/nginx/html \
    && mkdir -p /srv/branchscript \
    && cp -a /tmp/branchscript-dist/. /srv/branchscript/ \
    && rm -rf /tmp/branchscript-dist \
    && chown -R 101:101 /srv/branchscript

USER 101:101

EXPOSE 8080

STOPSIGNAL SIGQUIT
