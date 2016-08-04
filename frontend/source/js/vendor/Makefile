all: jquery.min.js jquery.min.map

jquery.min.js:
	curl -s http://code.jquery.com/jquery.min.js > $@

jquery.min.map: jquery.min.js
	uglifyjs --comments all --source-map $@ $< > /dev/null

clean:
	rm -f jquery.min.*
