FROM node:22-alpine
WORKDIR /app
ARG API_INTERNAL_URL=http://localhost:8080
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci
COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm run build
EXPOSE 3000
CMD ["npm","run","start"]
