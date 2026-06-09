FROM node:20-alpine

# git + ca-certificates pour cloner depuis GitHub en HTTPS
RUN apk add --no-cache git ca-certificates && update-ca-certificates

WORKDIR /app

COPY webhook-server.js .
COPY deploy.sh .
RUN chmod +x deploy.sh

EXPOSE 9000

CMD ["node", "webhook-server.js"]
