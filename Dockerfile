FROM node:21-bookworm-slim

COPY . /app/home
WORKDIR /app/home

RUN npm install
RUN npm run build
RUN touch /app/home/build/index.js.map && echo "{\"version\": 3, \"sources\": [], \"sourcesContent\": [], \"mappings\": \"\", \"names\": []}" > /app/home/build/index.js.map

CMD npm start
