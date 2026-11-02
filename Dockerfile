# syntax=docker/dockerfile:1
# Build context: this folder (frontend/). Example:
#   docker build -t crm-web --build-arg VITE_API_URL= .
#   docker run -p 8080:80 -e API_UPSTREAM=https://api.example.com crm-web
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty = call /api on the same origin (proxied by nginx below). Set to call the API directly.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
ENV API_UPSTREAM=http://api:4000 \
    CSP_CONNECT_SRC=
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
