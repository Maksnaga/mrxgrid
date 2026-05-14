FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /app

COPY webhook-server.js .
COPY deploy.sh .
RUN chmod +x deploy.sh

EXPOSE 9000

CMD ["node", "webhook-server.js"]
