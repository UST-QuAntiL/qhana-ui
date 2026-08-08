# specific node version tagged to prevent dockerfile from suddenly breaking (Angular 21 requires Node 20.19+/22.12+/24)
FROM node:24-slim AS builder

WORKDIR /app
COPY . /app

# use clean install to use exactly the locked dependencies (also speeds up install)
RUN npm clean-install && npm run build

# Actual docker container using output from builder
FROM nginx:stable-alpine

LABEL org.opencontainers.image.source="https://github.com/UST-QuAntiL/qhana-ui"

WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/dist/qhana-ui/ .

## add permissions for nginx user
RUN chown -R nginx:nginx /usr/share/nginx/html && chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# port is configured in nginx.conf (but must be >1000 for unpriviledged users)
EXPOSE 8080

# run as unpriviledged user nginx
USER nginx

# When the container starts, replace the env.js with values from environment variables
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/assets/env.js.template > /usr/share/nginx/html/assets/env.js && exec nginx -g 'daemon off;'"]
