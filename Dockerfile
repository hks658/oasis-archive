FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads/covers uploads/screenshots uploads/music

EXPOSE 3000
CMD ["node", "server.js"]
