FROM python:3.4

ENV PHANTOMJS_VERSION 1.9.7

# https://hub.docker.com/r/cmfatih/phantomjs/~/dockerfile/
RUN \
  mkdir -p /srv/var && \
  wget -q --no-check-certificate -O /tmp/phantomjs-$PHANTOMJS_VERSION-linux-x86_64.tar.bz2 https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-$PHANTOMJS_VERSION-linux-x86_64.tar.bz2 && \
  tar -xjf /tmp/phantomjs-$PHANTOMJS_VERSION-linux-x86_64.tar.bz2 -C /tmp && \
  rm -f /tmp/phantomjs-$PHANTOMJS_VERSION-linux-x86_64.tar.bz2 && \
  mv /tmp/phantomjs-$PHANTOMJS_VERSION-linux-x86_64/ /srv/var/phantomjs && \
  ln -s /srv/var/phantomjs/bin/phantomjs /usr/bin/phantomjs

# As of 2016/08/02, this requires the Debian distributed version of
# python 2.7 to be located at /usr/bin/python. However, the official
# python 3 docker image we're using renames it, so we're going to
# temporarily rename it *back* so that this command succeeds. Oy.
RUN ln -s /usr/bin/python2.7.distrib /usr/bin/python && \
  curl -sL https://deb.nodesource.com/setup_5.x | bash - && \
  rm /usr/bin/python

# Note that we want postgresql-client so 'manage.py dbshell' works.
RUN apt-get update && \
  apt-get install -y nodejs postgresql-client

COPY package.json /node/

WORKDIR /node

RUN npm install

ENV PATH /node/node_modules/.bin:$PATH
ENV NODE_PATH /node/node_modules
ENV DDM_IS_RUNNING_IN_DOCKER yup

COPY requirements.txt /calc/

RUN pip install -r /calc/requirements.txt

# The following lines set up our container for being run in a
# cloud environment, where folder sharing is disabled. They're
# irrelevant for a local development environment, where the /calc
# directory will be superseded by a folder share.

COPY . /calc/

WORKDIR /calc

RUN gulp build

ENTRYPOINT ["python", "/calc/docker_django_management.py"]
