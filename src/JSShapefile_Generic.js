/** 
 * JSShapefile - A javascript class for generating ESRI shapefiles in the client from a variety of javascript map
 * API vector formats (ESRI Graphic, Google Maps, Openlayers (TODO)
 * 
 * (c) 2012 Harry Gibson 
 * 
 * Intended as early proof of concept only, not likely to be suitable for robust use yet!
 * 
 * Ideally uses HTML5 Dataview and Arraybuffer objects, to create the binary data, which is then used to build
 * Blob objects that can then be saved to disk using the FileSaver method. 
 * However, all this is fully implemented only in Webkit browsers (Chrome) at time of writing. 
 * Therefore to achieve greater compatibility:
 * - jDataView_write has been created that gives DataView functionality where it isn't already available
 * - BlobBuilder.js from eli grey has been used to give Blob functionality where it isn't available, and to give
 *  a common name for it where it is
 * - Downloadify flash library has been used in conjunction with JSZip to enable saving of the created binary 
 * data in browsers where saving from JS either isn't available at all (IE) or results in unmanageable filenames 
 * (Firefox).
 * 
 * Usage: 
 * var shapemaker = new Shapefile({
 * 		shapetype: "POINT" || "POLYLINE" || "POLYGON",
 * }
 * shapemaker.addESRIGraphics(ArrayOfEsriGraphics);
 *  // graphics can be a mix of points, lines, polygons. E.g. use the graphics of an ESRI Graphics Layer
 *  // shapefile will include a unioned set of the graphics' attributes (hopefully)
 * 
 * shapemaker.addGoogleGraphics(ArrayOfGoogleGraphics);
 * // graphics are an array of google maps Markers, Polylines, and Polygons. No attribute handling implemented
 * 
 * shapemaker.addOLGraphics(ArrayOfOpenlayersGraphics); // not implemented yet
 * 
 * shapemaker.shapetype = "POINT"; // output shapefile will use point graphics only
 * var res = shapemaker.getShapefile(); 
 * // res is an object containing the three files as blobs. Save these using FileSaver
 * shapemaker.shapetype = "POLYLINE"; // output shapefile will be polyline type, using the polyline graphics only
 * res = shapemaker.getShapefile(); 
 * // res is an object containing the three files as blobs. Save these using FileSaver
 * shapemaker.shapetype = "POLYGON"; // output shapefile will be polygon type, using the polygon graphics only
 * shapemaker.getShapefile(); 
 * // res is an object containing the three files as blobs. Save these using FileSaver
 * shapemaker.clearAllGraphics();
 * 
 * No awareness of projection / CRS is implemented. Output shapefile will contain coordinates in the form they were
 * in the input graphics. (The CRS of the ESRI map, or WGS84 lat/lon for google graphics). This could easily be
 * improved using proj4js or similar
 */

var ShapeTypes = {
	"POINT":1,
	"POLYLINE":3,
	"POLYGON":5
}
Object.freeze(ShapeTypes);
//pad strings on the left
String.prototype.lpad = function(padString, length) {
	var str = this;
    while (str.length < length)
        str = padString + str;
    return str;
}
 
//pad strings on the right
String.prototype.rpad = function(padString, length) {
	var str = this;
    while (str.length < length)
        str = str + padString;
    return str;
}
if(!Array.indexOf){
	    Array.prototype.indexOf = function(obj){
	        for(var i=0; i<this.length; i++){
	            if(this[i]==obj){
	                return i;
	            }
	        }
	        return -1;
	    }
}

