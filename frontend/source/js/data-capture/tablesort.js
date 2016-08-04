/* global jQuery, document */

const $ = jQuery;
const sortableTables = document.querySelectorAll('.table-sortable');

$(document).ready(() => {
  for (const table of sortableTables) {
    const $table = $(table);
    $table.tablesort();

    // Floats should be sorted as numbers, not strings
    $('.js-float', $table).data('sortBy', (th, td) => parseFloat(td.text()));

    // Don't sort ints as strings, either
    $('.js-int', $table).data('sortBy', (th, td) => parseInt(td.text(), 10));

    // Sort by default column, if present
    $table.data('tablesort').sort($('.js-default-sort', $table));
  }
});
