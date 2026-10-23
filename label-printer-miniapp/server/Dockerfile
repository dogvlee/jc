FROM node:24.17.0-alpine
WORKDIR /app
COPY --chown=node:node package.json *.js ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=8787
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "index.js"]