var Shapefile = function (params){
	this.shapetype = params.shapetype;
	this.pointgraphics = [];
	this.polylinegraphics = [];
	this.polygongraphics = [];
	
}
Shapefile.prototype.addESRIGraphics = function(esrigraphics){
	for (var i=0;i<esrigraphics.length;i++){
		var thisgraphic = esrigraphics[i];
		if (thisgraphic.geometry){
			if (thisgraphic.geometry.type === "point"){
				this.pointgraphics.push(thisgraphic);
			}
			else if (thisgraphic.geometry.type === "polyline"){
				this.polylinegraphics.push(thisgraphic);
			}
			else if (thisgraphic.geometry.type === "polygon"){
				this.polygongraphics.push(thisgraphic);
			}
		}
	}
}
Shapefile.prototype.addOLGraphics = function (openlayersgraphics){
	// "translate" the openlayers graphics item to something compatible with the esri format before adding
	for (var i=0;i<openlayersgraphics.length;i++){
		var quasiEsriGraphic = {
			geometry:{
				
			}
		}
	}
}
Shapefile.prototype.addGoogleGraphics = function (googlegraphics){
	// "translate" the gmapsgraphics to something compatible with the esri format before adding
	for (var i=0;i<googlegraphics.length;i++){
		var quasiEsriGraphic = {
			geometry: {}
		}
		var thisgraphic = googlegraphics[i];
		if (thisgraphic.position){
			// it's a google maps marker, "position" is a LatLng, retrieve with getPosition()
			quasiEsriGraphic.geometry.x = thisgraphic.getPosition().lng();
			quasiEsriGraphic.geometry.y = thisgraphic.getPosition().lat();
			quasiEsriGraphic.geometry.type = "POINT";
			this.pointgraphics.push(quasiEsriGraphic); 
		}
		else if (thisgraphic.getPaths){
			// only polygons have the getPaths (PLURAL!) function
			// it's a google maps polygon. retrieve each path using getPaths() then each one is an MVCArray
			var ringsMVC = thisgraphic.getPaths();
			var numRings = ringsMVC.getLength();
			quasiEsriGraphic.geometry.rings = [];
			for (var r = 0;r<numRings;r++){
				var ringArray = [];
				var ringMVC = ringsMVC.getAt(r);
				var numVerts = ringMVC.getLength();
				for (var v=0;v<numVerts;v++){
					var vertex = ringMVC.getAt(v);
					ringArray.push([vertex.lng(),vertex.lat()]);
				}
				quasiEsriGraphic.geometry.rings.push(ringArray);
			}
			quasiEsriGraphic.geometry.type = "POLYGON";
			this.polygongraphics.push(quasiEsriGraphic);
		}
		else if (thisgraphic.getPath){
			// lines and polygons both have the getPath (SINGULAR!) function
			// it's a google maps polyline; "path" is an MVCArray of LatLngs, use getPath() to retrieve it
			// then go over the vertices using getAt(i)
			// only one path (part) is allowed 
			var pathMVC = thisgraphic.getPath();
			var length = pathMVC.getLength();
			quasiEsriGraphic.geometry.paths =[[]];
			for (var v=0;v<length;v++){
				var vertex = pathMVC.getAt(v);
				quasiEsriGraphic.geometry.paths[0].push([vertex.lng(),vertex.lat()]);
			}
			quasiEsriGraphic.geometry.type = "POLYLINE";
			this.polylinegraphics.push(quasiEsriGraphic);
		}
	}
}
Shapefile.prototype.clearAllGraphics = function(){
	this.pointgraphics = [];
	this.polylinegraphics = [];
	this.polygongraphics = [];
}
Shapefile.prototype.getShapefile_generic = function(){
	var resultobject = {};
	if (this.shapetype == "POINT" && this.pointgraphics.length > 0){
		// the order of the graphics array must be unchanged between creating shp/shx and dbf
		// all that links geometry to dbf record is the order in the file!
		resultobject=this.createShapeShxFile(this.pointgraphics);
		attributeMap = this.createAttributeMap(this.pointgraphics);
		resultobject["dbf"] = this.createDbf(attributeMap, this.pointgraphics);
		this.pointgraphics = [];
	}
	return resultobject;
	
}
Shapefile.prototype.getShapefile = function(){
	//if (!(WebKitBlobBuilder && DataView)){
	//	alert("Sorry, this only works with a Webkit browser at present. Try Google Chrome!");
	//	return;
	//}
	var resultobject = {};
	if (this.shapetype == "POINT" && this.pointgraphics.length > 0){
		// the order of the graphics array must be unchanged between creating shp/shx and dbf
		// all that links geometry to dbf record is the order in the file!
		resultobject = this.createShapeShxFileWebkit(this.pointgraphics);
		attributeMap = this.createAttributeMap(this.pointgraphics);
		resultobject["dbf"] = this.createDbfWebkit(attributeMap, this.pointgraphics);
		this.pointgraphics = [];
	}
	else if (this.shapetype == "POLYLINE" && this.polylinegraphics.length > 0){
		resultobject = this.createShapeShxFileWebkit(this.polylinegraphics);
		attributeMap = this.createAttributeMap(this.polylinegraphics);
		resultobject["dbf"] = this.createDbfWebkit(attributeMap, this.polylinegraphics);
		this.polylinegraphics = [];
	}
	else if (this.shapetype == "POLYGON" && this.polygongraphics.length > 0){
		resultobject = this.createShapeShxFileWebkit(this.polygongraphics);
		attributeMap = this.createAttributeMap(this.polygongraphics);
		resultobject["dbf"] = this.createDbfWebkit(attributeMap,this.polygongraphics);
		this.polygongraphics = [];
	}
	return resultobject;
}
Shapefile.prototype.createShapeShxFile = function(graphics){
	var headerBuf = jDataView_write.createEmptyBuffer(100,true);
	var shxHeaderBuf = jDataView_write.createEmptyBuffer(100,true);
	var headerDataView = new jDataView_write(headerBuf,100,true); // true to write debug information
	var shxHeaderView = new jDataView_write(shxHeaderBuf,100);
	headerDataView.setInt32(0, 9994); //big-endian
	shxHeaderView.setInt32(0, 9994); //big-endian
	headerDataView.setInt32(28, 1000, true); //little-endian, why on earth are they mixed?
	shxHeaderView.setInt32(28, 1000, true); //little-endian
	// will need to set file length in 16 bit words at byte 24, big-endian
	// now set shape type
	headerDataView.setInt32(32, ShapeTypes[this.shapetype], true); // little-endian
	shxHeaderView.setInt32(32, ShapeTypes[this.shapetype], true); // little-endian
	// now start work on the file contents
	// will get extent by naive method of increasing or decreasing the min / max for each feature outside those currently set
	var ext_xmin = Number.MAX_VALUE, ext_ymin = Number.MAX_VALUE, ext_xmax = -Number.MAX_VALUE, ext_ymax = -Number.MAX_VALUE;
	var numRecords = graphics.length;
	//var shapeContentBlobObject = new WebKitBlobBuilder();
	//var shxContentBlobObject = new WebKitBlobBuilder();
	var shapeContentBlobObject = new BlobBuilder();
	var shxContentBlobObject = new BlobBuilder();
	
	var byteFileLength = 100; // length of overall file, min of 100 bytes of the header, plus the contents
	var byteShxLength = 100;
	var byteLengthOfRecordHeader = 8; // 2 integers, same for all shape types
	// point shapefile records have a fairly simple structure
	// polylines and polygons have a few more bits but are identical to one another bar some names
	switch (this.shapetype) {
		case "POINT":
			// length of record is fixed at 20 for points, being 1 int and 2 doubles in a point record
			var byteLengthOfRecord = 20;
			var byteLengthOfRecordInclHeader = byteLengthOfRecord+byteLengthOfRecordHeader;
			for (var i = 1; i < numRecords + 1; i++) { // record numbers begin at 1 not 0
				var graphic = graphics[i - 1];
				var x = graphic.geometry["x"];
				var y = graphic.geometry["y"];
				if (x < ext_xmin) 
					ext_xmin = x;
				if (x > ext_xmax) 
					ext_xmax = x;
				if (y < ext_ymin) 
					ext_ymin = y;
				if (y > ext_ymax) 
					ext_ymax = y;
				// we'll write the record header and content into a single arraybuffer
				//var recordBuffer = new ArrayBuffer(byteLengthOfRecordHeader + byteLengthOfRecord);
				var recordBuffer = jDataView_write.createEmptyBuffer(28,true)// length is fixed for points
				var recordDataView = new jDataView_write(recordBuffer,null);
				recordDataView.setInt32(0, i); // big-endian
				recordDataView.setInt32(4, byteLengthOfRecord / 2); // NB divide by 2 as value is in 16 bit words
				//now the record content
				recordDataView.setInt32(8, ShapeTypes[this.shapetype], true); // 1=Point. LITTLE endian! 
				recordDataView.setFloat64(12, x, true); //little-endian
				recordDataView.setFloat64(20, y, true); //little-endian
				shapeContentBlobObject.append(recordDataView.getBuffer());
				// now do the shx record
				var shxBuffer = jDataView_write.createEmptyBuffer(8,true);
				var shxDataView = new jDataView_write(shxBuffer,8,false);
				//shxDataView.setInt32(0, (i - 1) * ((byteLengthOfRecord + byteLengthOfRecordHeader) / 2) + 50);
				shxDataView.setInt32(0, byteFileLength / 2); // shx record gives offset in shapefile of record start
				shxDataView.setInt32(4, (byteLengthOfRecord / 2)); // and the length in shapefile of record
				shxContentBlobObject.append(shxDataView.getBuffer());
				byteFileLength += byteLengthOfRecordInclHeader; // fixed at 28 for points
				
				//console.log ("Writing SHP/SHX record for searchId "+ graphic.attributes['SEARCHID'] 
				//	+ "and type " +graphic.attributes['TYPE']+" to row "+ (i-1).toString());

			}
			break;
		default:
		alert("Unknown shape type specified!");
	}
	// now we can build the rest of the file headers as we know the extent and length
	headerDataView.setFloat64(36,ext_xmin,true); //little endian
	headerDataView.setFloat64(44,ext_ymin,true); //little endian
	headerDataView.setFloat64(52,ext_xmax,true); //little endian
	headerDataView.setFloat64(60,ext_ymax,true); //little endian
	shxHeaderView.setFloat64(36,ext_xmin,true); //little endian
	shxHeaderView.setFloat64(44,ext_ymin,true); //little endian
	shxHeaderView.setFloat64(52,ext_xmax,true); //little endian
	shxHeaderView.setFloat64(60,ext_ymax,true); //little endian
	headerDataView.setInt32(24,byteFileLength/2);
	shxHeaderView.setInt32(24,(50+numRecords*4));
	
	// all done. make the final blob objects
	//var shapeFileBlobObject = new WebKitBlobBuilder();
	var shapeFileBlobObject = new BlobBuilder();
	//var binaryString = headerDataView.getBuffer();
	//var b64string = encodeBase64(binaryString);
	//shapeFileBlobObject.append(b64string);
	shapeFileBlobObject.append(headerDataView.getBuffer());
	shapeFileBlobObject.append(shapeContentBlobObject.getBlob("application/octet-stream"));
	//var shxFileBlobObject = new WebKitBlobBuilder();
	var shxFileBlobObject = new BlobBuilder();
	shxFileBlobObject.append(shxHeaderView.getBuffer());
	shxFileBlobObject.append(shxContentBlobObject.getBlob("application/octet-stream"));
	return {shape: 	shapeFileBlobObject.getBlob("application/octet-stream"),
			shx:	shxFileBlobObject.getBlob("application/octet-stream")};

	
}

