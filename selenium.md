# Running Selenium tests against a WebDriver server on a Docker host

## Terminal A: Set up a WebDriver server on your host

1. Get ChromeDriver:

   https://sites.google.com/a/chromium.org/chromedriver/downloads

2. Run it:

   ```
   ./chromedriver
   ```

## Terminal B: Start up Docker Compose

```
docker-compose up
```

## Terminal C: Make your WebDriver server available to Docker

```
ssh -R 9515:localhost:9515 root@calc.docker -p 8022 -N
```

The password is `screencast`.

## Terminal D: Run the Selenium tests

```
docker-compose run \
  -p 8001:8001 \
  -e LOCAL_TUNNEL_URL=http://calc.docker:8001 \
  -e DJANGO_LIVE_TEST_SERVER_ADDRESS=0.0.0.0:8001 \
  -e WEBDRIVER_URL=http://sshd:9515 \
  app py.test selenium_tests
```
