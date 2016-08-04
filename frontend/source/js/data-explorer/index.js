(function(exports) {
  if (typeof console === 'undefined') {
    var noop = function() {};
    console = {
      log: noop,
      warn: noop,
      debug: noop,
      error: noop
    };
  }

  // for IE9: History API polyfill
  var location = window.history.location || window.location;
  // TODO: if location.hash, read that
  // e.g. if an IE9 user sends a link to a Chrome user, they should see the
  // same stuff.

  var search = d3.select("#search"),
      form = new formdb.Form(search.node()),
      inputs = search.selectAll("*[name]"),
      formatPrice = d3.format(",.0f"),
      formatCommas = d3.format(","),
      api = new hourglass.API(),
      $search = $("#labor_category"),
      resultsTable = d3.select("#results-table")
        .style("display", "none"),
      sortHeaders = resultsTable.selectAll("thead th")
        .call(setupColumnHeader),
      loadingIndicator = search.select(".loading-indicator"),
      histogramDownloadLink = document.getElementById('download-histogram'),
      request,
      updateCounter = 0;

  // set default options for all future tooltip instantiations
  $.fn.tooltipster('setDefaults', {
    speed: 200
  });

  // initialize tooltipster.js
  $('.tooltip').tooltipster({
      functionInit: function(origin, content) {
          return $(this).attr('aria-label');
      }
  });

  function getUrlParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  function isNumberKey(evt){
      var charCode = (evt.which) ? evt.which : event.keyCode;

      if (charCode > 31 && (charCode < 48 || charCode > 57)){
        return false;
      }
      return true;
  }

  // JFYI
  var HISTOGRAM_BINS = 12;

  form.on("submit", function onsubmit(data, e) {
    e.preventDefault();
    submit(true);
  });

   /*
   * For some reason, the browser's native form reset isn't working.
   * So instead of just listening for a "reset" event and submitting,
   * we hijack the click event on the reset button and reset the form
   * manually.
   */
  search.select('input[type="reset"]')
    .on('click', function reset() {
      form.reset();
      // NB: form.reset() doesn't reset hidden inputs,
      // so we need to do it ourselves.
      search.selectAll('input[type="hidden"]')
        .property('value', '');
      console.log("reset:", form.getData());
      submit(true);
      d3.event.preventDefault();

      $('.multiSel').empty();
      $('.eduSelect').show();
      if($('.multiSelect input:checked').length) {
        $('.multiSelect input:checked').attr('checked', false);
      }
      $('.slider').val([0, 45]);
    });

  inputs.on("change", function onchange() {
    submit(true);
  });

  histogramDownloadLink.addEventListener('click', histogram_to_img, false);

  d3.selectAll('a.merge-params')
    .on('click', function() {
      d3.event.preventDefault();
      var query = this.getAttribute('href'),
          params = hourglass.qs.parse(query);
      // console.log('merging:', query, params);
      for (var key in params) {
        form.set(key, params[key]);
      }
      submit(true);
    });

  initialize();

  window.addEventListener("popstate", popstate);

  function initialize() {
    popstate();

    var autoCompReq, searchTerms = '';

    $("#labor_category").autoComplete({
      minChars: 2,
      // delay: 5,
      delay: 0,
      cache: false,
      source: function(term, done) {
        // save inputted search terms for display later
        searchTerms = term;

        term = hourglass.getLastCommaSeparatedTerm(term);

        if (autoCompReq) {autoCompReq.abort();}
        var data = form.getData();
        autoCompReq = api.get({
          uri: "search/",
          data: {
            q: term,
            query_type: data.query_type
          },
        }, function(error, result) {
          autoCompReq = null;
          if (error) {return done([]);}
          var categories = result.slice(0, 20).map(function(d) {
            return {
              term: d.labor_category,
              count: d.count
            };
          });
          return done(categories);
        });
      },
      renderItem: function(item, search) {
        var re = new RegExp("(" + search.split(" ").join("|") + ")", "gi"),
            term = item.term || item;
        return [
          '<div class="autocomplete-suggestion" data-val="' + term + '">',
            '<span class="term">', term.replace(re, "<b>$1</b>"), '</span>',
            '<span class="count">', item.count, '</span>',
          '</div>'
        ].join("");
      },
      onSelect : function (e, term, item, autocompleteSuggestion) {

        var selectedInput;

        // check if search field has terms already
        if(searchTerms.indexOf(",") !== -1) {
          var termSplit = searchTerms.split(", ");
          // remove last typed (incomplete) input
          termSplit.pop();
          // combine existing search terms with new one
          selectedInput = termSplit.join(", ") + ", " + term + ", ";
        }
        // if search field doesn't have terms
        // but has selected an autocomplete suggestion,
        // then just show term and comma delimiter
        else if(autocompleteSuggestion) {
          selectedInput = term + ", ";
        }
        else {
          selectedInput = $("#labor_category").val() + ", ";
        }

        // update the search input field accordingly
        $("#labor_category").val(selectedInput);
      }
    });
  }

  function popstate() {
    // read the query string and set values accordingly
    var data = hourglass.extend(
      form.getData(),
      hourglass.qs.parse(location.search)
    );
    inputs.on("change", null);
    form.setData(data);
    inputs.on("change", function onchange() {
      submit(true);
    });

    var sort = parseSortOrder(data.sort);
    var sortable = function(d) { return d.sortable; };
    sortHeaders
      .filter(sortable)
      .classed("sorted", function(d) {
        return d.sorted = (d.key === sort.key);
      })
      .classed("descending", function(d) {
        return d.descending = (d.sorted && sort.order === "-");
      });
    updateSortOrder(sort.key);

    submit(false);
  }

  function arrayToCSV(data) {
    // turns any array input data into a comma separated string
    // in use for the education filter
    for (var filter in data) {
      if (Array.isArray(data[filter])) {
        data[filter] = data[filter].join(',');
      }
    }

    return data;
  }

  function submit(pushState) {
    var data = form.getData();

    data = arrayToCSV(data);

    inputs
      .filter(function() {
        return this.type !== 'radio' && this.type !== 'checkbox';
      })
      .classed("filter_active", function() {
        return !!this.value;
      });

    data.experience_range = $('#min_experience').val() + "," + $('#max_experience').val();

    // console.log("submitting:", data);

    search.classed("loaded", false);
    search.classed("loading", true);

    // cancel the outbound request if there is one
    if (request) request.abort();
    var defaults = {
      histogram: HISTOGRAM_BINS
    };
    request = api.get({
      uri: "rates/",
      data: hourglass.extend(defaults, data)
    }, update);


    d3.select("#export-data")
      .attr("href", function() {
        return [
          this.href.split("?").shift(),
          hourglass.qs.format(data)
        ].join("?");
      });

    if (pushState) {
      var href = "?" + hourglass.qs.format(data);
      history.pushState(null, null, href);
    }

    updateExcluded();
  }

  function update(error, res) {
    search.classed("loading", false);
    request = null;

    if (error) {
      if (error === "abort") {
        // ignore aborts
        return;
      }

      search.classed("error", true);

      loadingIndicator.select(".error-message")
        .text(error);

      console.error('request error:', error);
    } else {
      search.classed("error", false);
    }

    search.classed("loaded", true);

    updateDescription(res);
    updateCounter++;

    if($('.proposed-price input').val()) {
      res.proposedPrice = $('.proposed-price input').val();
      $('.proposed-price-highlight').html('$' + $('.proposed-price input').val());
      $('.proposed-price-block').fadeIn();
    }
    else {
      res.proposedPrice = 0;
      $('.proposed-price-block').fadeOut();
    }

    if (res && res.results && res.results.length) {
      // updatePriceRange(res);
      updatePriceHistogram(res);
      updateResults(res);
    } else {
      res = EMPTY_DATA;
      // updatePriceRange(EMPTY_DATA);
      updatePriceHistogram(res);
      updateResults(res);
    }
  }

  function updatePriceRange(data) {
    var priceScale = d3.scale.linear()
      .domain([data.minimum, data.maximum])
      .range([0, 100]);

    var graph = d3.select("#price-range");

    graph.select(".min")
      .call(setPrice, data.minimum);
    graph.select(".max")
      .call(setPrice, data.maximum);
    graph.select(".average")
      .call(setPrice, data.average)
      .style("left", priceScale(data.average) + "%");

    function setPrice(selection, price) {
      selection.select(".value")
        .text(formatPrice(price));
    }
  }

  var histogramUpdated = false,
      EMPTY_DATA = {
        minimum: 0,
        maximum: .001,
        average: 0,
        count: 0,
        proposedPrice: 0,
        results: [],
        wage_histogram: [
          {count: 0, min: 0, max: 0}
        ]
      };


  function updatePriceHistogram(data) {
    var width = 720,
        height = 300,
        pad = [120, 15, 60, 60],
        top = pad[0],
        left = pad[3],
        right = width - pad[1],
        bottom = height - pad[2],
        svg = d3.select("#price-histogram")
          .attr("viewBox", [0, 0, width, height].join(" "))
          .attr("preserveAspectRatio", "xMinYMid meet"),
        formatDollars = function(n) {
          return "$" + formatPrice(n);
        },
        stdMinus, stdPlus;

    var extent = [data.minimum, data.maximum],
        bins = data.wage_histogram,
        x = d3.scale.linear()
          .domain(extent)
          .range([left, right]),
        countExtent = d3.extent(bins, function(d) { return d.count; }),
        heightScale = d3.scale.linear()
          .domain([0].concat(countExtent))
          .range([0, 1, bottom - top]);
    // console.log('count extent:', countExtent);


    d3.select("#avg-price-highlight")
      .text(formatDollars(data.average));

    var stdDevMin = data.average - data.first_standard_deviation,
        stdDevMax = data.average + data.first_standard_deviation;

    if (isNaN(stdDevMin)) stdDevMin = 0;
    if (isNaN(stdDevMax)) stdDevMax = 0;

    d3.select("#standard-deviation-minus-highlight")
      .text(formatDollars(stdDevMin));

    d3.select("#standard-deviation-plus-highlight")
      .text(formatDollars(stdDevMax));

    var stdDev = svg.select(".stddev");
    if (stdDev.empty()) {
      stdDev = svg.append("g")
        .attr("transform", "translate(0,0)")
        .attr("class", "stddev");
      stdDev.append("rect")
        .attr("class", "range-fill");
      stdDev.append("line")
        .attr("class", "range-rule");
      var stdDevLabels = stdDev.append("g")
        .attr("class", "range-labels")
        .selectAll("g.label")
        .data([
          {type: "min",anchor:"end",label:"-1 stddev"},
          {type: "max",anchor:"start",label:"+1 stddev"}
        ])
        .enter()
        .append("g")
          .attr("transform", "translate(0,0)")
          .attr("class", function(d) {
            return "label " + d.type;
          });
      stdDevLabels.append("line")
        .attr("class", "label-rule")
        .attr({
          y1: -5,
          y2: 5
        });
      var stdDevLabelsText = stdDevLabels.append("text")
        .attr("text-anchor", function(d) {
          return d.anchor;
        })
        .attr("dx", function(d, i) {
          return 8 * (i ? 1 : -1);
        })

      stdDevLabelsText.append("tspan")
        .attr("class", "stddev-text");
      stdDevLabelsText.append("tspan")
        .attr("class", "stddev-text-label");
    }

    stdMinus = data.average - data.first_standard_deviation;
    stdPlus = data.average + data.first_standard_deviation;

    if(isNaN(stdMinus)) {
      stdMinus = "$0";
    }
    else {
      stdMinus = formatDollars(stdMinus);
    }
    if(isNaN(stdPlus)) {
      stdPlus = "$0";
    }
    else {
      stdPlus = formatDollars(stdPlus);
    }


    d3.select("#standard-deviation-minus-highlight")
      .text(stdMinus);

    d3.select("#standard-deviation-plus-highlight")
      .text(stdPlus);


    var xAxis = svg.select(".axis.x");
    if (xAxis.empty()) {
      xAxis = svg.append("g")
        .attr("class", "axis x");
    }

    var yAxis = svg.select(".axis.y");
    if (yAxis.empty()) {
      yAxis = svg.append("g")
        .attr("class", "axis y");
    }

    var gBar = svg.select("g.bars");
    if (gBar.empty()) {
      gBar = svg.append("g")
        .attr("class", "bars");
    }


    // draw proposed price line
    var pp = svg.select("g.pp"),
        ppOffset = -95;
    if (pp.empty()) {
      pp = svg.append("g")
        .attr("class", "pp");

      pp.append("rect")
        .attr("y", ppOffset - 25)
        .attr("x", -55)
        .attr("class", "pp-label-box")
        .attr("width", 110)
        .attr("height", 26)
        .attr("rx", 4)
        .attr("ry", 4);

      var ppText = pp.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", ppOffset - 6)
        .attr("class", "value proposed");
      pp.append("line");
    }

    // widen proposed price rect if more than 3 digits long
    if (data.proposedPrice.toString().replace('.', '').length > 3) {
      pp.select("rect").attr("width", 130);
      pp.select("text").attr("dx", 10);
    }
    else {
      pp.select("rect").attr("width", 110);
      pp.select("text").attr("dx", 0);
    }

    pp.select("line")
      .attr("y1", ppOffset)
      .attr("y2", bottom - top + 8);
    pp.select(".value")
      .text("$" + data.proposedPrice + ' proposed');

    if(data.proposedPrice === 0) {
      pp.style("opacity", 0);
    }
    else {
      pp.style("opacity", 1);
    }

    // draw average line
    var avg = svg.select("g.avg"),
        avgOffset = -55;
    if (avg.empty()) {
      avg = svg.append("g")
        .attr("class", "avg");

      avg.append("rect")
        .attr("y", avgOffset - 25)
        .attr("x", -55)
        .attr("class", "avg-label-box")
        .attr("width", 110)
        .attr("height", 26)
        .attr("rx", 4)
        .attr("ry", 4);

      var avgText = avg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", avgOffset - 7)
        .attr("class", "value average");
      avg.append("line");
    }

    avg.select("line")
      .attr("y1", avgOffset)
      .attr("y2", bottom - top + 8);
    avg.select(".value")
      .text(formatDollars(data.average) + ' average');


    var bars = gBar.selectAll(".bar")
      .data(bins);

    bars.exit().remove();

    var enter = bars.enter().append("g")
      .attr("class", "bar");
    enter.append("title");

    var step = (right - left) / bins.length;
    enter.append("rect")
      .attr("x", function(d, i) {
        return left + i * step;
      })
      .attr("y", bottom)
      .attr("width", step)
      .attr("height", 0);

    var title = templatize("{count} results from {min} to {max}");
    bars.select("title")
      .text(function(d, i) {
        var inclusive = (i === bins.length - 1),
            sign = inclusive ? "<=" : "<";
        return title({
          count: formatCommas(d.count),
          min: formatDollars(d.min),
          sign: sign,
          max: formatDollars(d.max)
        });
      });

    var t = histogramUpdated
      ? svg.transition().duration(500)
      : svg;

    var stdDevWidth = x(stdDevMax) - x(stdDevMin),
        stdDevTop = 85;
    stdDev = t.select(".stddev");
    stdDev
      .attr("transform", "translate(" + [x(stdDevMin), stdDevTop] + ")");

    stdDev.select("rect.range-fill")
      .attr("width", stdDevWidth)
      .attr("height", bottom - stdDevTop);

    stdDev.select("line.range-rule")
      .attr("x2", stdDevWidth);

    stdDev.select(".label.min .stddev-text")
      .text(formatDollars(stdDevMin))
      .attr({x : 0, dy : 0});

    stdDev.select(".label.min .stddev-text-label")
      .text("-1 std dev")
      .attr({x : -8, dy : '15px'});

    stdDev.select(".label.max")
      .attr("transform", "translate(" + [stdDevWidth, 0] + ")");

    stdDev.select(".label.max .stddev-text-label")
      .text("+1 std dev")
      .attr({x : 8, dy : '15px'});


    stdDev.select(".label.max .stddev-text")
      .text(formatDollars(stdDevMax));

    t.select(".avg")
      .attr("transform", "translate(" + [~~x(data.average), top] + ")");

    t.select(".pp")
      .attr("transform", "translate(" + [~~x(data.proposedPrice), top] + ")");

    t.selectAll(".bar")
      .each(function(d) {
        d.x = x(d.min);
        d.width = x(d.max) - d.x;
        d.height = heightScale(d.count);
        d.y = bottom - d.height;
      })
      .select("rect")
        .attr("x", function(d, i) { return d.x; })
        .attr("y", function(d, i) { return d.y; })
        .attr("height", function(d, i) { return d.height; })
        .attr("width", function(d, i) { return d.width; });

    var ticks = bins.map(function(d) { return d.min; })
      .concat([data.maximum]);

    var xa = d3.svg.axis()
      .orient("bottom")
      .scale(x)
      .tickValues(ticks)
      .tickFormat(function(d, i) {
        return (i === 0 || i === bins.length)
          ? formatDollars(d)
          : formatPrice(d);
      });
    xAxis.call(xa)
      .attr("transform", "translate(" + [0, bottom + 2] + ")")
      .selectAll(".tick")
        .classed("primary", function(d, i) {
          return i === 0 || i === bins.length;
        })
        .select("text")
          .classed("min", function(d, i) {
            return i === 0;
          })
          .classed("max", function(d, i) {
            return i === bins.length;
          })
          .style("text-anchor", "end")
          .attr("transform", "rotate(-35)");

    // remove existing labels
    svg.selectAll("text.label").remove();

    xAxis.append('text')
      .attr('class', 'label')
      .attr('transform', 'translate(' + [left + (right - left) / 2, 45] + ')')
      .attr('text-anchor', 'middle')
      .text('Ceiling price (hourly rate)');

    var yd = d3.extent(heightScale.domain());
    var ya = d3.svg.axis()
      .orient("left")
      .scale(d3.scale.linear()
        .domain(yd)
        .range([bottom, top]))
      .tickValues(yd);
    ya.tickFormat(formatCommas);
    yAxis.call(ya)
      .attr("transform", "translate(" + [left - 2, 0] + ")");

    yAxis.append('text')
      .attr('class', 'label')
      .attr('transform', 'translate(' + [-25, height / 2 + 25] + ') rotate(-90)')
      .attr('text-anchor', 'middle')
      .text('# of results');

    histogramUpdated = true;
  }


  function updateResults(data) {
    var results = data.results;
    d3.select('#results-count')
      .text(formatCommas(data.count));

    resultsTable.style('display', null);

    var thead = resultsTable.select('thead'),
        columns = thead.selectAll('th').data(),
        tbody = resultsTable.select('tbody');

    var tr = tbody.selectAll('tr')
      .data(results);

    tr.exit().remove();

    tr.enter().append('tr')
    .on('mouseover', function(d) {
      var label = this.querySelector('.years');
      label.className = label.className.replace('hidden', '');
    })
    .on('mouseout', function(d) {
      var label = this.querySelector('.years');
      label.className = label.className + ' hidden';
    });

    var td = tr.selectAll('.cell')
      .data(function(d) {
        return columns.map(function(column) {
          var key = column.key,
              value = d[key],
              priceFields = ['current_price', 'next_year_price', 'second_year_price'],
              yearField;

          // check if we need to be loading a future price
          // and, if so, the price value should reflect the filter choice
          if (column.key == 'current_price') {
            yearField = form.getData()['contract-year'];
            if (!isNaN(yearField)) {
              value = d[priceFields[yearField]];
            }
          }

          return {
            column: column,
            row: d,
            key: key,
            value: value,
            string: column.format(value)
          };
        });
      });

    td.exit().remove();

    var sortKey = parseSortOrder(form.getData().sort).key;

    var enter = td.enter()
        .append(function(d, i) {
          var name = d.column.key === 'labor_category' ? 'th' : 'td';
          return document.createElement(name);
        })
        .attr("class", function(d) {
          return 'cell column-' + d.key;
        })
        .classed('collapsed', function(d) {
          return d.column.collapsed;
        })
        .classed("sorted", function(c) {
          return c.column.key === sortKey;
        });

    enter.filter(function() { return this.nodeName === 'TH'; })
      .attr('scope', 'row');

    // update the HTML of all cells (except exclusion columns)
    td.filter(function(d) {
      return d.key !== 'exclude';
    })
    .html(function(d) {
      // don't just do "if !(d.string)" because 0 is valid
      if (d.string === null) {
        d.string = 'N/A';
      }

      return d.column.collapsed ? "" : d.string;
    });

    // add "years" the experience number, shown on row hover
    td.filter(function(d) {
      return d.key === 'min_years_experience';
    })
    .html(function(d) {
      var label = d.string === 1 ? 'year' : 'years';
      return d.string + ' <span class="years hidden">' + label + '</span>';
    });

    // add links to contracts
    td.filter(function(d) {
      return d.key === 'idv_piid';
    })
    .html(function(d) {
      var id = d.string.split('-').join('');
      return '<a target="_blank" href="https://www.gsaadvantage.gov/ref_text/'
             + id + '/' + id + '_online.htm">' + d.string
             + '<svg class="document-icon" width="8" height="8" viewBox="0 0 8 8"><path d="M0 0v8h7v-4h-4v-4h-3zm4 0v3h3l-3-3zm-3 2h1v1h-1v-1zm0 2h1v1h-1v-1zm0 2h4v1h-4v-1z" /></svg>';
    });

    // add a link to incoming exclusion cells
    enter.filter(function(d) {
      return d.key === 'exclude';
    })
    .append('a')
      .attr('class', 'exclude-row')
      .html('&times;')
      .each(function(){
        $(this).tooltipster({
          position: 'bottom'
        });
      });


    // update the links on all exclude cells
    td.filter(function(d) {
      return d.key === 'exclude';
    })
    .select('a')
      .attr('href', function(d) {
        return '?exclude=' + d.row.id;
      })
      .attr('aria-label', function(d){
          return 'Exclude ' + d.row.labor_category + ' from your search';
      })
      .each(function(){
        $(this).tooltipster('content', this.getAttribute('aria-label'));
      })

      .on('click', function(d) {
        d3.event.preventDefault();
        /*
         * XXX this is where d3.select(this).parent('tr')
         * would be nice...
         */
        var tr = this.parentNode.parentNode;
        // console.log('removing:', tr);
        tr.parentNode.removeChild(tr);

        excludeRow(d.row.id);
      });
  }

  function excludeRow(id) {
    id = String(id);
    var excluded = getExcludedIds();
    if (excluded.indexOf(id) === -1) {
      excluded.push(id);
    } else {
      console.warn('attempted to exclude an already excluded row:', id);
    }
    form.set('exclude', excluded.join(','));
    submit(true);
  }

  function getExcludedIds() {
    var str = form.get('exclude');
    return str && str.length
      ? str.split(',')
      : [];
  }

  function updateExcluded() {
    var excluded = getExcludedIds(),
        len = excluded.length,
        rows = 'row' + (len === 1 ? '' : 's'),
        text = len > 0
          ? ['★ Restore', len, rows].join(' ')
          : '';
    d3.select('#restore-excluded')
      .style('display', len > 0
        ? null
        : 'none')
      .attr('title', rows + ': ' + excluded.join(', '))
      .text(text);
  }

  function setupColumnHeader(headers) {
    headers
      .datum(function() {
        return {
          key: this.getAttribute('data-key'),
          title: this.getAttribute('title') || this.textContent,
          format: getFormat(this.getAttribute('data-format')),
          sortable: this.classList.contains('sortable'),
          collapsible: this.classList.contains('collapsible')
        };
      })
      .each(function(d) {
        this.classList.add('column-' + d.key);
      });

    // removed temporarily to prevent collision with tooltips [TS]
    // headers.filter(function(d) { return d.collapsible; })
    //   .call(setupCollapsibleHeaders);

    headers.filter(function(d) { return d.sortable; })
      .call(setupSortHeaders);
  }

  function setupSortHeaders(headers) {
    headers
      .each(function(d) {
        d.sorted = false;
        d.descending = false;
      })
      .attr('tabindex', 0)
      .attr('aria-role', 'button')
      .on('click.sort', setSortOrder);

    function setSortOrder(d, i) {
      // console.log('sort:', d.key);
      headers.each(function(c, j) {
        if (j !== i) {
          c.sorted = false;
          c.descending = false;
        }
      });

      if (d.sorted) {
        d.descending = !d.descending;
      }
      d.sorted = true;

      var sort = (d.descending ? '-' : '') + d.key;
      form.set('sort', sort);

      updateSortOrder(d.key);

      submit(true);
    }
  }

  function updateSortOrder(key) {
    var title = function(d) {
      if (d.sorted) {
        var order = d.descending ? 'descending' : 'ascending';
        var other = d.descending ? 'ascending' : 'descending';
        return [d.title, ': sorted ', order, ', select to sort ', other].join('');
      } else {
        return d.title + ': select to sort ascending';
      }
    };

    sortHeaders
      .filter(function(d) { return d.sortable; })
        .classed('sorted', function(c) {
          return c.sorted;
        })
        .classed('ascending', function(c) {
          return c.sorted && !c.descending;
        })
        .classed('descending', function(c) {
          return c.sorted && c.descending;
        })
        .attr('aria-label', title)
        .each(function (){
          $(this).tooltipster('content', this.getAttribute ('aria-label'));
        });

    resultsTable.selectAll('tbody td')
      .classed('sorted', function(c) {
        return c.column.key === key;
      });
  }

  // temporarily not in use to prevent tooltip collision [TS]
  function setupCollapsibleHeaders(headers) {
    headers
      .each(function(d) {
        d.collapsed = this.classList.contains("collapsed");
        d.label = this.innerText;
      })
      .append("a")
        .attr("class", "toggle-collapse")
        .on("click.collapse", function(d) {
          // console.log("collapse:", d.key);
          d3.event.preventDefault();
          d3.event.stopImmediatePropagation();
          d.collapsed = !d.collapsed;
          updateCollapsed.apply(this.parentNode, arguments);
        });

    headers.each(updateCollapsed);

    function updateCollapsed(d) {
      var title = [
        d.collapsed ? "Show" : "Hide",
        d.label,
        d.collapsed ? "▼" : ""
      ].join(" ");

      d3.select(this)
        .classed("collapsed", d.collapsed)
        .select("a.toggle-collapse")
          .attr("title", title)
          .text(title);

      resultsTable.selectAll("td.column-" + d.key)
        .classed("collapsed", d.collapsed)
        .html(d.collapsed
          ? ""
          : function(d) { return d.string; });
    }
  }

  function parseSortOrder(order) {
    if (!order) return {key: null, order: null};
    var first = order.charAt(0),
        sort = {order: ""};
    switch (first) {
      case "-":
        sort.order = first;
        order = order.substr(1);
        break;
    }
    sort.key = order;
    return sort;
  }

  function showError(error) {
    alert(error);
  }

  function getFormat(spec) {
    if (!spec) return function(d) { return d; };

    if (spec.indexOf("{}") > -1) {
      return function(d) {
        return spec.replace(/{}/g, d)
          .replace(/\?{(.+)}/g, d == 1 ? "" : "$1");
      };
    }

    var index = spec.indexOf("%");
    if (index === -1) {
      return d3.format(spec);
    }
    var prefix = spec.substr(0, index),
        format = d3.format(spec.substr(index + 1));
    return function(str) {
      if (!str) return "";
      return prefix + format(+str);
    };
  }

  function updateDescription(res) {
    var total = res ? formatCommas(res.count) : '0',
        data = form.getData(),
        filters = $('.filters'),
        laborCategoryValue = $('#labor_category').val(),
        lookup = {
          'education' : {
            'label' : 'education level',
            'html' : $('.multiSel').html()
          },
          'min_experience' : {
            'label' : 'experience',
            'html' : $('#min_experience option:selected').text() + " - " + $('#max_experience option:selected').text() + " years"
          },
          'site' : {
            'label' : 'worksite',
            'html' : $('.filter-site option:selected').text()
          },
          'business_size' : {
            'label' : 'business size',
            'html' : $('.filter-business_size option:selected').text()
          },
          'schedule' : {
            'label' : 'schedule',
            'html' : $('.filter-schedule option:selected').text()
          }
        };

    if(updateCounter) {
      filters.empty().removeClass('hidden').append('with ');
    }

    // fade effect for transitions during description update
    $('#description').hide().fadeIn();

    // first count of results
    d3.select('#description-count')
      .text(formatCommas(res.results.length));

    // labor category results
    if(laborCategoryValue) {
      var laborEl = $(document.createElement('span')).addClass('filter');
      filters.append(laborEl);
      laborEl.append(
        $(document.createElement('a')).addClass('focus-input').attr('href', '#').html(laborCategoryValue)
      );
    }

    for(var dataKey in data) {
      for(var lookupKey in lookup) {
        if(dataKey == lookupKey) {

          // create a span element filter label
          var filterEl = $(document.createElement('span'))
              .addClass('filter ' + dataKey + '-filter')
              .html(" " + lookup[dataKey]['label'] + ": ");

          filters.append(filterEl);

          // append text of selected filter as anchor elements
          filterEl.append(
            $(document.createElement('a')).addClass('focus-input')
              .attr('href', '#')
              .html(lookup[dataKey]['html'])
          );
        }
      }
    }
  }

  function templatize(str, undef) {
    undef = d3.functor(undef);
    return function(d) {
      return str.replace(/{(\w+)}/g, function(_, key) {
        return d[key] || undef.call(d, key);
      });
    };
  }

  function histogram_to_img(e) {
    e.preventDefault();
    var svg = document.getElementById('price-histogram'),
        canvas = document.getElementById('graph'),
        serializer = new XMLSerializer(),
        img,
        modalImg;

    svg = serializer.serializeToString(svg);

    // convert svg into canvas
    canvg(canvas, svg, {ignoreMouse: true, scaleWidth: 720, scaleHeight: 300});

    if (typeof Blob !== 'undefined') {
      canvas.toBlob(function(blob) {
        saveAs(blob, 'histogram.png');
      });
    }
    else {
      img = canvas.toDataURL('image/png');
      modalImg = new Image();
      modalImg.src = img;

      vex.open({
        content: 'Please right click the image and select "save as" to download the graph.',
        afterOpen: function(content) {
          return content.append(modalImg);
        },
        showCloseButton: true,
        contentCSS: {
          'width': '800px'
        }
      });
    }
  }


  function isNumberOrPeriodKey(evt){
      var charCode = (evt.which) ? evt.which : event.keyCode;
      if (charCode === 46) {
        return true;
      }
      if (charCode > 31 && (charCode < 48 || charCode > 57)) {
        return false;
      }
      return true;
    }

  /*
    Dropdown with Multiple checkbox select with jQuery - May 27, 2013
    (c) 2013 @ElmahdiMahmoud
    license: http://www.opensource.org/licenses/mit-license.php
    // many edits by xtine
  */

  $(".dropdown dt a").on('click', function (e) {
      $(".dropdown dd ul").slideToggle('fast');

      e.preventDefault();
  });

  $(".dropdown dd ul li a").on('click', function (e) {
      $(".dropdown dd ul").hide();

      e.preventDefault();
  });

  function getSelectedValue(id) {
    return $("#" + id).find("dt a span.value").html();
  }

  $(document).bind('click', function (e) {
    var $clicked = $(e.target);
    if (!$clicked.parents().hasClass("dropdown")) $(".dropdown dd ul").hide();
  });


  $('.multiSelect input[type="checkbox"]').on('click', function () {

      var title = $(this).next().html(),
          html;

      if ($(this).is(':checked')) {
        html = '<span title="' + title + '">' + title + '</span>';

        $('.multiSel').append(html);
        $(".eduSelect").hide();
      }
      else {
        $('span[title="' + title + '"]').remove();
        $('.dropdown dt a').addClass('hide');
      }

      if(!$('.multiSelect input:checked').length) {
        $('.eduSelect').show();
      }
      else {
        $('.eduSelect').hide();
      }

  });

  if(getUrlParameterByName('education').length) {

    var parameters = getUrlParameterByName('education').split(','),
        title;

    $('.eduSelect').hide();

    for(var key in parameters) {
      title = $('.multiSelect input[type=checkbox][value=' + parameters[key] + ']').attr('checked', true).next().html();

      $('.multiSel').append('<span title="' + title + '">' + title + '</span>');
    }
  }

  $('.slider').noUiSlider({
    start: [0, 45],
    step: 1,
    connect: true,
    range: {
      'min': 0,
      'max': 45
    }
  });

  $('.slider').Link('lower').to($('#min_experience'), null, wNumb({
    decimals: 0
  }));
  $('.slider').Link('upper').to($('#max_experience'), null, wNumb({
    decimals: 0
  }));

  $('.slider').on({
    slide : function () {
      $('.noUi-horizontal .noUi-handle').addClass('filter_focus');
    },
    set: function () {
      $('.noUi-horizontal .noUi-handle').removeClass('filter_focus');

      submit(true);

      if($('#min_experience').val() === 0 && $('#max_experience').val() == 45) {
        $('#min_experience, #max_experience').removeClass('filter_active');
      }
    }
  });

  // on load remove active class on experience slider
  $('#min_experience, #max_experience').removeClass('filter_active');

  // load experience range if query string exists
  if(getUrlParameterByName('max_experience').length) {
    $('.slider').val([getUrlParameterByName('min_experience'), getUrlParameterByName('max_experience')]);
  }

  // restrict proposed price input to be numeric only
  $('.proposed-price input').keypress(function (e) {
    if(!isNumberOrPeriodKey(e)) {
      e.preventDefault();
    }
  })

  // trigger proposed button input
  $('.proposed-price button').click(function () {
    if($('.proposed-price input').val()) {
      $('.proposed-price-highlight').html('$' + $('.proposed-price input').val());

      $('.proposed-price-block').fadeIn();
    }
    else {
      $('.proposed-price-block').fadeOut();
    }
  });


  if(getUrlParameterByName('proposed-price').length) {
    $('.proposed-price-highlight').html('$' + getUrlParameterByName('proposed-price'));
    $('.proposed-price-block').show();
  }

  $(document).keypress(function (e) {
    if(e.which == 13) {
      $('.proposed-price button').trigger('click');
    }
  });

  $('.two-decimal-places').keyup(function(){
    // regex checks if there are more than 2 numbers after decimal point
    if(!(/^\d+(\.{0,1}\d{0,2})?$/.test(this.value))) {
      // cut off and prevent user from inputting more than 2 numbers after decimal place
      this.value = this.value.substring(0, this.value.length - 1);
    }
  });

})(this);
