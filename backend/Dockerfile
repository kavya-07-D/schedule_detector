FROM node:20-bookworm-slim

WORKDIR /usr/src/app

# Install OpenSSL required by Prisma
RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 10000

CMD ["npm", "start"]