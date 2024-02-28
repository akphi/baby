FROM node:21-alpine as base

COPY . /app/home

WORKDIR /app/home

# For alerting sounds outside of Docker using PulseAudio via TCP
RUN apk add pulseaudio pulseaudio-utils

# This must be set to the same timezone as the client, else react server-side rendering will barf
# since some date/time calculation will be off so we have to hard-code it like this for now,
# See https://github.com/remix-run/remix/issues/2570
# See https://www.jacobparis.com/content/remix-ssr-dates
#
# Handling for timezone is definitely not a trivial topic and we should explore more later
RUN apk add tzdata

RUN npm install
RUN npm run clean
RUN npm run build

# Force rewrite the timezone to be accomodate for restart as ln -s will error out if file already exists
CMD ln -sf /usr/share/zoneinfo/$TZ /etc/localtime && \
    npm run start
