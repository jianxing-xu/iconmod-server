#### Stage iconify-api-install #########################################################################################
FROM node:18-alpine AS iconify-api-install
ARG SRC_PATH

# Set work directory
WORKDIR /app
# Copy all code
COPY ./ ./app
# Build API
RUN npm i -g yarn
RUN yarn
RUN yarn run build

#### Stage RELEASE #####################################################################################################
FROM iconify-api-install AS RELEASE
ARG BUILD_VERSION
ARG BUILD_REF
ARG ICONIFY_API_VERSION

LABEL org.label-schema.build-date=${date} \
    org.label-schema.docker.dockerfile="Dockerfile" \
    org.label-schema.license="MIT" \
    org.label-schema.name="Iconify API" \
    org.label-schema.version=${BUILD_VERSION} \
    org.label-schema.description="Node.js version of api.iconify.design" \
    org.label-schema.url="https://github.com/iconify/api" \
    org.label-schema.vcs-ref=${BUILD_REF} \
    org.label-schema.vcs-type="Git" \
    org.label-schema.vcs-url="https://github.com/iconify/api"

RUN rm -rf /tmp/*

# Env variables
ENV ICONIFY_API_VERSION=$ICONIFY_API_VERSION

# Expose the listening port of Iconify API
EXPOSE 3000

# Add a healthcheck (default every 30 secs)
HEALTHCHECK CMD curl http://localhost:3030/ || exit 1

CMD ["npm", "run", "start"]
