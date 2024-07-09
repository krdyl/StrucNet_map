$(window).on('load', function() {
  var documentSettings = {};
  var type2icon = {PLS: 'media/leaf.png', 'Forest Census': 'media/Tape-Measure.png', Other: 'media/Kangaroo.png'};
  var type2iconsize = {PLS: [40, 40], 'Forest Census': [40,40], Other: [40,40]}
  var completePoints = false;

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
    var types = [];
    var layers = {};

    for (var i in points) {
      var type = points[i].Type;
      // We currently discern three types of data, if you want to add more add it to the switch case here and add an image to the type2icon dictionary on line 3.
      switch (type) {
        case "PLS":
          points[i].LegendType = "PLS"
          break;
        case "Forest Census":
          points[i].LegendType = "Forest Census"
          break;
        case "Other":
          points[i].LegendType = "Other"
          break;
        default:
          console.warn("ALERT: unidentified data type found (" + type + "), adding to Other type (point " + i + ")")
          points[i].LegendType = "Other"
          type = "Other"
      }
      if (type && types.indexOf(type) === -1) {
        // Add type
        types.push(type);
      }
    }

    // if none of the points have named layers, return no layers
    if (types.length === 0) {
      layers = undefined;
    } else {
      for (var i in types) {
        var name = types[i];
        layers[name] = L.layerGroup();
        layers[name].addTo(map);
      }
    }
    return layers;
  }

  /**
   * Assigns points to appropriate layers and clusters them if needed
   */
  function mapPoints(points, layers, baselayers) {
    var markerArray = [];
    // check that map has loaded before adding points to it?
    for (var i in points) {
      var point = points[i];
      // extract month from starting date
      point.Month = point['Start Date'].substring(0,20)

      size = type2iconsize[point.LegendType]
      var anchor = [size[0] / 2, size[1] / 2];

      var icon = L.icon({
          iconUrl: type2icon[point.LegendType],
          iconSize: size,
          iconAnchor: anchor
      });


      if (point.Latitude !== '' && point.Longitude !== '') {
        var marker = L.marker([point.Latitude, point.Longitude], {icon: icon})
          .bindPopup('<b>Plot Name: ' + point['Plot Name'] + '</b><br>' +
                  'Data type: ' + point['Type'] + '<br>' +
                  'Start date: ' + point['Month'] + '<br>' +
                  'Protocol: ' + point['Protocol'] + '<br>' +
                  'Instrument: ' + point['Instrument'] + '<br>' +
                  'Lead Investigator: ' + point['Lead Investigator'] + '<br>' +
                  'Forest type: ' + point['Forest type']
              );

        if (layers !== undefined && layers.length !== 1) {
          marker.addTo(layers[point.LegendType]);
        }

        markerArray.push(marker);
      }
    }
 
    var group = L.featureGroup(markerArray);
    var clusters = (getSetting('_markercluster') === 'on') ? true : false;

    // if layers.length === 0, add points to map instead of layer
    if (layers === undefined || layers.length === 0) {
      map.addLayer(
        clusters ? L.markerClusterGroup().addLayer(group).addTo(map) : group
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

    }

    // add legend if in settings
    var pos = (getSetting('_pointsLegendPos') == 'off') ? 'topleft' : getSetting('_pointsLegendPos');
  

    var pointsLegend = L.control.layers(baselayers, layers, {
      collapsed: false,
      position: pos,
    });

    if (getSetting('_pointsLegendPos') !== 'off') {
      pointsLegend.addTo(map);
      pointsLegend._container.id = 'points-legend';
    }

    $(".leaflet-control-layers-list").addClass("ladder")
    // add title
    if (getSetting('_pointsLegendTitle')) {
      $('#points-legend').prepend('<h4 class="pointer">' + getSetting('_pointsLegendTitle') + '</h4>');
    }
    // add titles to baselayers and overlay, these are clickable to make them collapse
    $(".leaflet-control-layers-base").prepend("<h4 class='pointer'>Background</h4>");
    $(".leaflet-control-layers-overlays").prepend("<h4 class='pointer'>Data types</h4>");

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
          if (map.hasLayer(layers[points[i].LegendType]) &&
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

    // get settings from file into dictionary
    createDocumentSettings(options);

    document.title = getSetting('_mapTitle');

    // Add base satellite and street layers
    baselayers = addBaseMap();

    // Add point markers to the map
    var layers;
    var group = '';
    if (points && points.length > 0) {
      layers = determineLayers(points);
      group = mapPoints(points, layers, baselayers);
    } else {
      completePoints = true;
    }

    // Center point on map
    centerAndZoomMap(group);

    // Add daylight indicator and move on action
    // var terminator = L.terminator().addTo(map);
    // map.addEventListener('zoomstart movestart popupopen', function(e) {
    // 	terminator.setTime();
    // });

    // Add Search bar
    if (getSetting('_mapSearch') !== 'off') {
      try {
        var geocoder = L.Control.geocoder({
          expand: 'click',
          position: getSetting('_mapSearch'),
          defaultMarkGeocode: false,
          expanded: true,
        })
        .on('markgeocode', function(e) {
          var bbox = e.geocode.bbox;
          var poly = L.polygon([
            bbox.getSouthEast(),
            bbox.getNorthEast(),
            bbox.getNorthWest(),
            bbox.getSouthWest()
          ])
          map.flyToBounds(poly.getBounds());
        }).addTo(map);

      } catch(error) {
        console.error(error)
        console.log("Likely gave an invalid Search button position in settings. Check config file, valid options are: topleft, topright, bottomleft, bottomright.")
      }
    }

    // Add show your location button
    if (getSetting('_mapMyLocation') !== 'off') {
      try {
        var locationControl = L.control.locate({
          keepCurrentZoomLevel: true,
          returnToPrevBounds: true,
          position: getSetting('_mapMyLocation')
        }).addTo(map);
      } catch (error) {
        console.error(error)
        console.log("Likely gave an invalid Location button position in settings. Check config file, valid options are: topleft, topright, bottomleft, bottomright.")
      }
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
      try {
        L.control.zoom({position: getSetting('_mapZoom')}).addTo(map);
      } catch(error) {
        console.error(error)
        console.log("Likely gave an invalid Zoom button position in settings. Check config file, valid options are: topleft, topright, bottomleft, bottomright.")
      }
    };

    //addTitle();

    // Change Map attribution to include author's info + urls
    changeAttribution();
    // also change anytime base layer changes
    map.on('baselayerchange', function(e) {
      changeAttribution();
    })

    // Append icons to categories in markers legend
    $('#points-legend .leaflet-control-layers-overlays span').each(function(i) {
      var type = $(this).text().trim();
      var legendIcon = (type2icon[ type ].indexOf('.') > 0)
        ? '<img src="' + type2icon[ type ] + '" class="markers-legend-icon" style="width:30px;height:30px;">'
        : '&nbsp;<i class="fas fa-map-marker" style="color: '
          + group2color[ type ]
          + '"></i>';
      $(this).append(legendIcon);
    });

    // When all processing is done, hide the loader and make the map visible
    showMap();

    function showMap() {
      if (completePoints) {

        // add an arrow to both base layers title and overlay layers title
        $('.ladder h4').append('<span class="legend-arrow"><i class="fas fa-chevron-up"></i></span>');

        // on click: minimize only this section, independent of rest of legend
        $('.ladder h4').click(function() {
          parentDiv = $(this).parent()
          if (parentDiv.hasClass('minimize')) {
            parentDiv.removeClass('minimize')
              .find('.legend-arrow i')
              .removeClass('fa-chevron-down')
              .addClass('fa-chevron-up');
          } else {
            parentDiv.addClass('minimize');
            parentDiv.find('.legend-arrow i')
              .removeClass('fa-chevron-up')
              .addClass('fa-chevron-down');
          }
        });

        $('#map').css('visibility', 'visible');
        $('.loader').hide();

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
      //ar title = '<h3 class="pointer">' + getSetting('_mapTitle') + '</h3>';
      // show image instead of title
      var title = '<img src="media/cavelab.png" width="180" height="170">';
      //var subtitle = '<h5>' + getSetting('_mapSubtitle') + '</h5>';
      // no subtitle
      var subtitle = ''

      if (dispTitle == 'topleft') {
        $('div.leaflet-top').prepend('<div class="map-title leaflet-bar leaflet-control leaflet-control-custom">' + title + subtitle + '</div>');
      } else if (dispTitle == 'topcenter') {
        $('#map').append('<div class="div-center"></div>');
        $('.div-center').append('<div class="map-title leaflet-bar leaflet-control leaflet-control-custom">' + title + subtitle + '</div>');
      }

      $('.map-title h3').click(function() { location.reload(); });
    }
  }


  /**
   * Changes map attribution (author, GitHub repo, email etc.) in bottom-right
   */
  function changeAttribution() {
    var attributionHTML = $('.leaflet-control-attribution')[0].innerHTML;
    var credit = 'Q-Forestlab, Ghent University'
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

    credit += 'View <a href="' + getSetting('_githubRepo') + '" target="_blank" rel="noopener noreferrer">code | </a>';
    if (getSetting('_codeCredit')) credit += ' by ' + getSetting('_codeCredit');
    //credit += ' with ';
    $('.leaflet-control-attribution')[0].innerHTML = credit + attributionHTML;
  }


  /**
   * Loads the basemap and adds it to the map
   */
  function addBaseMap() {
    L.mapbox.accessToken = 'pk.eyJ1IjoiYXJtc3RvbmoiLCJhIjoiY2wxcHpzNTdzMWRzdDNxdWtkY3czMWg1ciJ9.ceaKeSGntwx0hwyZdLfF4g';
    var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    })
    var mapbox = L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=' + L.mapbox.accessToken, {
        maxZoom: 18,
        attribution: '© <a href="https://www.mapbox.com/contribute/">Mapbox</a>'
    })
    var baselayers = {
      "Streets": osm,
      "Satellite": mapbox
    };
    // show attributes on position defined in settings
    L.control.attribution({
      position: trySetting('_mapAttribution', 'bottomright')
    }).addTo(map);
    // show openstreetmap layer by default
    osm.addTo(map);
    return baselayers
  }


  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getSetting(s) {
    return documentSettings[constants[s]];
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
   * Reformulates documentSettings as a dictionary, e.g.
   * {"webpageTitle": "Leaflet Boilerplate", "infoPopupText": "Stuff"}
   */
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }


  /**
   * Triggers the load of the spreadsheet and map creation
   * 
   * Can change here to Sharepoint API or csv on share if ever desired
   */
   $.ajax({
       url:'./csv/cavelab-metadata-config-options.csv',
       type:'HEAD',
       error: function() {
         console.log("CSV file not found!")
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
          $.get('./csv/strucnetdata_map.csv')
        ).done(function(options, points) {
          // load data
          onMapDataLoad( parse(options), parse(points))

        })

       }
   });


});
