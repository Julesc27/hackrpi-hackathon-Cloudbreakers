# Local dev only (docker-compose). Production runs on Vercel, which builds the frontend itself.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
