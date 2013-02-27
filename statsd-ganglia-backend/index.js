/*
 * Flush stats to ganglia (http://www.ganglia.info/)
 *
 * To enable this backend, include 'ganglia' in the backends
 * configuration array:
 *
 *   backends: ['ganglia']
 *
 * This backend supports the following config options in the 'ganglia'
 * config option:
 *
 *   host:    Hostname of ganglia gmond server.
 *   port:    Port to contact ganglia gmond server at.
 *   spoof:   Ganglia "spoof" string (e.g. "<ip>:<hostname>" or "<hostname>:<hostname>").
 *   useHost: Present as this hostname to gmond
 *   group:   The group name under which the stats should appear in the ganglia-webfrontend
 *   mappings: Object {
 *       <metric name>: {
 *         name: '<display name>'
 *         group: '<group name>',
 *         units: '<unit>',
 *         slope: '<slope>',
 *         type: '<type>'
 *       },
 *       // Alternatively
 *       ALL: {
 *           mappingMethod: '<method name>',
 *           mappingSource: '<js file where [mappingMethod] lives>'
 *         },
 *     }
 *
 *
 *   The [mappingMethod] has to take one parameter - a dictionary containing:
 *   {
 *     name: '<metric name>',
 *     group: '<metric group>',
 *     units: '<metric units>',
 *     slope: '<metric slope>',
 *     type: '<metric type>'
 *   }
 *   The method then can perform some changes and has to return the dictionary populated with new values.
 *
 *
 *     <slope> can be one of:
 *       zero
 *       positive
 *       negative
 *       both
 *       unspecified
 *
 *
 *     <type> can be one of:
 *       string
 *       int8
 *       uint8
 *       int16
 *       uint16
 *       int32
 *       uint32
 *       float
 *       double
 */

var net = require('net'),
   util = require('util'),
   gm   = require('gmetric');

var debug;
var flushInterval;
var gangliaHost;
var gangliaPort;
var gangliaSpoof;
var gmetric;

var gangliaStats = {};

var post_stats = function ganglia_post_stats(rstats) {
  if (gangliaHost) {
    for (var k in rstats) {
      if (rstats.hasOwnProperty(k)) {
        try {
          if (debug) {
            util.log('gmetric.send ' + k + ' ' + rstats[k]);
          }

          var metricData = {
            name: k,
            group: gangliaGroup,
            units: 'count',
            slope: 'both',
            type: 'int32'
          };

          if (gangliaStatsMappings != null) {
            if (gangliaStatsMappings.ALL != null) {
              var mapper = require(gangliaStatsMappings.ALL.mappingSource);
              metricData = mapper[gangliaStatsMappings.ALL.mappingMethod](metricData);
              if (debug) {
                util.log('Mapped ' + k + ' to ' + metricData.name + ' using ALL mapper.');
              }
            } else if (gangliaStatsMappings[k] != null) {
              var mapping = gangliaStatsMappings[k];

              if (mapping.name) {
                metricData.name = mapping.name;
              }

              if (mapping.group) {
                metricData.group = mapping.group;
              }

              if (mapping.units) {
                metricData.units = mapping.units;
              }

              if (mapping.slope) {
                metricData.slope = mapping.slope;
              }

              if (mapping.type) {
                metricData.type = mapping.type;
              }

              if (debug) {
                util.log('Mapped ' + k + ' to ' + metricData.name + ' using specific mapper.');
              }
            }
          }

          var gmetric = new gm();
          var metric = {
            hostname: (gangliaSpoof != null) ? gangliaSpoof : gangliaUseHost,
            group: metricData.group,
            spoof: (gangliaSpoof != null),
            units: metricData.units,
            slope: metricData.slope,

            name: metricData.name,
            value: rstats[k],
            type: metricData.type,
            tmax: 0,
            dmax: 0
          };

          if (rstats[k] != null && !isNaN(rstats[k])) {
            gmetric.send(gangliaHost, gangliaPort, metric);
          } else {
            if (debug) {
              util.log('Metric ' + k + ' has an unknown value: ' + rstats[k])
            }
          }

          gangliaStats.last_flush = Math.round(new Date().getTime() / 1000);
        } catch (e) {
          if (debug) {
            util.log("Exception: " + e);
          }
          gangliaStats.last_exception = Math.round(new Date().getTime() / 1000);
        } // end try/catch
      } // end check for own property
    } // end iterate
  }
}

