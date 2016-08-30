/* global jQuery, document, window */

import 'document-register-element';

import * as supports from './feature-detection';

import { dispatchBubbly } from './custom-event';

const $ = jQuery;

const MISC_ERROR = 'Sorry, we’re having trouble. ' +
                   'Please try again later or refresh your browser.';

// This abstracts various actions for test suites to hook into.
let delegate = {
  redirect(url) {
    window.location = url;
  },
  alert(msg) {
    // TODO: Be more user-friendly here.
    window.alert(msg);   // eslint-disable-line no-alert
  },
};

exports.setDelegate = newDelegate => {
  delegate = newDelegate;
  return delegate;
};

exports.MISC_ERROR = MISC_ERROR;

class AjaxForm extends window.HTMLFormElement {
  attachedCallback() {
    if ('isDegraded' in this) {
      return;
    }

    this.isDegraded = !supports.formData() ||
                      supports.isForciblyDegraded(this);
    if (!this.isDegraded) {
      $(this).on('submit', this._onUpgradedSubmit.bind(this));
    }
    dispatchBubbly(this, 'ajaxformready');
  }

  populateFormData(formData) {
    // IE11 doesn't support FormData.prototype.delete(), so we need to
    // manually construct the FormData ourselves (we used to have
    // the browser construct it for us, and then replace the file).
    for (let i = 0; i < this.elements.length; i++) {
      const el = this.elements[i];

      if (el.isUpgraded) {
        formData.append(el.name, el.upgradedValue);
      } else if (el.type === 'radio' || el.type === 'checked') {
        // https://github.com/18F/calc/issues/570
        throw new Error(`unsupported input type: ${el.type}`);
      } else if (el.type === 'file') {
        for (let j = 0; j < el.files.length; j++) {
          formData.append(el.name, el.files[j]);
        }
      } else {
        formData.append(el.name, el.value);
      }
    }

    return formData;
  }

  _replaceWithNewForm(html) {
    const newForm = $(html)[0];

    // Replace the form and bind it.
    $(this).replaceWith(newForm);

    // Animate the new form so the user notices it.
    // TODO: Consider using a CSS class w/ a transition or animation instead.
    $(newForm).hide().fadeIn();
  }

  _onUpgradedSubmit(e) {
    e.preventDefault();

    const formData = new window.FormData();

    this.populateFormData(formData);

    const req = $.ajax(this.action, {
      processData: false,
      contentType: false,
      data: formData,
      method: this.method,
    });

    $(this).addClass('submit-in-progress');

    req.done((data) => {
      if (data.form_html) {
        this._replaceWithNewForm(data.form_html);
      } else if (data.redirect_url) {
        delegate.redirect(data.redirect_url);
      } else {
        delegate.alert(MISC_ERROR);
        $(this).removeClass('submit-in-progress');
      }
    });

    req.fail(() => {
      delegate.alert(MISC_ERROR);
      $(this).removeClass('submit-in-progress');
    });
  }
}

document.registerElement('ajax-form', {
  extends: 'form',
  prototype: AjaxForm.prototype,
});

exports.AjaxForm = AjaxForm;
