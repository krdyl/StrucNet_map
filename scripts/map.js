$(window).on('load', function() {
  var documentSettings = {};
  var group2color = {};

  var completePoints = false;

  /**
   * Returns an Awesome marker with specified parameters
   */
  function createMarkerIcon(icon, prefix, markerColor, iconColor) {
    return L.AwesomeMarkers.icon({
      icon: icon,
      prefix: prefix,
      markerColor: markerColor,
      iconColor: iconColor
    });
  }


  /**
   * Sets the map view so that all markers are visible, or
   * to specified (lat, lon) and zoom if all three are specified
   */
  function centerAndZoomMap(points) {
    var lat = map.getCenter().lat, latSet = false;
    var lon = map.getCenter().lng, lonSet = false;
    var zoom = 12, zoomSet = false;
    var center;

    if (getSetting('_initLat') !== '') {
      lat = getSetting('_initLat');
      latSet = true;
    }

    if (getSetting('_initLon') !== '') {
      lon = getSetting('_initLon');
      lonSet = true;
    }

    if (getSetting('_initZoom') !== '') {
      zoom = parseInt(getSetting('_initZoom'));
      zoomSet = true;
    }

    if ((latSet && lonSet) || !points) {
      center = L.latLng(lat, lon);
    } else {
      center = points.getBounds().getCenter();
    }

    if (!zoomSet && points) {
      zoom = map.getBoundsZoom(points.getBounds());
    }

    map.setView(center, zoom);
  }


  /**
   * Given a collection of points, determines the layers based on 'Group'
   * column in the spreadsheet.
   */
  function determineLayers(points) {
    var groups = [];
    var layers = {};

    for (var i in points) {
      var group = points[i].Group;
      if (group && groups.indexOf(group) === -1) {
        // Add group to groups
        groups.push(group);

        // Add color to the crosswalk
        group2color[ group ] = 'media/aus_tls_sites_display.png'
        //group2color[ group ] = points[i]['Marker Icon'].indexOf('.') > 0
        //  ? points[i]['Marker Icon']
        //  : points[i]['Marker Color'];
      }
    }

    // if none of the points have named layers, return no layers
    if (groups.length === 0) {
      layers = undefined;
    } else {
      for (var i in groups) {
        var name = groups[i];
        layers[name] = L.layerGroup();
        layers[name].addTo(map);
      }
    }
    return layers;
  }

  /**
   * Assigns points to appropriate layers and clusters them if needed
   */
  function mapPoints(points, layers) {
    var markerArray = [];
    // check that map has loaded before adding points to it?
    for (var i in points) {
      var point = points[i];

      // If icon contains '.', assume it's a path to a custom icon,
      // otherwise create a Font Awesome icon
      //var iconSize = point['Custom Size'];
      //var size = (iconSize.indexOf('x') > 0)
      //  ? [parseInt(iconSize.split('x')[0]), parseInt(iconSize.split('x')[1])]
      //  : [32, 32];
      var size = [60, 60];

      var anchor = [size[0] / 2, size[1] / 2];

      var icon = L.icon({
          iconUrl: 'media/aus_tls_sites_display.png',
          iconSize: size,
          iconAnchor: anchor
      });

      //var icon = (point['Marker Icon'].indexOf('.') > 0)
      //  ? L.icon({
      //    iconUrl: point['Marker Icon'],
      //    iconSize: size,
      //    iconAnchor: anchor
      //  })
      //  : createMarkerIcon(point['Marker Icon'],
      //    'fa',
      //    point['Marker Color'].toLowerCase(),
      //    point['Icon Color']
      //  );

      if (point.Latitude !== '' && point.Longitude !== '') {
        var marker = L.marker([point.Latitude, point.Longitude], {icon: icon})
          .bindPopup('<b>Name: ' + point['Name'] + '</b><br>' +
          'Group: ' + point['Group'] + '<br>' +
          'Datetime: ' + point['Datetime'] + '<br>' +
          'Protocol: ' + point['Protocol'] + '<br>' +
          'Area: ' + point['Area'] + '<br>' +
          'Instrument: ' + point['Instrument'] + '<br>' +
          'Angular resolution: ' + point['Angular Resolution'] + '<br>' +
          'Pulse rate: ' + point['Pulse Rate'] + '<br>' +
          'Light: ' + point['Light'] + '<br>' +
          'Wind: ' + point['Wind'] + '<br>' +
          'Survey control: ' + point['Survey Control'] + '<br>' +
          'QSM: ' + point['QSM'] + '<br>' +
          'Open data: ' + point['Open'] + '<br>' +
          (point['Image'] ? ('<img src="' + point['Image'] + '"><br>') : '') +
          'Description: ' + point['Description']);

        if (layers !== undefined && layers.length !== 1) {
          marker.addTo(layers[point.Group]);
        }

        markerArray.push(marker);
      }
    }

    var group = L.featureGroup(markerArray);
    var clusters = (getSetting('_markercluster') === 'on') ? true : false;

    // if layers.length === 0, add points to map instead of layer
    if (layers === undefined || layers.length === 0) {
      map.addLayer(
        clusters
        ? L.markerClusterGroup().addLayer(group).addTo(map)
        : group
      );
    } else {
      if (clusters) {
        // Add multilayer cluster support
        multilayerClusterSupport = L.markerClusterGroup.layerSupport();
        multilayerClusterSupport.addTo(map);

        for (i in layers) {
          multilayerClusterSupport.checkIn(layers[i]);
          layers[i].addTo(map);
        }
      }

      var pos = (getSetting('_pointsLegendPos') == 'off')
        ? 'topleft'
        : getSetting('_pointsLegendPos');

      var pointsLegend = L.control.layers(null, layers, {
        collapsed: false,
        position: pos,
      });

      if (getSetting('_pointsLegendPos') !== 'off') {
        pointsLegend.addTo(map);
        pointsLegend._container.id = 'points-legend';
        pointsLegend._container.className += ' ladder';
      }
    }

    $('#points-legend').prepend('<h6 class="pointer">' + getSetting('_pointsLegendTitle') + '</h6>');
    if (getSetting('_pointsLegendIcon') != '') {
      $('#points-legend h6').prepend('<span class="legend-icon"><i class="fas '
        + getSetting('_pointsLegendIcon') + '"></i></span>');
    }

    var displayTable = getSetting('_displayTable') == 'on' ? true : false;

    // Display table with active points if specified
    var columns = getSetting('_tableColumns').split(',')
                  .map(Function.prototype.call, String.prototype.trim);

    if (displayTable && columns.length > 1) {
      tableHeight = trySetting('_tableHeight', 40);
      if (tableHeight < 10 || tableHeight > 90) {tableHeight = 40;}
      $('#map').css('height', (100 - tableHeight - 2) + 'vh');
      map.invalidateSize();

      // Set background (and text) color of the table header
      var colors = getSetting('_tableHeaderColor').split(',');
      if (colors[0] != '') {
        $('table.display').css('background-color', colors[0]);
        if (colors.length >= 2) {
          $('table.display').css('color', colors[1]);
        }
      }

      // Update table every time the map is moved/zoomed or point layers are toggled
      map.on('moveend', updateTable);
      map.on('layeradd', updateTable);
      map.on('layerremove', updateTable);

      // Clear table data and add only visible markers to it
      function updateTable() {
        var pointsVisible = [];
        for (i in points) {
          if (map.hasLayer(layers[points[i].Group]) &&
              map.getBounds().contains(L.latLng(points[i].Latitude, points[i].Longitude))) {
            pointsVisible.push(points[i]);
          }
        }

        tableData = pointsToTableData(pointsVisible);

        table.clear();
        table.rows.add(tableData);
        table.draw();
      }

      // Convert Leaflet marker objects into DataTable array
      function pointsToTableData(ms) {
        var data = [];
        for (i in ms) {
          var a = [];
          for (j in columns) {
            a.push(ms[i][columns[j]]);
          }
          data.push(a);
        }
        return data;
      }

      // Transform columns array into array of title objects
      function generateColumnsArray() {
        var c = [];
        for (i in columns) {
          c.push({title: columns[i]});
        }
        return c;
      }

      // Initialize DataTable
      var table = $('#maptable').DataTable({
        "dom": '<"top">rt<"bottom"if>',
        paging: false,
        scrollCollapse: true,
        scrollY: 'calc(' + tableHeight + 'vh - 50px)',
        info: true,
        searching: true,
        columns: generateColumnsArray(),
        "language": {
          "info": "Showing _TOTAL_ plot scale acquisitions",
        },
      });

    }

    completePoints = true;
    return group;
  }

  /**
   * Here all data processing from the spreadsheet happens
   */
  function onMapDataLoad(options, points) {

    createDocumentSettings(options);

    document.title = getSetting('_mapTitle');
    addBaseMap();

    // Add point markers to the map
    var layers;
    var group = '';
    if (points && points.length > 0) {
      layers = determineLayers(points);
      group = mapPoints(points, layers);
    } else {
      completePoints = true;
    }

    centerAndZoomMap(group);

    var terminator = L.terminator().addTo(map);
    map.addEventListener('zoomstart movestart popupopen', function(e) {
    	terminator.setTime();
    });

    // Add Nominatim Search control
    if (getSetting('_mapSearch') !== 'off') {
      var geocoder = L.Control.geocoder({
        expand: 'click',
        position: getSetting('_mapSearch'),

        geocoder: L.Control.Geocoder.nominatim({
          geocodingQueryParams: {
            viewbox: '',  // by default, viewbox is empty
            bounded: 1,
          }
        }),
      }).addTo(map);

      function updateGeocoderBounds() {
        var bounds = map.getBounds();
        geocoder.options.geocoder.options.geocodingQueryParams.viewbox = [
            bounds._southWest.lng, bounds._southWest.lat,
            bounds._northEast.lng, bounds._northEast.lat
          ].join(',');
      }

      // Update search viewbox coordinates every time the map moves
      map.on('moveend', updateGeocoderBounds);
    }

    // Add location control
    if (getSetting('_mapMyLocation') !== 'off') {
      var locationControl = L.control.locate({
        keepCurrentZoomLevel: true,
        returnToPrevBounds: true,
        position: getSetting('_mapMyLocation')
      }).addTo(map);
    };

    // Add zoom reset control
    L.easyButton({
      id: 'reset-zoom',
      position: 'topright',
      type: 'replace',
      leafletClasses: true,
      states:[{
        stateName: 'get-center',
        onClick: function(button, map){
          centerAndZoomMap(group);
        },
        title: 'Reset Zoom',
        icon: 'fa-globe'}]
    }).addTo(map);

    // Add zoom control
    if (getSetting('_mapZoom') !== 'off') {
      L.control.zoom({position: getSetting('_mapZoom')}).addTo(map);
    };

    addTitle();

    // Change Map attribution to include author's info + urls
    changeAttribution();

    // Append icons to categories in markers legend
    $('#points-legend label span').each(function(i) {
      var g = $(this).text().trim();
      var legendIcon = (group2color[ g ].indexOf('.') > 0)
        ? '<img src="' + group2color[ g ] + '" class="markers-legend-icon">'
        : '&nbsp;<i class="fas fa-map-marker" style="color: '
          + group2color[ g ]
          + '"></i>';
      //$(this).prepend(legendIcon);
    });

    // When all processing is done, hide the loader and make the map visible
    showMap();

    function showMap() {
      if (completePoints) {
        $('.ladder h6').append('<span class="legend-arrow"><i class="fas fa-chevron-down"></i></span>');
        $('.ladder h6').addClass('minimize');

        $('.ladder h6').click(function() {
          if ($(this).hasClass('minimize')) {
            $('.ladder h6').addClass('minimize');
            $('.legend-arrow i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
            $(this).removeClass('minimize')
              .parent().find('.legend-arrow i')
              .removeClass('fa-chevron-down')
              .addClass('fa-chevron-up');
          } else {
            $(this).addClass('minimize');
            $(this).parent().find('.legend-arrow i')
              .removeClass('fa-chevron-up')
              .addClass('fa-chevron-down');
          }
        });

        $('.ladder h6').first().click();

        $('#map').css('visibility', 'visible');
        $('.loader').hide();

        // Open intro popup window in the center of the map
        if (getSetting('_introPopupText') != '') {
          initIntroPopup(getSetting('_introPopupText'), map.getCenter());
        };

      } else {
        setTimeout(showMap, 50);
      }
    }
  }

  /**
   * Adds title and subtitle from the spreadsheet to the map
   */
  function addTitle() {
    var dispTitle = getSetting('_mapTitleDisplay');

    if (dispTitle !== 'off') {
      // var title = '<h3 class="pointer">' + getSetting('_mapTitle') + '</h3>';
      var title = '<img src="media/cavelab.png" alt="CAVElab Metadata" width="180" height="110">';
      var subtitle = '' //'<h5>' + getSetting('_mapSubtitle') + '</h5>';

      if (dispTitle == 'topleft') {
        $('div.leaflet-top').prepend('<div class="map-title leaflet-bar leaflet-control leaflet-control-custom">' + title + subtitle + '</div>');
      } else if (dispTitle == 'topcenter') {
        $('#map').append('<div class="div-center"></div>');
        $('.div-center').append('<div class="map-title leaflet-bar leaflet-control leaflet-control-custom">' + title + subtitle + '</div>');
      }

      $('.map-title h3').click(function() { location.reload(); });
    }
  }


  function initIntroPopup(info, coordinates) {
    // This is a pop-up for mobile device
    if (window.matchMedia("only screen and (max-width: 760px)").matches) {
      $('body').append('<div id="mobile-intro-popup"><p>' + info +
        '</p><div id="mobile-intro-popup-close"><i class="fas fa-times"></i></div></div>');

      $('#mobile-intro-popup-close').click(function() {
        $("#mobile-intro-popup").hide();
      });
      return;
    }

    /* And this is a standard popup for bigger screens */
    L.popup({className: 'intro-popup'})
      .setLatLng(coordinates) // this needs to change
      .setContent(info)
      .openOn(map);
  }


  /**
   * Changes map attribution (author, GitHub repo, email etc.) in bottom-right
   */
  function changeAttribution() {
    var attributionHTML = $('.leaflet-control-attribution')[0].innerHTML;
    var credit = 'University of Maryland' //'View <a href="' + googleDocURL + '" target="_blank">data</a>';
    var name = getSetting('_authorName');
    var url = getSetting('_authorURL');

    if (name && url) {
      if (url.indexOf('@') > 0) { url = 'mailto:' + url; }
      credit += ' by <a href="' + url + '">' + name + '</a> | ';
    } else if (name) {
      credit += ' by ' + name + ' | ';
    } else {
      credit += ' | ';
    }

    //credit += 'View <a href="' + getSetting('_githubRepo') + '">code</a>';
    if (getSetting('_codeCredit')) credit += ' by ' + getSetting('_codeCredit');
    //credit += ' with ';
    $('.leaflet-control-attribution')[0].innerHTML = credit + attributionHTML;
  }


  /**
   * Loads the basemap and adds it to the map
   */
  function addBaseMap() {
    console.log("adding base map")
    L.mapbox.accessToken = 'pk.eyJ1IjoiYXJtc3RvbmoiLCJhIjoiY2wxcHpzNTdzMWRzdDNxdWtkY3czMWg1ciJ9.ceaKeSGntwx0hwyZdLfF4g';
    // L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //   maxZoom: 18,
    //   attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    // }).addTo(map);
    L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=' + L.mapbox.accessToken, {
        maxZoom: 18,
        attribution: '© <a href="https://www.mapbox.com/contribute/">Mapbox</a>'
    }).addTo(map);
    L.control.attribution({
      position: trySetting('_mapAttribution', 'bottomright')
    }).addTo(map);
  }


  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getSetting(s) {
    return documentSettings[constants[s]];
  }

  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getPolygonSetting(p, s) {
    if (polygonSettings[p]) {
      return polygonSettings[p][constants[s]];
    }
    return false;
  }

  /**
   * Returns the value of setting named s from constants.js
   * or def if setting is either not set or does not exist
   * Both arguments are strings
   * e.g. trySetting('_authorName', 'No Author')
   */
  function trySetting(s, def) {
    s = getSetting(s);
    if (!s || s.trim() === '') { return def; }
    return s;
  }

  /**
   * Triggers the load of the spreadsheet and map creation
   */

   // Google Sheets URL
   var googleDocMetadataURL = 'https://docs.google.com/spreadsheets/d/1d5BlpZQ3l2tTOqfxvRQB_TvKZdPM8x2qjjqTn0gRz7g/edit#gid=0';
   var googleDocConfigURL = 'https://docs.google.com/spreadsheets/d/1CdEG2zkD8NaZ6b2su85-_FpKemJs_eoS0fKFEB49SKk/edit#gid=1284643617';

   // Google Sheets API key
   var googleApiKey = 'AIzaSyDanPnCLHaibRMiGUbOERi40ElVTsMPhZY';

   var mapData;

   $.ajax({
       url:'./csv/cavelab-metadata-config-options.csv',
       type:'HEAD',
       error: function() {
         // Options.csv does not exist in the root level, so use Tabletop to fetch data from
         // the Google sheet

         if (typeof googleApiKey !== 'undefined' && googleApiKey) {

          var parse = function(res) {
            return Papa.parse(Papa.unparse(res[0].values), {header: true, skipEmptyLines:true} ).data;
          }

          var apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets/'
          var configspreadsheetId = googleDocConfigURL.indexOf('/d/') > 0
            ? googleDocConfigURL.split('/d/')[1].split('/')[0]
            : googleDocConfigURL
          var metadataspreadsheetId = googleDocMetadataURL.indexOf('/d/') > 0
            ? googleDocMetadataURL.split('/d/')[1].split('/')[0]
            : googleDocMetadataURL

          $.getJSON(
            apiUrl + configspreadsheetId + '?key=' + googleApiKey
          ).then(function(data) {
              var sheets = data.sheets.map(function(o) { return o.properties.title })

              if (sheets.length === 0 || !sheets.includes('Options')) {
                'Could not load data from the Google Sheet'
              }

              // First, read 3 sheets: Options, Points, and Polylines
              $.when(
                $.getJSON(apiUrl + configspreadsheetId + '/values/Options?key=' + googleApiKey),
                $.getJSON(apiUrl + metadataspreadsheetId + '/values/TLS-Metadata?key=' + googleApiKey)
              ).done(function(options, points) {

                // load data
                onMapDataLoad( parse(options), parse(points))
              })

            }
          )

         } else {
          alert('You cannot load data from a Google Sheet, you need to add a free Google API key')
         }

       },

       /*
       Loading data from CSV files.
       */
       success: function() {

        var parse = function(s) {
          return Papa.parse(s[0], {header: true, skipEmptyLines: true}).data
        }

        $.when(
          $.get('./csv/cavelab-metadata-config-options.csv'),
          $.get('./csv/cavelab-metadata.csv')
        ).done(function(options, points) {
          
          // load data
          console.log("loading map")
          onMapDataLoad( parse(options), parse(points))

        })

       }
   });

  /**
   * Reformulates documentSettings as a dictionary, e.g.
   * {"webpageTitle": "Leaflet Boilerplate", "infoPopupText": "Stuff"}
   */
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }

});
