#!/bin/bash

# -------------------------- Setup Color -----------------------------
# NOTE: must use `echo -e` to interpret the backslash escapes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No color

# ----------------------- Check Parameters --------------------------

if [[ -z "$TZ" ]]; then
  echo -e "${YELLOW}TZ is not set. Defaulted to 'America/New_York'${NC}"
  TZ="America/New_York"
fi

# ------------------------------- Run -------------------------------

docker run -d \
  --name home \
  --restart=unless-stopped \
  -e TZ=$TZ \
  -p 3000:3000 -p 3001:3001 -p 1880:1880 \
  -v `pwd`/../home-storage:/app/home-storage \
  home:local