Shapefile.prototype.createShapeShxFileWebkit = function(graphics){
	// create 100-byte header for the shp and shx files
	var headerBuf = new ArrayBuffer(100);
	var headerDataView = new DataView(headerBuf);
	var shxHeaderBuf = new ArrayBuffer(100);
	var shxHeaderView = new DataView(shxHeaderBuf);
	headerDataView.setInt32(0, 9994); //big-endian
	shxHeaderView.setInt32(0, 9994); //big-endian
	headerDataView.setInt32(28, 1000, true); //little-endian, why on earth are they mixed?
	shxHeaderView.setInt32(28, 1000, true); //little-endian
	// will need to set file length in 16 bit words at byte 24, big-endian
	// now set shape type
	headerDataView.setInt32(32, ShapeTypes[this.shapetype], true); // little-endian
	shxHeaderView.setInt32(32, ShapeTypes[this.shapetype], true); // little-endian
	// now start work on the file contents
	// will get extent by naive method of increasing or decreasing the min / max for each feature outside those currently set
	var ext_xmin = Number.MAX_VALUE, ext_ymin = Number.MAX_VALUE, ext_xmax = -Number.MAX_VALUE, ext_ymax = -Number.MAX_VALUE;
	var numRecords = graphics.length;
	var shapeContentBlobObject = new WebKitBlobBuilder();
	var shxContentBlobObject = new WebKitBlobBuilder();
	var byteFileLength = 100; // length of overall file, min of 100 bytes of the header, plus the contents
	var byteShxLength = 100;
	var byteLengthOfRecordHeader = 8; // 2 integers, same for all shape types
	// point shapefile records have a fairly simple structure
	// polylines and polygons have a few more bits but are identical to one another bar some names
	switch (this.shapetype) {
		case "POINT":
			// length of record is fixed at 20 for points, being 1 int and 2 doubles in a point record
			var byteLengthOfRecord = 20;
			var byteLengthOfRecordInclHeader = byteLengthOfRecord+byteLengthOfRecordHeader;
			for (var i = 1; i < numRecords + 1; i++) { // record numbers begin at 1 not 0
				var graphic = graphics[i - 1];
				var x = graphic.geometry["x"];
				var y = graphic.geometry["y"];
				if (x < ext_xmin) 
					ext_xmin = x;
				if (x > ext_xmax) 
					ext_xmax = x;
				if (y < ext_ymin) 
					ext_ymin = y;
				if (y > ext_ymax) 
					ext_ymax = y;
				// we'll write the record header and content into a single arraybuffer
				//var recordBuffer = new ArrayBuffer(byteLengthOfRecordHeader + byteLengthOfRecord);
				var recordBuffer = new ArrayBuffer(28); // length is fixed for points
				var recordDataView = new DataView(recordBuffer);
				recordDataView.setInt32(0, i); // big-endian
				recordDataView.setInt32(4, byteLengthOfRecord / 2); // NB divide by 2 as value is in 16 bit words
				//now the record content
				recordDataView.setInt32(8, ShapeTypes[this.shapetype], true); // 1=Point. LITTLE endian! 
				recordDataView.setFloat64(12, x, true); //little-endian
				recordDataView.setFloat64(20, y, true); //little-endian
				shapeContentBlobObject.append(recordBuffer);
				// now do the shx record
				var shxBuffer = new ArrayBuffer(8);
				var shxDataView = new DataView(shxBuffer);
				//shxDataView.setInt32(0, (i - 1) * ((byteLengthOfRecord + byteLengthOfRecordHeader) / 2) + 50);
				shxDataView.setInt32(0, byteFileLength / 2); // shx record gives offset in shapefile of record start
				shxDataView.setInt32(4, (byteLengthOfRecord / 2)); // and the length in shapefile of record
				shxContentBlobObject.append(shxBuffer);
				byteFileLength += byteLengthOfRecordInclHeader; // fixed at 28 for points
				
				//console.log ("Writing SHP/SHX record for searchId "+ graphic.attributes['SEARCHID'] 
				//	+ "and type " +graphic.attributes['TYPE']+" to row "+ (i-1).toString());

			}
			break;
		case "POLYLINE":
		case "POLYGON":
			/*
		 * polyline and polygon code
		 * Working from the ESRI JSAPI representation of a polyline - extend later to translate
		 * from Gmaps, Openlayers etc
		 * Each input graphic polyline object has property "paths" which is an array of paths.
		 * Polygon is exactly the same structure but the ESRI javascript graphic refers to rings not paths
		 * Each path represents one feature part and consists of an array of x,y coord pairs
		 * thus path = [[x1,y1],[x2,y2],[x3,y3]] and paths is an array of these
		 * Shapefile requires:
		 * numparts -> number of paths / rings,
		 * total number of points,
		 * array of indices to start of each part,
		 * array of points (single array for everything)
		 * The overall record length is of course not fixed like with a point, so we have to track it
		 */
			for (var i = 1; i < numRecords + 1; i++) {
				var graphic = graphics[i - 1];
				var feat_xmin = Number.MAX_VALUE, feat_ymin = Number.MAX_VALUE, feat_xmax = -Number.MAX_VALUE, feat_ymax = -Number.MAX_VALUE;
				var numParts;
				if (this.shapetype=="POLYLINE") {
					numParts = graphic.geometry.paths.length;
				}
				else 
					if (this.shapetype=="POLYGON") {
						numParts = graphic.geometry.rings.length;
					}
				var partsIndex = [];
				var pointsArray = [];
				for (var partNum = 0; partNum < numParts; partNum++) {
					var thisPart;
					if (this.shapetype=="POLYLINE") {
						thisPart = graphic.geometry.paths[partNum];
					}
					else 
						if (this.shapetype=="POLYGON") {
							thisPart = graphic.geometry.rings[partNum];
						}
					var numPointsInPart = thisPart.length;
					partsIndex.push(pointsArray.length); // the index of where this part starts in the points array
					for (var pointIdx = 0; pointIdx < numPointsInPart; pointIdx++) {
						pointsArray.push(thisPart[pointIdx]);
					}
				}
				var numPointsOverall = pointsArray.length;
				// now we know all we need in order to create the binary stuff. pointsarray contains the points in JS array
				// format and partsIndex is a JS array of the start indices in pointsarray 
				// NB: each "point" or rather vertex in shapefile is just 2 doubles 
				// (not a full "point" record! not clear in docs!)
				var pointsArrayBuf = new ArrayBuffer(16 * numPointsOverall);
				var pointsArrayView = new DataView(pointsArrayBuf);
				for (var pointIdx = 0; pointIdx < numPointsOverall; pointIdx++) {
					// each item in pointsArray should be an array of two numbers, being x and y coords
					var thisPoint = pointsArray[pointIdx];
					pointsArrayView.setFloat64(pointIdx * 16, thisPoint[0], true); //little-endian
					pointsArrayView.setFloat64(pointIdx * 16 + 8, thisPoint[1], true); //little-endian
					// check and update extent if necessary
					if (thisPoint[0] < ext_xmin) {
						ext_xmin = thisPoint[0];
					}
					else 
						if (thisPoint[0] > ext_xmax) {
							ext_xmax = thisPoint[0];
						}
					if (thisPoint[1] < ext_ymin) {
						ext_ymin = thisPoint[1];
					}
					else {
						if (thisPoint[1] > ext_ymax) 
							ext_ymax = thisPoint[1];
					}
				}
				// 44 +4* numparts is the length of record contents excl the points; 
				// the 8 is the record header which we haven't done separately, hence offsets below are 8 higher than
				// in shapefile spec table 6
				var recordInfoLength = 8 + 44 + 4 * numParts;
				var byteLengthOfRecordInclHeader = recordInfoLength + 16 * numPointsOverall; // each "point" is 16 bytes not 20!
				var byteLengthOfRecordContent = 44 + 4 * numParts + 16 * numPointsOverall; // figure that will be used in the record header in shp and shx
				// NB total length of record = recordInfoLength + length of pointsArrayBuf, or byteLengthOfRecordContent + 8
				var featureRecordInfo = new ArrayBuffer(recordInfoLength); 
	   			// use a single object to build the record header and the first bytes of the content which are effectively header too
	   			var featureRecordInfoView = new DataView(featureRecordInfo);
	   			// two ints in the record header are big-endian
	   			featureRecordInfoView.setInt32(0, i); // big-endian
       			featureRecordInfoView.setInt32(4, (byteLengthOfRecordContent) / 2); // NB divide by 2 as value is in 16 bit words
       			// that's the 8 bytes of record header done, now add the shapetype, box, numparts, and numpoints
	   			// add 8 to all offsets given in shapefile doc to account for header
	   			// all numbers in the record itself are little-endian
	   			featureRecordInfoView.setInt32(8, ShapeTypes[this.shapetype], true);
	   			featureRecordInfoView.setFloat64 (12,ext_xmin, true);
	   			featureRecordInfoView.setFloat64 (20,ext_ymin, true);
	   			featureRecordInfoView.setFloat64 (28,ext_xmax, true);
	   			featureRecordInfoView.setFloat64 (36,ext_ymax, true);
	   			featureRecordInfoView.setInt32(44,numParts, true);
	   			featureRecordInfoView.setInt32(48,numPointsOverall, true);
	   			// now write in the indices of the part starts
				for (var partNum = 0;partNum<partsIndex.length;partNum++){
	   				featureRecordInfoView.setInt32(52+partNum*4, partsIndex[partNum],true);
	   			}
	   			//now featureRecordInfo and pointsArrayBuf together contain the complete feature
	   			shapeContentBlobObject.append(featureRecordInfo);
	   			shapeContentBlobObject.append(pointsArrayBuf);
       			// now do the shx record
       			var shxBuffer = new ArrayBuffer(8);
        		var shxDataView = new DataView(shxBuffer);
        		shxDataView.setInt32(0, byteFileLength / 2);
        		shxDataView.setInt32(4, byteLengthOfRecordContent / 2);
        		shxContentBlobObject.append(shxBuffer);
				// finally augment the overall file length tracker
				byteFileLength += byteLengthOfRecordInclHeader;
		
			}
			break;
		default:
		alert("Unknown shape type specified!");
	}
	// now we can build the rest of the file headers as we know the extent and length
	headerDataView.setFloat64(36,ext_xmin,true); //little endian
	headerDataView.setFloat64(44,ext_ymin,true); //little endian
	headerDataView.setFloat64(52,ext_xmax,true); //little endian
	headerDataView.setFloat64(60,ext_ymax,true); //little endian
	shxHeaderView.setFloat64(36,ext_xmin,true); //little endian
	shxHeaderView.setFloat64(44,ext_ymin,true); //little endian
	shxHeaderView.setFloat64(52,ext_xmax,true); //little endian
	shxHeaderView.setFloat64(60,ext_ymax,true); //little endian
	headerDataView.setInt32(24,byteFileLength/2);
	shxHeaderView.setInt32(24,(50+numRecords*4));
	
	// all done. make the final blob objects
	var shapeFileBlobObject = new WebKitBlobBuilder();
	shapeFileBlobObject.append(headerBuf);
	//shapeFileBlobObject.append(shapeContentBlobObject.getBlob());
	var shxFileBlobObject = new WebKitBlobBuilder();
	shxFileBlobObject.append(shxHeaderBuf);
	//shxFileBlobObject.append(shxContentBlobObject.getBlob());
	return {shape: 	shapeFileBlobObject.getBlob(),
			shx:	shxFileBlobObject.getBlob()};
}

