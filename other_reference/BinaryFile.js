// Experimental proof of concept script for ESRI shapefile generation in javascript
// Binary file manipulation and creation via HTML5 blob and typedarray objects
// (other potential approaches are available)
// Harry Gibson December 2011

var getShapefileBlob = function(graphics){
	// Create the header, total 100 bytes, table 1 in shapefile spec. Have to do integer then double sequences
	// separately as can't make different TypedArrays on the same ArrayBuffer object
	var headerIntSection = new ArrayBuffer(36);
	var int32Array = new Int32Array(headerIntSection);
	var headerFloatSection = new ArrayBuffer(64);
	var float64Array = new Float64Array(headerFloatSection);
	// now use these two arrays to set byte values in the header
	// the set method offset refers to the numbering of its datatype i.e. a 100 byte blob
	// has 25 int values and the numbering used by int32Array is 1-25
	// so to match the overall shapefile specs where bytes are listed we divide the offset by 4 or 8
	var intByteLength = 4;
	var floatByteLength = 8;
	
	//byte 0 = shapefile identifier of 9994
	int32Array.set([9994], 0);
	//bytes 4 - 20 are unused. May need to set to zero explicitly?
	//byte 24 = file length in 16 bit words, ie length in bytes / 2 
	//int32Array.set([xxx],24/intByteLength); come back and set file length here
	//byte 28 = version of 1000
	int32Array.set([1000], 28 / intByteLength);
	
	// use shape type of point for testing
	int32Array.set([1], 32 / intByteLength);
	
	// some test bounds 
	var xmin = 300000.0;
	var ymin = 300000.0;
	var xmax = 350000.0;
	var ymax = 350000.0;
	// bytes 36,44,52,60 are the xmin, ymin, xmax, ymax coordinates
	// but as it's a standalone float array, start from 0
	float64Array.set([xmin], 0 / floatByteLength);
	float64Array.set([ymin], 8 / floatByteLength);
	float64Array.set([xmax], 16 / floatByteLength);
	float64Array.set([ymax], 24 / floatByteLength);
	// bytes 68, 76 are zmin and zmax, not required for our 1D point test or probably ever for converting
	// esri js graphics
	// bytes 84, 92 are mmin and mmax, also not required
	
	var contentBlobObject = new MozBlobBuilder();
	var contentByteLength = 100;
	// build the records. One per feature (graphic). Use random points within the bounds for now
	var numRecords = 10;
	for (var i = 1; i < numRecords + 1; i++) {
		// do the record first so we can get its length, (ok we know it for a point, but not for others)
		// generate some random coordinates within the bounds
		var x = Math.random() * 50000 + xmin;
		var y = Math.random() * 50000 + ymin;
		// point record consists of a shape type identifier, int, and two doubles for x and y
		// otherwise need to work out the length
		var recordContentBuffer = new ArrayBuffer(16)// a point is two floats
		var recordContentFloatWriter = new Float64Array(recordContentBuffer);
		recordContentFloatWriter.set([x], 0);
		recordContentFloatWriter.set([y], 1);
		// I'm doing the shape type from the record content at the end of the header rather than the start of the
		// content to save faff with different types in content. hence 12 not 8
		var recordHeaderBuffer = new ArrayBuffer(12);
		var int32RecHeadArray = new Int32Array(recordHeaderBuffer);
		// byte 0 of a record header is record number, beginning at 1
		int32RecHeadArray.set([i], 0);
		// byte 4 of record header is content length of the following record contents section, in 16 bit words
		var lgth = (recordContentFloatWriter.byteLength + 12) / 2
		int32RecHeadArray.set([lgth], 4 / intByteLength);
		int32RecHeadArray.set([1], 8 / intByteLength);
		contentBlobObject.append(recordHeaderBuffer);
		contentBlobObject.append(recordContentBuffer);
		contentByteLength += recordHeaderBuffer.byteLength;
		contentByteLength += recordContentBuffer.byteLength;
	}
	
	int32Array.set([contentByteLength], 24 / intByteLength);
	var blobObject = new MozBlobBuilder();
	blobObject.append(headerIntSection);
	blobObject.append(headerFloatSection);
	blobObject.append(contentBlobObject.getBlob());
	var f = blobObject.getBlob();
	//location.href = "data:application/octet-stream,"+f;
	//saveAs(f, "test.shp");
	return f;
}