FROM node:21-alpine as base

COPY . /app/home

WORKDIR /app/home

RUN npm install
RUN npm run clean
RUN npm run build

# This must be set to the same timezone as the client, else react server-side rendering will barf
# since some date/time calculation will be off so we have to hard-code it like this for now,
# See https://github.com/remix-run/remix/issues/2570
ENV TZ=America/New_York
CMD npm run start
