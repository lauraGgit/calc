/* global $, window, document */

import 'document-register-element';

import * as supports from './feature-detection';

import { dispatchBubbly } from './custom-event';

const HAS_BROWSER_SUPPORT = supports.dragAndDrop() && supports.formData() &&
                            supports.dataTransfer();

class UploadInput extends window.HTMLInputElement {
  attachedCallback() {
    if ('isUpgraded' in this) {
      return;
    }

    this.isUpgraded = false;
    this._upgradedValue = null;
    if (this.getAttribute('type') !== 'file') {
      throw new Error('<input is="upload-input"> must have type "file".');
    }
    if (this.hasAttribute('multiple')) {
      throw new Error('<input is="upload-input"> does not currently ' +
                      'support the "multiple" attribute.');
    }
    dispatchBubbly(this, 'uploadinputready');
  }

  upgrade() {
    this.isUpgraded = true;
    $(this).on('change', () => {
      this.upgradedValue = this.files[0];
    });
    if (this.hasAttribute('required')) {
      // We don't want the browser to enforce the required attribute, because
      // if we programmatically set our file (e.g. via a drag-and-drop)
      // the browser will still think the file input is empty.

      this.removeAttribute('required');

      // Instead, we'll set our own custom validity manually, assuming the
      // user's browser supports HTML5 form validation.

      if (this.setCustomValidity) {
        this.setCustomValidity('Please choose a file.');
      }
    }
  }

  get upgradedValue() {
    return this._upgradedValue;
  }

  set upgradedValue(file) {
    if (!file) {
      return;
    }

    if (!this.isFileValid(file)) {
      dispatchBubbly(this, 'invalidfile');
      return;
    }

    this._upgradedValue = file;
    $(this).val('');

    if (this.setCustomValidity) {
      this.setCustomValidity('');
    }

    dispatchBubbly(this, 'changefile', {
      detail: file,
    });
  }

  isFileValid(file) {
    const accepts = $(this).attr('accept');
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
}

document.registerElement('upload-input', {
  extends: 'input',
  prototype: UploadInput.prototype,
});

class UploadWidget extends window.HTMLElement {
  _stopAndPrevent(event) {
    event.stopPropagation();
    event.preventDefault();
  }

  attachedCallback() {
    const $el = $(this);
    const $input = $('input', $el);

    if ($input.length !== 1 || $input.attr('is') !== 'upload-input') {
      throw new Error('<upload-widget> must contain exactly one ' +
                      '<input is="upload-input">.');
    }

    if ('isDegraded' in this) {
      return;
    }

    this.uploadInput = $input[0];
    this.isDegraded = false;

    let dragCounter = 0;

    const finishInitialization = () => {
      if (this.uploadInput instanceof UploadInput) {
        if (!this.isDegraded) {
          this.uploadInput.upgrade();
        }
        dispatchBubbly($el[0], 'uploadwidgetready');
      } else {
        $el.one('uploadinputready', finishInitialization);
      }
    };

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

    if (!HAS_BROWSER_SUPPORT || supports.isForciblyDegraded(this)) {
      $el.addClass('degraded');
      this.isDegraded = true;
      return finishInitialization();
    }

    $('label', $el)
      .after('<span aria-hidden="true"> or drag and drop here.</span>');

    // The content of the upload widget will change when the user chooses
    // a file, so let's make sure screen readers let users know about it.
    $el.attr('aria-live', 'polite');

    $el.on('dragenter', e => {
      this._stopAndPrevent(e);

      dragCounter++;
      $el.addClass('dragged-over');
    });
    $el.on('dragleave', () => {
      // http://stackoverflow.com/a/21002544/2422398
      if (--dragCounter === 0) {
        $el.removeClass('dragged-over');
      }
    });
    $el.on('dragover', this._stopAndPrevent.bind(this));
    $el.on('drop', e => {
      this._stopAndPrevent(e);
      $el.removeClass('dragged-over');

      this.uploadInput.upgradedValue = e.originalEvent.dataTransfer.files[0];
    });

    $input.on('invalidfile', showInvalidFileMessage);

    $input.on('changefile', e => {
      setCurrentFilename(e.originalEvent.detail.name);
    });

    return finishInitialization();
  }
}

UploadWidget.HAS_BROWSER_SUPPORT = HAS_BROWSER_SUPPORT;

document.registerElement('upload-widget', {
  prototype: UploadWidget.prototype,
});

exports.UploadInput = UploadInput;
exports.UploadWidget = UploadWidget;
