FROM node:20-bookworm-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm installFROM node:20-bookworm-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 5000

CMD ["node", "dist/server.js"]

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 5000

CMD ["node", "dist/server.js"]
