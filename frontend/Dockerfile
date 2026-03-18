# ──────────────────────────────────────────────
# Stage 1: Build do frontend com Vite
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# VITE_API_URL vazio: o Nginx trata o proxy /api → backend
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: Servir com Nginx
# ──────────────────────────────────────────────
FROM nginx:alpine

# Instala gettext para o envsubst
RUN apk add --no-cache gettext

# Remove a config padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia a config como template (será processada pelo envsubst no arranque)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copia os arquivos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia páginas de erro personalizadas
COPY error_pages/50x.html /usr/share/nginx/html/50x.html
COPY error_pages/404.html /usr/share/nginx/html/404.html

EXPOSE 443

# Valores por defeito caso as variáveis não sejam passadas
ENV BACKEND_HOST=api
ENV BACKEND_PORT=3000

# Script de arranque: substitui variáveis no template e inicia o Nginx
# NOTA: as variáveis são escapadas com \ para evitar expansão prematura pelo shell
CMD ["/bin/sh", "-c", \
  "envsubst '$BACKEND_HOST $BACKEND_PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -t && nginx -g 'daemon off;'"]
