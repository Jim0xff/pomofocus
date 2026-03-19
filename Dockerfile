FROM node:23.3.0

WORKDIR /app

RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libnspr4 \
    libxss1 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    chromium \
    && rm -rf /var/lib/apt/lists/*

COPY . ./
RUN npm install
RUN npm run compile
CMD ["node", "./dist/index.js"]
