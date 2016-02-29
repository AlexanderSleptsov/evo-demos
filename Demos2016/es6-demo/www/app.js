

var container = document.getElementById('container');
var chart;
$(document).ready(function () {
  Highcharts.setOptions({
    global: {
      useUTC: false
    }
  });
  $(container).highcharts({
    plotOptions: {
      series: {
        animation: false
      },
      spline: {
        animation: false
      },
      line: {
        animation: false,
        marker: { enabled: false }
      }
    },
    chart: {
      type: 'line',
      animation: false,
      marginRight: 10,
      events: {
        load: function load() {
          chart = this;
        }
      }
    },

    title: {
      text: 'Devicemotion'
    },

    xAxis: {
      type: 'linear',
      minRange: 10000,
      min: 0
    },

    yAxis: {
      title: {
        text: 'Value'
      },

      plotLines: [{
        value: 0, width: 1, color: '#808080'
      }],
      min: -3,
      max: 90
    },

    tooltip: {
      enabled: false
    },

    legend: {
      enabled: false
    },

    exporting: {
      enabled: false
    }
  });
});

var gotEventInLast500ms = false;
var _geilTimer = null;
var devices = {};

function addPoint(id, z) {
  if (!devices[id]) {
    var serie = chart.addSeries({
      name: 'Another one',
      data: []
    });
    devices[id] = {
      firstEventFromDevice: Date.now(),
      firstEventOnServer: Date.now(),
      serie: serie,
      offset: 0
    };
    serie.device = devices[id];
    if (gotEventInLast500ms) {
      // we need to sync this thing up with the other chart. We use series[0] as a basic
      devices[id].offset = Date.now() - chart.series[0].device.firstEventOnServer;
    }
  }
  gotEventInLast500ms = true;
  clearTimeout(_geilTimer);
  _geilTimer = setTimeout(function () {
    console.log('Didnt get event in last 1000ms');
    gotEventInLast500ms = false;
  }, 1000);
  var dev = devices[id];
  var t = dev.offset + Date.now() - dev.firstEventFromDevice;
  dev.serie.addPoint([t, Math.abs(z)], true, dev.serie.points.length > 100);
  if (t > 10000 && t - 10000 > chart.xAxis[0].min) {
    chart.xAxis[0].setExtremes(t - 10000);
  }
}

document.querySelector('#go').onclick = function (e) {
  e.preventDefault();

  navigator.bluetooth.requestDevice({ filters: [{ services: [0x8765] }] }).then(function (device) {
    console.log('Found device ' + device.name);

    return device.connectGATT().then(function (server) {
      console.log('Connected over GATT');
      return server.getPrimaryService(0x8765);
    }).then(function (service) {
      console.log('Got service ' + JSON.stringify(Object.keys(service)));
      return service.getCharacteristic('e95dca4b-251d-470a-a062-fa1922dfa9a8');
    }).then(function (char) {
      console.log('Char: ' + char.uuid);

      // so now we have the characteristic and we can keep reading data...
      function readZ() {
        char.readValue().then(function (buffer) {
          var data = new DataView(buffer);

          var z = data.getUint8(5) << 8 | data.getUint8(4);
          if (z > 32767) {
            // overflow
            z = z - 65535;
          }

          z /= 100;
          // z = Math.abs(z);

          addPoint(device.instanceID, z);
          // document.querySelector('#z').textContent = z.toFixed(2);
        }).then(readZ).catch(function (err) {
          alert('err ' + err + ' ' + JSON.stringify(err));
        });
      }

      readZ();
    });
  }).catch(function (err) {
    alert('' + err + ' ' + JSON.stringify(err));
  });
};