FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

# Dev mode by default. We tried prod mode (`next build && next start`) for
# instant page loads, but the production build's rewrites manifest needs
# API_PROXY_TARGET at build time AND the .next anonymous-volume / source
# bind-mount interaction in docker-compose was fragile (the volume kept
# getting cleared on container recreate). The big win in dev mode is the
# font fix in globals.css — previously 9 font 404s per page were blocking
# render for 10-20s while the dev server recompiled. With fonts loading
# from a CDN, dev-mode cold-compile is ~5-8s on first visit, instant
# afterwards.
EXPOSE 3000

CMD ["npm", "run", "dev"]