Shapefile.prototype.createDbfWebkit = function(attributeMap,graphics){
	if (attributeMap.length == 0){
		attributeMap.push({
			name: "ID_AUTO",
			type: "N",
			length: "8"
		});
	}
	var dbfInfo = this._createDbfHeaderWebkit(attributeMap,graphics.length);
	var dbfRecordLength = dbfInfo["recordLength"];
	var dbfHeaderBlob = dbfInfo["dbfHeader"];
	var dbfData = this._createDbfRecordsWebkit(attributeMap,graphics,dbfRecordLength);
	//var dbfBlob = new WebKitBlobBuilder();
	var dbfBlob = new BlobBuilder();
	dbfBlob.append(dbfHeaderBlob.getBlob());
	dbfBlob.append(dbfData.getBlob());
	return dbfBlob.getBlob();
}

Shapefile.prototype._createDbfHeaderWebkit = function(attributeMap,numRecords){
	// DBF File format references: see
	// (XBase) http://www.clicketyclick.dk/databases/xbase/format/dbf.html#DBF_STRUCT
	// http://www.quantdec.com/SYSEN597/GTKAV/section4/chapter_15a.htm
	// http://ulisse.elettra.trieste.it/services/doc/dbase/DBFstruct.htm
	/* attributes parameter will be in the format 
		[ 
			{ 
				name: 	string,
				type: 	string, // (1 character),
				length: number, // only req if type is C or N, will be used if less than datatype maximum
				value: 	string,  
				scale:  number  // only req if type is N, will be used for "decimal count" property
			}
		]
	*/
	var numFields = attributeMap.length; // GET NUMBER OF FIELDS FROM PARAMETER
	var fieldDescLength = 32 * numFields + 1;
	var dbfFieldDescBuf = new ArrayBuffer(fieldDescLength);
	var dbfFieldDescView = new DataView(dbfFieldDescBuf);
	var namesUsed = [];
	var numBytesPerRecord = 1; // total is the length of all fields plus 1 for deletion flag
	for (var i=0; i<numFields; i++){
		// each field has 32 bytes in the header. These describe name, type, and length of the attribute  
		var name = attributeMap[i].name.slice(0,10);
		// need to check if the name has already been used and generate a altered one
		// if so. not doing the check yet, better make sure we don't try duplicate names!
		// NB older browsers don't have indexOf but given the other stuff we're doing with binary 
		// i think that's the least of their worries
		if (namesUsed.indexOf(name) == -1) {
			namesUsed.push(name);
		}
		// write the name into bytes 0-9 of the field description
		for (var x = 0; x < name.length; x++) {
			dbfFieldDescView.setInt8(i*32+x, name.charCodeAt(x));
		}
		// nb byte 10 is left at zero
		/* Now data type. Data types are 
			C = Character. Max 254 characters.
			N = Number, but stored as ascii text. Max 18 characters.
			L = Logical, boolean. 1 byte, ascii. Values "Y", "N", "T", "F" or "?" are valid
			D = Date, format YYYYMMDD, numbers
		*/
		var datatype = attributeMap[i].type || "C"
		var fieldLength;
		if (datatype == "L"){
			fieldLength = 1;
		}
		else if (datatype == "D") {
			fieldLength = 8;
		}
		else if (datatype == "N"){
			// maximum length is 18
			fieldLength = attributeMap[i].length && attributeMap[i].length<19 ? attributeMap[i].length : 18;
		}
		else if (datatype == "C"){
			fieldLength = attributeMap[i].length && attributeMap[i].length<254 ? attributeMap[i].length : 254;
		}
		//else {
		//	datatype == "C";
		//	fieldLength = 254;
		//}
		// write the type into byte 11
		dbfFieldDescView.setInt8(i*32+11,datatype.charCodeAt(0)); // FIELD TYPE
		// write the length into byte 16
		dbfFieldDescView.setInt8(i*32+16,fieldLength); //FIELD LENGTH
		if (datatype = "N") {
			var fieldDecCount = attributeMap[i].scale || 0;
			// write the decimal count into byte 17
			dbfFieldDescView.setInt8(i * 32 + 17, fieldDecCount); // FIELD DECIMAL COUNT
		}
		numBytesPerRecord += parseInt(fieldLength);
	}
	// last byte of the array is set to 0Dh (13, newline character) to mark end of overall header
	dbfFieldDescView.setInt8(fieldDescLength - 1, 13)
	// field map section is complete, now do the main header
	var dbfHeaderBuf = new ArrayBuffer(32);
	var dbfHeaderView = new DataView(dbfHeaderBuf);
	dbfHeaderView.setUint8(0,3) // File Signature: DBF - UNSIGNED
	var rightnow = new Date();
	dbfHeaderView.setUint8(1,rightnow.getFullYear() - 1900); // UNSIGNED
	dbfHeaderView.setUint8(2,rightnow.getMonth());  // UNSIGNED
	dbfHeaderView.setUint8(3,rightnow.getDate());  // UNSIGNED
	dbfHeaderView.setUint32(4,numRecords, true); // LITTLE ENDIAN, UNSIGNED
	var totalHeaderLength = fieldDescLength + 31 + 1;
	// the 31 bytes of this section, plus the length of the fields description, plus 1 at the end 
	dbfHeaderView.setUint16(8,totalHeaderLength, true); // LITTLE ENDIAN , UNSIGNED
	// the byte length of each record, which includes 1 initial byte as a deletion flag
	dbfHeaderView.setUint16(10,numBytesPerRecord, true); // LITTLE ENDIAN, UNSIGNED
	//dbfHeaderView.setUint8(29,03) // language driver, 03 = windows ansi
	// except for 29, bytes 12 - 31 are reserved or for things we don't need
	// header section is complete, now build the overall header as a blob
	//var dbfHeaderBlob = new WebKitBlobBuilder();
	var dbfHeaderBlob = new BlobBuilder();
	dbfHeaderBlob.append(dbfHeaderBuf);
	dbfHeaderBlob.append(dbfFieldDescBuf);
	return {
		recordLength: 	numBytesPerRecord,
		dbfHeader:	 	dbfHeaderBlob
	}
}

