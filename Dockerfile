FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY index.js ./
COPY src ./src
COPY test ./test
RUN npm test && npm run check

ENV NODE_ENV=production

CMD ["npm", "start"]
