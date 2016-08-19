/* global jQuery, window */

const $ = jQuery;

let $ariaAlerts = null;

let delegate = {
  redirect(url) {
    window.location = url;
  },
  alert(msg) {
    // TODO: Be more user-friendly here.
    window.alert(msg);   // eslint-disable-line no-alert
  },
};

function getForm() {
  return $('[data-ajaxform]')[0];
}

function replaceForm(html) {
  // Replace the form and bind it.
  $(getForm()).replaceWith(html);

  // Animate the new form so the user notices it.
  // TODO: Consider using a CSS class w/ a transition or animation instead.
  $(getForm()).hide().fadeIn();
}

function initAriaAlerts() {
  if (!$ariaAlerts) {
    $ariaAlerts = $('<div role="alert" class="sr-only"></div>');
    $ariaAlerts.prependTo('body');
  }
  $ariaAlerts.empty();
}

function shutdownAriaAlerts() {
  if ($ariaAlerts) {
    $ariaAlerts.remove();
    $ariaAlerts = null;
  }
}

function bindForm() {
  const form = getForm();
  const $upload = $('.upload', form);
  const $fileInput = $('input[type=file]', form);
  const $submit = $('button[type=submit]', form);

  if (!form) {
    return null;
  }

  initAriaAlerts();

  $upload.uploadify();

  const upload = $fileInput.data('upload');
  const self = { form, upload, $upload, $fileInput, $submit, $ariaAlerts };

  if (!upload) {
    // Presently we require an ajaxform to contain exactly one
    // upload widget; we'd like to change this at some point in the
    // future, but for now we'll make our expectations explicit.
    throw new Error('ajaxform must contain an upload widget');
  }

  if (!$submit.length) {
    throw new Error('ajaxform must contain a <button type="submit">');
  }

  // This is mostly just for test suites to use.
  $('form').data('ajaxform', self);

  // Disable the submit button until a file is selected.
  $submit.prop('disabled', true);

  // In the case of a degraded upload, only the 'change' event is fired.
  // When we have a fully functional drag-n-drop upload, 'changefile' is
  // fired on drop, while 'change' is fired on normal file browser selection.
  // So, we need to listen to both events and reenable the submit button
  // on either.
  const enableSubmit = () => $submit.prop('disabled', false);
  $fileInput.on('changefile', enableSubmit);
  $fileInput.on('change', enableSubmit);

  $(form).on('submit', (e) => {
    if (upload.isDegraded) {
      // The upload widget is degraded; we should assume the browser has
      // minimal HTML5 support and just let the user submit the form manually.
    } else {
      e.preventDefault();

      const formData = new window.FormData();

      // IE11 doesn't support FormData.prototype.delete(), so we need to
      // manually construct the FormData ourselves (we used to have
      // the browser construct it for us, and then replace the file).
      for (let i = 0; i < form.elements.length; i++) {
        const el = form.elements[i];

        if (el.name === $fileInput.attr('name') && upload.file) {
          // It's possible that the user may have dragged-and-dropped a
          // file to our upload widget, in which case the actual
          // file <input> element won't contain what we want. So we'll
          // add what the file the upload widget says we need to upload.
          formData.append($fileInput.attr('name'), upload.file);
        } else {
          formData.append(el.name, el.value);
        }
      }

      const req = $.ajax(form.action, {
        processData: false,
        contentType: false,
        data: formData,
        method: form.method,
      });

      $(form).addClass('submit-in-progress');

      $ariaAlerts.empty();

      req.done((data) => {
        if (data.form_html) {
          replaceForm(data.form_html);
          const newForm = bindForm();
          if (newForm) {
            const newAlerts = $('[role="alert"]', newForm.form).clone();
            $ariaAlerts.append(newAlerts);
          }
        } else if (data.redirect_url) {
          delegate.redirect(data.redirect_url);
        } else {
          delegate.alert(`Invalid server response: ${data}`);
          $(form).removeClass('submit-in-progress');
        }
      });

      req.fail(() => {
        delegate.alert('An error occurred when submitting your data.');
        $(form).removeClass('submit-in-progress');
      });
    }
  });

  return self;
}

$(bindForm);

exports.setDelegate = newDelegate => {
  delegate = newDelegate;
  return delegate;
};
exports.getForm = getForm;
exports.bindForm = bindForm;
exports.shutdownAriaAlerts = shutdownAriaAlerts;

window.testingExports__ajaxform = exports;
