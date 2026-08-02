# Builder
FROM node:24-slim AS builder
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Dependencies are installed before the source is copied so that editing a
# source file doesn't invalidate this layer and force a full reinstall
# (which includes recompiling native modules).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
# Done here rather than in the runner so the runtime image doesn't carry an
# extra layer just for a mode change; COPY --from preserves the bit.
RUN chmod +x ./entrypoint.sh

# Runner
FROM node:24-slim
ENV NODE_ENV=production

# A prebuilt static binary rather than Debian's `ffmpeg` package: that package
# hard-depends on libavdevice -> SDL2 -> the X11/mesa/cairo/rsvg stack, which is
# 463MB of libs that lib/ffmpeg-runner.js can never reach. This is 135MB.
# Tradeoff: pinned, so ffmpeg security updates are a manual bump here rather
# than something `apt-get` picks up on rebuild.
COPY --from=mwader/static-ffmpeg:7.1 /ffmpeg /usr/local/bin/ffmpeg

USER node
WORKDIR /home/node/app

COPY --chown=node:node --from=builder /app ./

EXPOSE 5555/tcp
CMD ["./entrypoint.sh"]
