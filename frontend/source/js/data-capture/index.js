
// entrypoint for data-capture
// this is where modules should be `require(...)`'d

require('babel-polyfill/dist/polyfill.js');
require('jquery-tablesort');

require('./tablesort');
require('./upload');
require('./step_1');
