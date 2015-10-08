## JS2Shapefile ##

JS2Shapefile is a Javascript class to create ESRI shapefiles directly in the browser. It also includes a couple of helper classes for creating and saving the binary data in browsers where that isn't fully supported (anything other than Chrome).

It was written by Harry Gibson while at [CEH Wallingford](http://www.ceh.ac.uk) ~~(now at [HR Wallingford](http://www.hrwallingford.com))~~ (now at [Oxford University](http://seeg.zoo.ox.ac.uk/)).

## Why might you want to do this? ##
JS2Shapefile is designed for use with several web mapping APIs - I wrote it for use with the ESRI Javascript API but it also more-or-less works with Google Maps and will shortly (I hope) work with Openlayers too.

As well as obtaining and displaying map data as pre-rendered images from the server, these APIs also display spatial data that is rendered directly in the map on the client side. Data displayed in this way may come from a server too, or may be created by the user in the web page.

I wanted to be able to get these data back out of the web map interface and into a format that I could use elsewhere. I thought that doing it this way seemed a bit neater than writing something running on the server side to accept the graphics data back from the client, create the binary shapefiles, and ping them back again. And it certainly sounded more fun.

Creating binary data in the browser seemed a bit of a dark art. However it seems that with the newest HTML specifications, this is something that is now possible. This seemed like a handy exercise for teaching myself a bit about Javascript outside of the comfort zone of Dojo or another framework.

So here we are - JS2Shapefile. You can use this as the building block for exporting ArcGIS server features to shapefiles entirely on the client side (no geoprocessing service needed). Or for making a basic shapefile digitiser on top of Google Maps.

## The Shapefile format ##
The format of the ESRI Shapefile is well documented, even if it is a bit arcane, and it's widely used still, so that's the export format I chose.

A single shapefile consists of a minimum of three files: xyz.shp (containing the geometry), xyz.shx (containing an index to the geometry file) and xyz.dbf (containing the feature attributes). Ideally it will also contain projection information in xyz.prj, and perhaps some other files too, but those aren't implemented here.

The format of the SHP and SHX files is well documented in an ESRI white paper. The shapefile attributes are stored in a DBF file, the specification for which was harder to come by. The version I've worked out here seems to work, but it hasn't been very thoroughly tested yet! The attributes / fields in the DBF are created by looking through the attributes property of the input graphics, if present.

## Usage ##
Please see the test HTML files for examples of how to use. Generally you include JS2Shapefile along with FileSaveTools in your page, create a shapefile object, add graphics to it, get the shapefile from it, and pass the three files in the result to the file save helper (or do whatever else you'd like with them).

You can try the test pages (they are fairly rough and ready) here:

["Hello world" type test that makes a point shapefile containing random points](http://wlwater.ceh.ac.uk/js2shapefile/tests/TestJS2Shapefile.html)

[Modification of an ESRI Javascript draw toolbar sample, to let you draw graphics and then export them to shapefiles](http://wlwater.ceh.ac.uk/js2shapefile/tests/Test_EsriDrawToShapefile.html)

[Modification of a demo draw-on-google-maps page I found, to export the drawn features to shapefiles](http://wlwater.ceh.ac.uk/js2shapefile/tests/Gmaps_Demo_JS2Shapefile.html)

## Approach and limitations ##
There are probably more limitations than capabilities with this! But, it works for my purposes...
### Binary data creation ###
The HTML5 specs introduce the ability to work with binary data in Javascript.
Binary data can be created using the ArrayBuffer TypedArray object.
See http://www.khronos.org/registry/typedarray/specs/latest/ - this is currently implemented in browsers including Chrome and Firefox.

However writing bytes into these objects requires a separate interface. Chrome and Firefox both have support for the Typed Array View types - section 7 in the link above. But, they will be very awkward to use with the mixed data in the shapefile specification, and moreover they don't seem to offer any support for choosing the endian-ness of the data they write. Since the shapefile contains both big and little-endian data, this doesn't work.

The alternative is the DataView view type. This is more geared towards use with heterogeneous data types and can write either big or little endian data. So that's what I've used. The big problem is that DataView is only implemented in the Chrome browser. There are at least two implementations of DataView for other browsers but these are read-only and one relies on the ArrayBuffer so still won't work in IE. So starting from the jsDataView project (https://github.com/gmarty/jsDataView) I've created jDataView\_write which implements the writing part of the DataView spec using ArrayBuffers or standard arrays. JS2Shapefile uses these instead of the native DataView.

### Binary data saving ###
The HTML5 Filesystem API gives browsers the ability to write files. Additionally the BlobBuilder API gives the ability to build the file data (from TypedArrays or other objects). Where it is implemented, currently only in Chrome, this combination of BlobBuilders and the FileSystem API gives a fully native way of writing out the files programatically. Firefox has BlobBuilders but cannot save the files, or at least not with a useful name. IE doesn't have either.

Therefore I've used a couple of other libraries to handle saving the binary data to disk. In Chrome, we can save natively but I have used the [FileSaver](http://purl.eligrey.com/github/FileSaver.js/) library to handle it to save reading up on how to do it!

In other browsers we need to use a different method - I've used the [Downloadify](https://github.com/dcneiner/Downloadify) library which uses a small Flash file. A bit of a hack when the whole aim of this project is to create shapefiles in Javascript.

As Downloadify needs to get at the input data in a string format, and as IE doesn't have Blobs, I've used the [BlobBuilder](http://purl.eligrey.com/github/BlobBuilder.js) library to provide "fake" blobs and to ensure that whatever Blob is provided will be compatible with the saving method in use (native blobs for Chrome, fake blobs with access to their raw data for other browsers).

[JSZip](http://jszip.stuartk.co.uk) is used to convert the multiple files of a shapefile into a single zipped file for more convenient input to Downloadify.

All of these are wrapped up by a BinaryHelper class so the code that uses JS2Shapefile can simply use a BinaryHelper to handle saving the files. This involves the client creating a div first, which will be populated with the save control. This is because Downloadify can only be triggered by an actual user input (click), not programatically, due to limitations in Flash. Only in Chrome could we save the data natively.

In summary: in Chrome we can create the data and save it to file entirely natively. On other browsers we need various levels of help. JS2Shapefile has been written to use these intermediate helper parts but if the client is guaranteed to be Chrome or something else implementing DataView, BlobBuilder, and Filesystem APIs, all that could be removed.

### Shapefile creation ###
  * No support for projection / coordinate system yet. The shapefile coordinates will be exactly the same as they were in the input data. No PRJ file is created. This would be pretty easy to add but require a big database of all the WKT projection strings to be loaded.
  * Only point, polyline, polygon shape types are supported
  * I haven't thoroughly tested the attribute creation and it is fairly naive
  * I have only really tested at all with ESRI Javascript API graphics and haven't really looked into the intricacies of features on Google Maps.