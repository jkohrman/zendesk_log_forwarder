FROM node:6.3.1

RUN mkdir -p /app
WORKDIR /app

COPY package.json /app/
RUN npm install --only=production
COPY config /app/config
COPY lib /app/lib
COPY app.js /app
COPY log_forwarder.js /app

CMD [ "npm", "start" ]
