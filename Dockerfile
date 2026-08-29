# syntax=docker/dockerfile:1.7

FROM node:22.23.2-alpine3.24 AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

RUN npm run build \
    && test -f dist/index.html

FROM nginxinc/nginx-unprivileged:1.31.4-alpine

USER root

COPY --chown=101:101 deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /tmp/branchscript-dist

RUN rm -rf /srv/branchscript /usr/share/nginx/html \
    && mkdir -p /srv/branchscript \
    && cp -a /tmp/branchscript-dist/. /srv/branchscript/ \
    && rm -rf /tmp/branchscript-dist \
    && chown -R 101:101 /srv/branchscript

USER 101:101

EXPOSE 8080

STOPSIGNAL SIGQUIT
