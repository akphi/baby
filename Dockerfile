FROM node:21-alpine as base

# This must be set to the same timezone as the client, else react server-side rendering will barf
# since some date/time calculation will be off so we have to hard-code it like this for now,
# See https://github.com/remix-run/remix/issues/2570

COPY . /app/home

WORKDIR /app/home

RUN apk add --no-cache --virtual .gyp python3 make g++
RUN npm install
RUN apk del .gyp

RUN npm run clean
RUN npm run build

# Workaround for a problem with remix not properly producing sourcemap in production mode
# See https://github.com/remix-run/remix/issues/8309
RUN npm run build:home-fix

ENV TZ=America/New_York
CMD npm run start
