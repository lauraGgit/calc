This directory contains a copy of the runner.js file from
qunit-phantomjs-runner:

    https://github.com/jonkemp/qunit-phantomjs-runner

We decided to simply copy the file instead of using `npm install` because
locating the `node_modules` directory was made non-trivial by the following PR:

    https://github.com/18F/calc/pull/373

Combined with the fact that qunit-phantomjs-runner is small and doesn't change
often, we figured it'd be OK to include it in the repository.
