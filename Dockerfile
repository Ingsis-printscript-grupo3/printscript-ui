# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Evitar la descarga innecesaria del binario pesado de Cypress en Alpine durante la compilacion
ENV CYPRESS_INSTALL_BINARY=0

# Las dependencias primero para aprovechar cache de Docker
COPY package.json package-lock.json ./
RUN npm ci

# Variables de entorno para build de Vite
ARG VITE_API_URL
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG BACKEND_URL
ARG FRONTEND_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV BACKEND_URL=$BACKEND_URL
ENV FRONTEND_URL=$FRONTEND_URL

# Copiar el codigo fuente y compilar
COPY . .
RUN npm run build

# Stage 2: Web Server
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Limpiar index.html por defecto de nginx, conservando 50x.html
RUN rm -f /usr/share/nginx/html/index.html

# Copiar el build compilado
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuracion de Nginx para SPA (React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