Shapefile.prototype._createDbfRecordsWebkit = function(attributeMap,attributeData,recordLength){
	/* PARAMETERS:
	 * attributeData is an array of objects of structure
	 * [{
	 * 	something: xxx,
	 *  somethingelse: xyz,
	 *  attributes: {
	 * 		attribname: value,
	 * 		anotherattribname: value
	 * 	}
	 * }]
	 * i.e. each object in the array must have an property called "attributes" which in turn contains 
	 * the attributes of that object, and these must match those in the attributeMap 
	 * other properties of the object are ignored. 
	 * In other words attributeData is an array of esri.graphics, or something that looks like one! 
	 * Each object is one record so the array must be in the same order as the array used to build the shapefile
	 *   
	 * attributeMap is the same object that was passed to the header-building function
	 * this is used to confirm that they are the same, to get the order they appear in within a record, 
	 * and to be able to ignore any attributes that we don't want to carry forward into the DBF.
	 * 
	 * Recordlength gives the byte length of a record as defined in the header
	 * 
	 * All record data is stored as ASCII, i.e. numbers as their ASCII representation rather than binary int etc
	 * It appears that number fields are left padded with spaces to their defined length (data on right), 
	 * and string fields are right padded.
	 * 
	 * There are almost certainly more ways to break this than there are ways to make it work! 
	 */
	// overall datalength is number of records * (length of record including 1 for deletion flag) +1 for EOF
	var dataLength = (recordLength)*attributeData.length + 1;
	var dbfDataBuf = new ArrayBuffer(dataLength);
	var dbfDataView = new DataView(dbfDataBuf);
	var currentOffset=0;
	for (var rownum=0;rownum<attributeData.length;rownum++){
		var rowData = attributeData[rownum].attributes || {};
		//console.log ("Writing DBF record for searchId "+rowData['SEARCHID'] + 
		//	" and type " + rowData['TYPE'] + "to row "+rownum);
		var recordStartOffset = rownum*(recordLength); // recordLength includes the byte for deletion flag
		//var currentOffset = rownum*(recordLength);
		dbfDataView.setUint8(currentOffset,32); // Deletion flag: not deleted. 20h = 32, space
		currentOffset+=1;
		for (var attribNum = 0; attribNum < attributeMap.length; attribNum++)
		{
			// loop once for each attribute
			var attribInfo = attributeMap[attribNum];
			var attName = attribInfo["name"];
			var dataType = attribInfo["type"] || "C";
			var fieldLength = parseInt(attribInfo["length"]) || 0; // it isn't alterable for L or D type fields
			var attValue =  rowData[attName] || rownum.toString(); // use incrementing number if attribute is missing,
			// this will come into play if there were no attributes in the original graphics, hence the attributeMap contains "ID_AUTO"
			//var fieldLength;
			if (dataType == "L"){
				fieldLength = 1;
				if (attValue){
					dbfDataView.setUint8(currentOffset,84); // 84 is ASCII for T
				}
				else {
					dbfDataView.setUint8(currentOffset,70); // 70 is ASCII for F
				}
				currentOffset += 1;
			}
			else if (dataType == "D") {
				fieldLength = 8;
				var numAsString = attValue.toString();
				if (numAsString.length != fieldLength) {
					// if the length isn't what it should be then ignore and write a blank string
					numAsString = "".lpad(" ", 8);
				}
				for (var writeByte=0;writeByte < fieldLength;writeByte++){
					dbfDataView.setUint8(currentOffset,numAsString.charCodeAt(writeByte));
					currentOffset += 1;
					//writeByte += 1;
				}
			}	
			else if (dataType == "N"){
				// maximum length is 18. Numbers are stored as ascii text so convert to a string.
				// fieldLength = attribinfo.length && attribinfo.length<19 ? attribinfo.length : 18;
				var numAsString = attValue.toString();
				if (fieldLength == 0){
					continue;
				}
				if (numAsString.length != fieldLength) {
					// if the length isn't what it should be then pad to the left
					numAsString = numAsString.lpad(" ", fieldLength);
				}
				for (var writeByte=0;writeByte < fieldLength;writeByte++){
					dbfDataView.setUint8(currentOffset,numAsString.charCodeAt(writeByte));
					currentOffset += 1;
					//writeByte += 1;
				}
			}
			else if (dataType == "C" || dataType == ""){
				if (fieldLength == 0) { continue; }
				if (typeof(attValue) !== "string"){
					// just in case a rogue number has got in...
					attValue = attValue.toString();
				}
				if (attValue.length < fieldLength) {
					attValue = attValue.rpad(" ", fieldLength);
				}
				// doesn't matter if it's too long as we will only write fieldLength bytes
				for (var writeByte=0;writeByte < fieldLength;writeByte++){
					dbfDataView.setUint8(currentOffset,attValue.charCodeAt(writeByte));
					currentOffset += 1;
					//writeByte += 1;
				}
			}
		}
		// row done, rinse and repeat
	}
	// all rows written, write EOF
	dbfDataView.setUint8(dataLength-1,26);
	//var dbfDataBlobObject = new WebKitBlobBuilder();
	var dbfDataBlobObject = new BlobBuilder();
	dbfDataBlobObject.append(dbfDataBuf);
	
	return dbfDataBlobObject;
}