var flush_stats = function ganglia_flush(ts, metrics) {
  var statString = '';
  var numStats = 0;
  var key;

  var counters = metrics.counters;
  var gauges = metrics.gauges;
  var timers = metrics.timers;
  var pctThreshold = metrics.pctThreshold;
  var rstats = { };

  for (key in counters) {
    var value = counters[key];
    var valuePerSecond = value / (flushInterval / 1000); // calculate "per second" rate

    rstats['stats_'        + key] = valuePerSecond;
    rstats['stats_counts_' + key] = value;

    numStats += 1;
  }

  for (key in timers) {
    if (timers[key].length > 0) {
      var values = timers[key].sort(function (a,b) { return a-b; });
      var count = values.length;
      var min = values[0];
      var max = values[count - 1];

      var mean = min;
      var maxAtThreshold = max;

      var message = "";

      var key2;

      for (key2 in pctThreshold) {
        var pct = pctThreshold[key2];
        if (count > 1) {
          var thresholdIndex = Math.round(((100 - pct) / 100) * count);
          var numInThreshold = count - thresholdIndex;
          var pctValues = values.slice(0, numInThreshold);
          maxAtThreshold = pctValues[numInThreshold - 1];

          // average the remaining timings
          var sum = 0;
          for (var i = 0; i < numInThreshold; i++) {
            sum += pctValues[i];
          }

          mean = sum / numInThreshold;
        }

        var clean_pct = '' + pct;
        clean_pct.replace('.', '_');
        rstats['stats_timers_' + key + '_mean_'  + clean_pct] = mean;
        rstats['stats_timers_' + key + '_upper_' + clean_pct] = maxAtThreshold;
      }

      rstats['stats_timers_' + key + '_upper'] = max;
      rstats['stats_timers_' + key + '_lower'] = min;
      rstats['stats_timers_' + key + '_count'] = count;
      statString += message;

      numStats += 1;
    } else {
      // Report timers, regardless of length, to get around Ganglia expiry.
      var clean_pct = '' + pct;
      clean_pct.replace('.', '_');
      rstats['stats_timers_' + key + '_mean_'  + clean_pct] = mean;
      rstats['stats_timers_' + key + '_upper_' + clean_pct] = maxAtThreshold;
      rstats['stats_timers_' + key + '_upper'] = max;
      rstats['stats_timers_' + key + '_lower'] = min;
      rstats['stats_timers_' + key + '_count'] = count;
      numStats += 1;
    }
  }

  for (key in gauges) {
    rstats['stats_gauges_' + key] = gauges[key];
    numStats += 1;
  }

  rstats['statsd_numStats'] = numStats;
  post_stats(rstats);
};

var backend_status = function ganglia_status(writeCb) {
  for (stat in gangliaStats) {
    writeCb(null, 'ganglia', stat, gangliaStats[stat]);
  }
};

exports.init = function ganglia_init(startup_time, config, events) {
  debug = config.debug && config.ganglia.debug;
  gangliaHost = config.ganglia.host;
  gangliaPort = config.ganglia.port || 8649;
  gangliaSpoof = config.ganglia.spoof;
  gangliaUseHost = config.ganglia.useHost;
  gangliaGroup = config.ganglia.group || 'StatsD';

  gangliaStatsMappings = config.ganglia.mappings || null;

  gangliaStats.last_flush = startup_time;
  gangliaStats.last_exception = startup_time;

  flushInterval = config.flushInterval;

  events.on('flush', flush_stats);
  events.on('status', backend_status);

  return true;
};

