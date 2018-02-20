FROM ubuntu:14.04

# variavel para desabilitar interatividade do apt-get
ENV DEBIAN_FRONTEND noninteractive

# update
RUN apt-get update --fix-missing && \
apt-get install -y wget && \
apt-get update && \
apt-get install -y curl && \
apt-get update

# instala ffmpeg
RUN apt-get update --fix-missing && \
apt-get install -y software-properties-common && \
add-apt-repository -y ppa:mc3man/trusty-media && \
apt-get update --fix-missing && \
apt-get install -y ffmpeg

# instala nodejs e npm
ENV NODE_VERSION 8.9.4
RUN curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
  && tar -xzf "node-v$NODE_VERSION-linux-x64.tar.gz" -C /usr/local --strip-components=1 \
  && rm "node-v$NODE_VERSION-linux-x64.tar.gz"

# instala python para o node-gyp utilizado pelo bunyan
RUN apt-get update && \
apt-get install -y python2.7

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# EXPOSE 8080

CMD [ "npm", "start" ]