Shapefile.prototype.createDbf = function(attributeMap,graphics){
	if (attributeMap.length == 0){
		attributeMap.push({
			name: "ID_AUTO",
			type: "N",
			length: "8"
		});
	}
	var dbfInfo = this._createDbfHeader(attributeMap,graphics.length);
	var dbfRecordLength = dbfInfo["recordLength"];
	var dbfHeaderBlob = dbfInfo["dbfHeader"];
	var dbfData = this._createDbfRecords(attributeMap,graphics,dbfRecordLength);
	//var dbfBlob = new WebKitBlobBuilder();
	var dbfBlob = new BlobBuilder();
	dbfBlob.append(dbfHeaderBlob.getBlob("application/octet-stream"));
	dbfBlob.append(dbfData.getBlob("application/octet-stream"));
	return dbfBlob.getBlob("application/octet-stream");
}

Shapefile.prototype._createDbfHeader = function(attributeMap,numRecords){
	// DBF File format references: see
	// (XBase) http://www.clicketyclick.dk/databases/xbase/format/dbf.html#DBF_STRUCT
	// http://www.quantdec.com/SYSEN597/GTKAV/section4/chapter_15a.htm
	// http://ulisse.elettra.trieste.it/services/doc/dbase/DBFstruct.htm
	/* attributes parameter will be in the format 
		[ 
			{ 
				name: 	string,
				type: 	string, // (1 character),
				length: number, // only req if type is C or N, will be used if less than datatype maximum
				value: 	string,  
				scale:  number  // only req if type is N, will be used for "decimal count" property
			}
		]
	*/
	var numFields = attributeMap.length; // GET NUMBER OF FIELDS FROM PARAMETER
	var fieldDescLength = 32 * numFields + 1;
	//var dbfFieldDescBuf = new ArrayBuffer(fieldDescLength);
	var dbfFieldDescBuf = jDataView_write.createEmptyBuffer(fieldDescLength,true);
	var dbfFieldDescView = new jDataView_write(dbfFieldDescBuf,fieldDescLength,true);
	var namesUsed = [];
	var numBytesPerRecord = 1; // total is the length of all fields plus 1 for deletion flag
	for (var i=0; i<numFields; i++){
		// each field has 32 bytes in the header. These describe name, type, and length of the attribute  
		var name = attributeMap[i].name.slice(0,10);
		// need to check if the name has already been used and generate a altered one
		// if so. not doing the check yet, better make sure we don't try duplicate names!
		// NB older browsers don't have indexOf but given the other stuff we're doing with binary 
		// i think that's the least of their worries
		if (namesUsed.indexOf(name) == -1) {
			namesUsed.push(name);
		}
		// write the name into bytes 0-9 of the field description
		for (var x = 0; x < name.length; x++) {
			dbfFieldDescView.setInt8(i*32+x, name.charCodeAt(x));
		}
		// nb byte 10 is left at zero
		/* Now data type. Data types are 
			C = Character. Max 254 characters.
			N = Number, but stored as ascii text. Max 18 characters.
			L = Logical, boolean. 1 byte, ascii. Values "Y", "N", "T", "F" or "?" are valid
			D = Date, format YYYYMMDD, numbers
		*/
		var datatype = attributeMap[i].type || "C"
		var fieldLength;
		if (datatype == "L"){
			fieldLength = 1;
		}
		else if (datatype == "D") {
			fieldLength = 8;
		}
		else if (datatype == "N"){
			// maximum length is 18
			fieldLength = attributeMap[i].length && attributeMap[i].length<19 ? attributeMap[i].length : 18;
		}
		else if (datatype == "C"){
			fieldLength = attributeMap[i].length && attributeMap[i].length<254 ? attributeMap[i].length : 254;
		}
		//else {
		//	datatype == "C";
		//	fieldLength = 254;
		//}
		// write the type into byte 11
		dbfFieldDescView.setInt8(i*32+11,datatype.charCodeAt(0)); // FIELD TYPE
		// write the length into byte 16
		dbfFieldDescView.setInt8(i*32+16,fieldLength); //FIELD LENGTH
		if (datatype = "N") {
			var fieldDecCount = attributeMap[i].scale || 0;
			// write the decimal count into byte 17
			dbfFieldDescView.setInt8(i * 32 + 17, fieldDecCount); // FIELD DECIMAL COUNT
		}
		numBytesPerRecord += parseInt(fieldLength);
	}
	// last byte of the array is set to 0Dh (13, newline character) to mark end of overall header
	dbfFieldDescView.setInt8(fieldDescLength - 1, 13)
	// field map section is complete, now do the main header
	//var dbfHeaderBuf = new ArrayBuffer(32);
	var dbfHeaderBuf = jDataView_write.createEmptyBuffer(32,true);
	var dbfHeaderView = new jDataView_write(dbfHeaderBuf,32,true);
	dbfHeaderView.setUint8(0,3) // File Signature: DBF - UNSIGNED
	var rightnow = new Date();
	dbfHeaderView.setUint8(1,rightnow.getFullYear() - 1900); // UNSIGNED
	dbfHeaderView.setUint8(2,rightnow.getMonth());  // UNSIGNED
	dbfHeaderView.setUint8(3,rightnow.getDate());  // UNSIGNED
	dbfHeaderView.setUint32(4,numRecords, true); // LITTLE ENDIAN, UNSIGNED
	var totalHeaderLength = fieldDescLength + 31 + 1;
	// the 31 bytes of this section, plus the length of the fields description, plus 1 at the end 
	dbfHeaderView.setUint16(8,totalHeaderLength, true); // LITTLE ENDIAN , UNSIGNED
	// the byte length of each record, which includes 1 initial byte as a deletion flag
	dbfHeaderView.setUint16(10,numBytesPerRecord, true); // LITTLE ENDIAN, UNSIGNED
	//dbfHeaderView.setUint8(29,03) // language driver, 03 = windows ansi
	// except for 29, bytes 12 - 31 are reserved or for things we don't need
	// header section is complete, now build the overall header as a blob
	//var dbfHeaderBlob = new WebKitBlobBuilder();
	var dbfHeaderBlob = new BlobBuilder();
	dbfHeaderBlob.append(dbfHeaderView.getBuffer());
	dbfHeaderBlob.append(dbfFieldDescView.getBuffer());
	return {
		recordLength: 	numBytesPerRecord,
		dbfHeader:	 	dbfHeaderBlob
	}
}

