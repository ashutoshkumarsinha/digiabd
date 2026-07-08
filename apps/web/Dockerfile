FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /usr/share/caddy

EXPOSE 80
