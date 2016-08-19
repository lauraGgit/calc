/* global QUnit $ test window QUNIT_FIXTURE_DATA */

const urlParse = require('url').parse;
const sinon = require('sinon');

const ajaxform = window.testingExports__ajaxform;

let server;

QUnit.module('ajaxform', {
  beforeEach() {
    server = sinon.fakeServer.create();
    $('[data-ajaxform]').remove();
    ajaxform.shutdownAriaAlerts();
  },
  afterEach() {
    $('[data-ajaxform]').remove();
    ajaxform.shutdownAriaAlerts();
    server.restore();
  },
});

function createBlob(content) {
  // If in PhantomJS 1.x
  if (window.WebKitBlobBuilder) {
    const builder = new window.WebKitBlobBuilder();
    builder.append(content);
    return builder.getBlob();
  }

  // In a more modern engine with Blob support
  if (window.Blob) {
    return new window.Blob([content]);
  }

  throw new Error('Unable to determine how to create Blob');
}

function advancedTest(name, cb) {
  if (!$.support.advancedUpload) {
    return QUnit.skip(name, cb);
  }
  return QUnit.test(name, cb);
}

function makeFormHtml(extraOptions) {
  const options = Object.assign({
    isDegraded: false,
    fooValue: 'bar',
  }, extraOptions || {});
  const $form = $('<div></div>')
    .html(QUNIT_FIXTURE_DATA.AJAXFORM_TESTS_HTML);

  if (options.isDegraded) {
    $form.find('.upload').attr('data-force-degradation', '');
  }

  if (options.alert) {
    $('form', $form).append(`<div role="alert">${options.alert}</div>`);
  }

  $form.find('input[name="foo"]').attr('value', options.fooValue);

  return $form.html();
}

function addForm(extraOptions) {
  $('<div></div>')
    .html(makeFormHtml(extraOptions))
    .appendTo('body')
    .hide();
  return ajaxform.bindForm();
}

test('bindForm() returns null when data-ajaxform not on page', assert => {
  assert.strictEqual(ajaxform.bindForm(), null);
});

test('submit btn disabled on startup', assert => {
  assert.ok(addForm().$submit.prop('disabled'));
});

test('submit btn enabled on file input change', assert => {
  const s = addForm();

  s.$fileInput.trigger('change');
  assert.ok(!s.$submit.prop('disabled'), 'submit button is enabled');
});

test('submit btn enabled on upload widget changefile', assert => {
  const s = addForm();

  s.$fileInput.trigger('changefile', { name: 'baz' });
  assert.ok(!s.$submit.prop('disabled'), 'submit button is enabled');
});

test('$ariaAlerts is initialized and starts out empty', assert => {
  const s = addForm({ isDegraded: true });

  assert.equal(s.$ariaAlerts.attr('role'), 'alert');
  assert.ok(s.$ariaAlerts.hasClass('sr-only'));
  assert.equal(s.$ariaAlerts.html(), '');
});

test('degraded input does not cancel form submission', assert => {
  const s = addForm({ isDegraded: true });

  $(s.form).on('submit', e => {
    assert.ok(!e.isDefaultPrevented());
    e.preventDefault();
  });

  $(s.form).submit();
});

advancedTest('submit triggers ajax w/ form data', assert => {
  const s = addForm();

  $(s.form).on('submit', e => {
    assert.ok(e.isDefaultPrevented());
    assert.equal(server.requests.length, 1);

    const req = server.requests[0];
    const formData = req.requestBody;

    assert.equal(req.method, 'POST');
    assert.equal(urlParse(req.url).path, '/post-stuff');

    // Ugh, only newer browsers support FormData.prototype.get().
    if (typeof formData.get === 'function') {
      assert.equal(formData.get('foo'), 'bar');
      assert.equal(formData.get('file').size, 'hello there'.length);
    }
  });

  s.upload.file = createBlob('hello there');

  $(s.form).submit();
});

advancedTest('form_html populates $ariaAlerts', assert => {
  const s = addForm();

  s.upload.file = createBlob('blah');
  $(s.form).submit();

  server.requests[0].respond(
    200,
    { 'Content-Type': 'application/json' },
    JSON.stringify({
      form_html: makeFormHtml({ alert: 'invalid yo' }),
    })
  );

  const sNew = $(ajaxform.getForm()).data('ajaxform');

  assert.ok(sNew !== s);
  assert.strictEqual(s.$ariaAlerts, sNew.$ariaAlerts);
  assert.equal(sNew.$ariaAlerts.text(), 'invalid yo');
});

advancedTest('form_html replaces form & rebinds it', assert => {
  const s = addForm({ fooValue: 'hello' });

  assert.equal($('input[name="foo"]', s.form).val(), 'hello');

  s.upload.file = createBlob('blah');
  $(s.form).submit();

  server.requests[0].respond(
    200,
    { 'Content-Type': 'application/json' },
    JSON.stringify({
      form_html: makeFormHtml({ fooValue: 'blargyblarg' }),
    })
  );

  const sNew = $(ajaxform.getForm()).data('ajaxform');

  assert.ok(sNew);
  assert.ok(sNew !== s);
  assert.ok(sNew.form !== s.form);
  assert.equal($('input[name="foo"]', sNew.form).val(), 'blargyblarg');
});

advancedTest('redirect_url redirects browser', assert => {
  const s = addForm();

  s.upload.file = createBlob('blah');
  $(s.form).submit();

  const delegate = ajaxform.setDelegate({ redirect: sinon.spy() });

  server.requests[0].respond(
    200,
    { 'Content-Type': 'application/json' },
    JSON.stringify({
      redirect_url: 'http://boop',
    })
  );

  assert.ok(delegate.redirect.calledWith('http://boop'));
});

advancedTest('500 results in alert', assert => {
  const s = addForm();

  s.upload.file = createBlob('blah');
  $(s.form).submit();

  const delegate = ajaxform.setDelegate({ alert: sinon.spy() });

  server.requests[0].respond(500);

  assert.ok(delegate.alert.calledWith(
    'An error occurred when submitting your data.'
  ));
});

advancedTest('unrecognized 200 results in alert', assert => {
  const s = addForm();

  s.upload.file = createBlob('blah');
  $(s.form).submit();

  const delegate = ajaxform.setDelegate({ alert: sinon.spy() });

  server.requests[0].respond(200);

  assert.ok(delegate.alert.calledWith(
    'Invalid server response: '
  ));
});