Shapefile.prototype._createDbfRecords = function(attributeMap,attributeData,recordLength){
	/* PARAMETERS:
	 * attributeData is an array of objects of structure
	 * [{
	 * 	something: xxx,
	 *  somethingelse: xyz,
	 *  attributes: {
	 * 		attribname: value,
	 * 		anotherattribname: value
	 * 	}
	 * }]
	 * i.e. each object in the array must have an property called "attributes" which in turn contains 
	 * the attributes of that object, and these must match those in the attributeMap 
	 * other properties of the object are ignored. 
	 * In other words attributeData is an array of esri.graphics, or something that looks like one! 
	 * Each object is one record so the array must be in the same order as the array used to build the shapefile
	 *   
	 * attributeMap is the same object that was passed to the header-building function
	 * this is used to confirm that they are the same, to get the order they appear in within a record, 
	 * and to be able to ignore any attributes that we don't want to carry forward into the DBF.
	 * 
	 * Recordlength gives the byte length of a record as defined in the header
	 * 
	 * All record data is stored as ASCII, i.e. numbers as their ASCII representation rather than binary int etc
	 * It appears that number fields are left padded with spaces to their defined length (data on right), 
	 * and string fields are right padded.
	 * 
	 * There are almost certainly more ways to break this than there are ways to make it work! 
	 */
	// overall datalength is number of records * (length of record including 1 for deletion flag) +1 for EOF
	var dataLength = (recordLength)*attributeData.length + 1;
	//var dbfDataBuf = new ArrayBuffer(dataLength);
	var dbfDataBuf = jDataView_write.createEmptyBuffer(dataLength,true);
	var dbfDataView = new jDataView_write(dbfDataBuf,dataLength,true);
	var currentOffset=0;
	for (var rownum=0;rownum<attributeData.length;rownum++){
		var rowData = attributeData[rownum].attributes || {};
		//console.log ("Writing DBF record for searchId "+rowData['SEARCHID'] + 
		//	" and type " + rowData['TYPE'] + "to row "+rownum);
		var recordStartOffset = rownum*(recordLength); // recordLength includes the byte for deletion flag
		//var currentOffset = rownum*(recordLength);
		dbfDataView.setUint8(currentOffset,32); // Deletion flag: not deleted. 20h = 32, space
		currentOffset+=1;
		for (var attribNum = 0; attribNum < attributeMap.length; attribNum++)
		{
			// loop once for each attribute
			var attribInfo = attributeMap[attribNum];
			var attName = attribInfo["name"];
			var dataType = attribInfo["type"] || "C";
			var fieldLength = parseInt(attribInfo["length"]) || 0; // it isn't alterable for L or D type fields
			var attValue =  rowData[attName] || rownum.toString(); // use incrementing number if attribute is missing,
			// this will come into play if there were no attributes in the original graphics, hence the attributeMap contains "ID_AUTO"
			//var fieldLength;
			if (dataType == "L"){
				fieldLength = 1;
				if (attValue){
					dbfDataView.setUint8(currentOffset,84); // 84 is ASCII for T
				}
				else {
					dbfDataView.setUint8(currentOffset,70); // 70 is ASCII for F
				}
				currentOffset += 1;
			}
			else if (dataType == "D") {
				fieldLength = 8;
				var numAsString = attValue.toString();
				if (numAsString.length != fieldLength) {
					// if the length isn't what it should be then ignore and write a blank string
					numAsString = "".lpad(" ", 8);
				}
				for (var writeByte=0;writeByte < fieldLength;writeByte++){
					dbfDataView.setUint8(currentOffset,numAsString.charCodeAt(writeByte));
					currentOffset += 1;
					//writeByte += 1;
				}
			}	
			else if (dataType == "N"){
				// maximum length is 18. Numbers are stored as ascii text so convert to a string.
				// fieldLength = attribinfo.length && attribinfo.length<19 ? attribinfo.length : 18;
				var numAsString = attValue.toString();
				if (fieldLength == 0){
					continue;
				}
				if (numAsString.length != fieldLength) {
					// if the length isn't what it should be then pad to the left
					numAsString = numAsString.lpad(" ", fieldLength);
				}
				for (var writeByte=0;writeByte < fieldLength;writeByte++){
					dbfDataView.setUint8(currentOffset,numAsString.charCodeAt(writeByte));
					currentOffset += 1;
					//writeByte += 1;
				}
			}
			else if (dataType == "C" || dataType == ""){
				if (fieldLength == 0) { continue; }
				if (typeof(attValue) !== "string"){
					// just in case a rogue number has got in...
					attValue = attValue.toString();
				}
				if (attValue.length < fieldLength) {
					attValue = attValue.rpad(" ", fieldLength);
				}
				// doesn't matter if it's too long as we will only write fieldLength bytes
				for (var writeByte=0;writeByte < fieldLength;writeByte++){
					dbfDataView.setUint8(currentOffset,attValue.charCodeAt(writeByte));
					currentOffset += 1;
					//writeByte += 1;
				}
			}
		}
		// row done, rinse and repeat
	}
	// all rows written, write EOF
	dbfDataView.setUint8(dataLength-1,26);
	//var dbfDataBlobObject = new WebKitBlobBuilder();
	var dbfDataBlobObject = new BlobBuilder();
	//dbfDataBlobObject.append(dbfDataBuf);
	dbfDataBlobObject.append(dbfDataView.getBuffer());
	return dbfDataBlobObject;
}

