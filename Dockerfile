# syntax=docker/dockerfile:1.7

FROM node:22.23.2-alpine3.24 AS build

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

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28.1-alpine

COPY --chown=101:101 deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --chown=101:101 --from=build /app/dist/. /srv/branchscript/

USER 101:101

EXPOSE 8080

STOPSIGNAL SIGQUIT
