/*
 * L.PtvLayer.XMap is used for putting xMap tile layers on the map.
 */

L.PtvLayer = L.NonTiledLayer.extend({

    defaultXMapParams: {
        format: 'PNG',
        token: ''
    },

    initialize: function (url, options) { // (String, Object)
        this._url = url;
        var xMapParams = L.extend({}, this.defaultXMapParams);

        for (var i in options) {
            // all keys that are not NonTiledLayer options go to xMap params
            if (!this.options.hasOwnProperty(i)) {
                xMapParams[i] = options[i];
            }
        }

        this.xMapParams = xMapParams;

        L.NonTiledLayer.prototype.initialize.call(this, options);
    },

    onAdd: function (map) {
        this._poiMarkers = L.featureGroup().addTo(map);

        L.NonTiledLayer.prototype.onAdd.call(this, map);
    },

    onRemove: function (map) {
        map.removeLayer(this._poiMarkers);
        L.NonTiledLayer.prototype.onRemove.call(this, map);
    },

    getImageUrlAsync: function (world1, world2, width, height, key, callback) {
        var xMapParams = this.xMapParams;
        xMapParams.width = width;
        xMapParams.height = height;

        request = this.getRequest(world1, world2, width, height);

        this.runRequest(this._url + '/xmap/rs/XMap/renderMapBoundingBox', request, this.xMapParams.token,
            function (resp) {
                var prefixMap = {
                    "iVBOR": "data:image/png;base64,",
                    "R0lGO": "data:image/gif;base64,",
                    "/9j/4": "data:image/jpeg;base64,",
                    "Qk02U": "data:image/bmp;base64,"
                };
                var rawImage = resp.image.rawImage;
                callback(key, prefixMap[rawImage.substr(0, 5)] + rawImage, resp);
            }, function (xhr) { callback(L.Util.emptyImageUrl); });
    },

    _addInteraction: function (resp) {
        this._poiMarkers.clearLayers();

        if (!resp.objects[0])
            return;

        objects = resp.objects[0].objects,
        myIcon = L.divIcon({
            className: 'poi-icon',
            iconSize: [32, 32]
        });

        for (var i = 0; i < objects.length; i++) {
            if (objects[i].geometry) {
                var lineString = [];
                for (var j = 0; j < objects[i].geometry.pixelGeometry.points.length; j++) {
                    var p = objects[i].geometry.pixelGeometry.points[j];
                    var g = this._map.containerPointToLatLng([p.x, p.y]);
                    lineString[j] = [g.lat, g.lng];
                }
                var tooltip = objects[i].descr;

                // create a transparent polyline from an arrays of LatLng points and bind it to the popup
                var polyline = L.polyline(lineString, {
                    color: 'white',
                    "weight": 20,
                    opacity: .0,
                    noClip: true
                }).bindPopup(tooltip).addTo(this._poiMarkers);
            }

            // http://stackoverflow.com/questions/17028830/imageoverlay-and-rectangle-z-index-issue						
            svgObj = $('.leaflet-overlay-pane svg');
            svgObj.css('z-index', 9999);

            latlng = this._map.containerPointToLatLng([objects[i].pixel.x, objects[i].pixel.y]);
            L.marker(latlng, {
                icon: myIcon,
                zIndexOffset: i // will correct overlapping objects?
            }).bindPopup(objects[i].descr).addTo(this._poiMarkers);
        }
    },

    // runRequest executes a json request on PTV xServer internet, 
    // given the url endpoint, the token and the callbacks to be called
    // upon completion. The error callback is parameterless, the success
    // callback is called with the object returned by the server. 
    runRequest: function (url, request, token, handleSuccess, handleError) {
        $.ajax({
            url: url,
            type: "POST",
            data: JSON.stringify(request),

            headers: {
                "Authorization": "Basic " + btoa("xtok:" + token),
                "Content-Type": "application/json"
            },

            success: function (data, status, xhr) {
                handleSuccess(data);
            },

            error: function (xhr, status, error) {
                handleError(xhr);
            }
        });
    },

    setParams: function (params, noRedraw) {

        L.extend(this.xMapParams, params);

        if (!noRedraw) {
            this.redraw();
        }

        return this;
    },

    getRequest: function (world1, world2, width, height) {
        request = {
            "mapSection":
                {
                    "leftTop":
                      {
                          "$type": "Point", "point":
                            { "$type": "PlainPoint", "x": world1.lng, "y": world1.lat }
                      }, "rightBottom":
                      {
                          "$type": "Point", "point":
                             { "$type": "PlainPoint", "x": world2.lng, "y": world2.lat }
                      }
                }, "mapParams": { "showScale": false, "useMiles": false },
            "imageInfo": { "format": "PNG", "width": width, "height": height },
            "includeImageInResponse": true, "callerContext": {
                "properties": [
                    { "key": "Profile", "value": "ajax-av" },
                    { "key": "CoordFormat", "value": "OG_GEODECIMAL" }]
            }
        };
        return request;
    },
});

L.PtvLayer.XMap = function (url, options) {
    return new L.PtvLayer.XMap(url, options);
};

L.PtvLayer.TruckParking = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        if (options.minZoom == null)
            options.minZoom = 9;
		options.maxZoom = 19;
        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);

        request.layers = [{ "$type": "SMOLayer", "name": "tpe.tpe", "visible": true, "objectInfos": "FULLGEOMETRY" }];

        return request;
    }
});


L.PtvLayer.POI = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        if (options.minZoom == null)
            options.minZoom = 16;
		options.maxZoom = 19;
        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);

        request.layers = [{ "$type": "SMOLayer", "name": "default.points-of-interest", "visible": true, "objectInfos": "FULLGEOMETRY" }];

        return request;
    }
});

L.PtvLayer.TrafficInformation = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        if (options.minZoom == null)
            options.minZoom = 10;
		options.maxZoom = 19;
        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);

        request.layers = [{ "$type": "SMOLayer", "name": "traffic.ptv-traffic", "visible": true, "objectInfos": "FULLGEOMETRY" }];

        return request;
    }
});

L.PtvLayer.DataManager = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        options.minZoom = 0;
		options.maxZoom = 19;
        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);

        request.layers = [{ "$type": "SMOLayer", "name": "t_164a79f7_f40b_4045_97f1_d0c96ebffb3e.t_164a79f7_f40b_4045_97f1_d0c96ebffb3e", "visible": true, "objectInfos": "FULLGEOMETRY" }];
        request.callerContext.properties.push(                    { "key": "ProfileXMLSnippet", "value":  "/profiles/datamanager/xmap/t_164a79f7_f40b_4045_97f1_d0c96ebffb3e" });
        
        return request;
    }
});

L.PtvLayer.TruckAttributes = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        if (options.minZoom == null)
            options.minZoom = 15;
		options.maxZoom = 19;
        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);
        request.layers = [{ "$type": "RoadEditorLayer", "name": "truckattributes", "visible": true, "objectInfos": "FULLGEOMETRY" },
                { "$type": "StaticPoiLayer", "name": "street", "visible": "true", "category": -1, "detailLevel": 0 }];

        request.callerContext.properties[0].value = "truckattributes";

        return request;
    }
});