Shapefile.prototype.createAttributeMap = function(graphicsArray){
	var allAttributes = {};
	for (var i=0;i<graphicsArray.length;i++){
		var graphic = graphicsArray[i];
		if (graphic.attributes){
			for (attribute in graphic.attributes){
				if (graphic.attributes.hasOwnProperty(attribute)){
					var attvalue = graphic.attributes[attribute];
					if (allAttributes.hasOwnProperty(attribute)){
						// CHECK TYPE
						if (allAttributes[attribute].length < attvalue.length){
							allAttributes[attribute].length = attvalue.length;
						}
					}
					else {
						switch (typeof(attvalue)){
							case "number":
								if (parseInt(attvalue)===attvalue){
									// it's an int
									allAttributes[attribute] = {
										type: 'N',
										length: attvalue.toString().length
									}
								}
								else if (parseFloat(attvalue)===attvalue){
									// it's a float
									var scale = attvalue.toString().length - 
										(attvalue.toString().split('.')[0].length + 1);
									allAttributes[attribute] = {
										type: 'N',
										length: attvalue.toString().length,
										scale: scale
									}
								}
							break;
							case "boolean":
								allAttributes[attribute] = {
									type: 'L'
								}
							break;
							case "string":
								allAttributes[attribute] = {
									type: "C",
									length: attvalue.length
								}	
							break;
						}
					}
				}
			}
		}
	}
	var attributeMap = [];
	for (attributeName in allAttributes){
		if(allAttributes.hasOwnProperty(attributeName)){
			var thisAttribute = {
				name: attributeName,
				type: allAttributes[attributeName]["type"],
				length: allAttributes[attributeName]["length"]
			};
			if (allAttributes[attributeName].hasOwnProperty("length")){
				thisAttribute["length"] = allAttributes[attributeName]["length"];
			}
			if (allAttributes[attributeName].hasOwnProperty("scale")){
				thisAttribute["scale"] = allAttributes[attributeName]["scale"];
			}
			attributeMap.push(thisAttribute);
		}
	}
	return attributeMap;
}
