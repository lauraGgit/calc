var test = QUnit.test,
    module = QUnit.module;

module("hourglass");

test("getLastCommaSeparatedTerm()", function(assert) {
  var get = hourglass.getLastCommaSeparatedTerm;

  assert.equal(get("foo"), "foo");
  assert.equal(get("foo,bar"), "bar");
  assert.equal(get("foo, bar"), "bar");
  assert.equal(get("foo , bar"), "bar");
  assert.equal(get("foo bar"), "foo bar");
});

test("extend()", function(assert) {
  var extend = hourglass.extend;
  assert.deepEqual(
    extend({}, null),
    {},
    "handles nulls gracefully");
  assert.deepEqual(
    extend({foo: "bar"}, {baz: "qux"}),
    {foo: "bar", baz: "qux"},
    "extends one object with another's keys");
  assert.deepEqual(
    extend({foo: "bar"}, {baz: "qux"}, {quux: "quuux"}),
    {foo: "bar", baz: "qux", quux: "quuux"},
    "extends one object with two objects' keys");
});

module("hourglass.qs");

test("parse()", function(assert) {
  var parse = hourglass.qs.parse;
  assert.deepEqual(
    parse("foo=bar"),
    {foo: "bar"},
    "parses a single value without ? prefix");
  assert.deepEqual(
    parse("?foo=bar"),
    {foo: "bar"},
    "parses a single value with ? prefix");
  assert.deepEqual(
    parse("?foo=bar&baz=qux"),
    {foo: "bar", baz: "qux"},
    "parses two values");
  assert.deepEqual(
    parse("?foo"),
    {foo: true},
    "parses empty values as true");
  assert.deepEqual(
    parse("?foo=true&bar=false"),
    {foo: true, bar: false},
    "parses boolean values");
  assert.deepEqual(
    parse("?foo=foo+bar"),
    {foo: "foo bar"},
    "parses '+' as space");
  assert.deepEqual(
    parse("?foo=foo%20bar"),
    {foo: "foo bar"},
    "parses '%20' as spaces");
});

test("coerce()", function(assert) {
  var coerce = hourglass.qs.coerce;
  assert.deepEqual(
    coerce({foo: "bar"}),
    {foo: "bar"},
    "passes through objects");
  assert.deepEqual(
    coerce("foo=bar"),
    {foo: "bar"},
    "parses strings");
  assert.deepEqual(
    coerce(null),
    {},
    "turns falsy values into objects");
});

test("merge()", function(assert) {
  var merge = hourglass.qs.merge;
  assert.deepEqual(
    merge("foo=bar", {baz: "qux"}),
    {foo: "bar", baz: "qux"},
    "merges a string with an object");
  assert.deepEqual(
    merge("foo=bar", "?baz=qux"),
    {foo: "bar", baz: "qux"},
    "merges an object with a string");
});

module("hourglass.API");

test("API()", function(assert) {
  assert.equal(new hourglass.API("/").path, "/", "sets the path properly");
});

test("#url()", function(assert) {
  var api = new hourglass.API("/api/");
  assert.equal(api.url("foo"), "/api/foo", "appends a URI to the path");
  assert.equal(api.url("/foo"), "/api/foo", "strips out superfluous path delimiters");
});

// test node-style callbacks
test("#get()", function(assert) {
  var api = new hourglass.API();

  var done1 = assert.async();
  api.get("rates", function(error, data) {
    if (error) throw error.statusText;
    assert.ok(data, "got data from rates endpoint");
    done1();
  });

  var done2 = assert.async();
  api.get("should-not-exist", function(error, data) {
    assert.ok(error, "got error for non-existent URI");
    done2();
  });

  var done3 = assert.async();
  api.get({uri: "rates", data: {q: "engineer"}}, function(error, data) {
    if (error) throw error.statusText;
    assert.ok(data, "got data from rates endpoint with data");
    done3();
  });
});
