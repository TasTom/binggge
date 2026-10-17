FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Le navigateur appelle Nginx sur la même origine, qui transmet /api à Express.
ENV VITE_API_URL=/api
ENV VITE_BASE_PATH=/
RUN npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
