/* global jQuery, window, document */

const $ = jQuery;

// The following feature detectors are ultimately pulled from Modernizr.

function browserSupportsDragAndDrop() {
  const div = document.createElement('div');
  return ('draggable' in div) || ('ondragstart' in div && 'ondrop' in div);
}

function browserSupportsFormData() {
  return 'FormData' in window;
}

function browserSupportsDataTransfer() {
  // Browsers that support FileReader support DataTransfer too.
  return 'FileReader' in window;
}

function browserSupportsAdvancedUpload() {
  return browserSupportsDragAndDrop() && browserSupportsFormData() &&
         browserSupportsDataTransfer();
}

function stopAndPrevent(event) {
  event.stopPropagation();
  event.preventDefault();
}

function activateUploadWidget($el) {
  const $input = $('input', $el);
  const self = {
    input: $input[0],
    isDegraded: false,
    file: null,
  };
  let dragCounter = 0;

  function setCurrentFilename(filename) {
    $('input', $el).nextAll().remove();

    const id = $('input', $el).attr('id');
    const current = $(
      '<div class="upload-current">' +
      '<div class="upload-filename"></div>' +
      '<div class="upload-changer">Not right? ' +
      '<label>Choose a different file</label> or drag and drop here.' +
      '</div></div>'
    );
    $('label', current).attr('for', id);
    $('.upload-filename', current).text(filename);
    $el.append(current);
  }

  function showInvalidFileMessage() {
    $('input', $el).nextAll().remove();

    const id = $('input', $el).attr('id');
    const err = $(
      '<div class="upload-error">' +
      '<div class="upload-error-message">Sorry, that type of file is not allowed.</div>' +
      'Please <label>choose a different file</label> or drag and drop one here.' +
      '</div></div>'
    );
    $('label', err).attr('for', id);
    $el.append(err);
  }

  function isFileValid(file) {
    const accepts = $input.attr('accept');
    if (!accepts || !accepts.length) {
      // nothing specified, so just return true
      return true;
    }
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const acceptsList = accepts.split(',').map((s) => s.trim().toLowerCase());
    for (const extOrType of acceptsList) {
      if (fileType === extOrType || fileName.lastIndexOf(extOrType,
        fileName.length - extOrType.length) !== -1) {
        return true;
      }
    }
    return false;
  }

  function setFile(file) {
    if (!file) { return; }
    if (!isFileValid(file)) {
      showInvalidFileMessage();
      return;
    }
    // else
    $input.trigger('changefile', file);
  }

  if ($input.data('upload')) {
    // We've already been uploadified!
    return;
  }

  $input.data('upload', self);

  if (!browserSupportsAdvancedUpload() ||
      $el[0].hasAttribute('data-force-degradation')) {
    $el.addClass('degraded');
    self.isDegraded = true;
    return;
  }

  // The content of the upload widget will change when the user chooses
  // a file, so let's make sure screen readers let users know about it.
  $el.attr('aria-live', 'polite');

  $el.on('dragenter', e => {
    stopAndPrevent(e);

    dragCounter++;
    $el.addClass('dragged-over');
  });
  $el.on('dragleave', () => {
    // http://stackoverflow.com/a/21002544/2422398
    if (--dragCounter === 0) {
      $el.removeClass('dragged-over');
    }
  });
  $el.on('dragover', stopAndPrevent);
  $el.on('drop', e => {
    stopAndPrevent(e);
    $el.removeClass('dragged-over');

    setFile(e.originalEvent.dataTransfer.files[0]);
  });

  $input.on('change', () => {
    setFile($input[0].files[0]);
  });

  $input.on('changefile', (e, file) => {
    self.file = file;
    $input.val('');
    setCurrentFilename(file.name);
  });
}

$.fn.uploadify = function uploadify() {
  this.each(function activate() {
    activateUploadWidget($(this));
  });
  return this;
};

$(document).ready(() => {
  $('.upload').uploadify();
});

$.support.advancedUpload = browserSupportsAdvancedUpload();
