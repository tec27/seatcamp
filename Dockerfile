# Builder
FROM node:18-alpine as builder
RUN apk add --no-cache python3 make g++ git

WORKDIR /app
COPY . .
ENV NODE_ENV=production
RUN npm install

# Runner
FROM node:18-alpine
ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg bash

USER node
WORKDIR /home/node/app

COPY --chown=node:node --from=builder /app ./
RUN chmod +x ./entrypoint.sh

EXPOSE 5555/tcp
CMD ./entrypoint.sh
