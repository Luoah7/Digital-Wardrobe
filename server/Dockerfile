FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production 2>/dev/null || npm install --production

COPY . .
RUN mkdir -p data uploads

EXPOSE 3000

CMD ["node", "src/index.js"]
