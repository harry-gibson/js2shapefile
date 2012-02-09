// Compatibility notes:
// Chrome: We can use Dataview, ArrayBuffer and Blobs (as WebKitBlobBuilder). We can save the blobs as-is.
// 			This class isn't really needed as data can be saved programatically there with no user interaction
// 			required. Only a saveAs helper library is used to wrap this up. 
//			Require: saveAs
// Firefox: Binary data can be created in ArrayBuffer but need to use a fake Dataview. For saving, whilst blobs 
//			are available (as MozBlobBuilder), we cannot practically save them.  (data URI is possible but no 
//			filename - saveAs library can provide this as a fallback but not implemented yet).
//			Neat saving needs the Downloadify flash library and that cannot accept real blobs as input. 
//			Need to be able to get the "blob"'s data itself, which is
//			possible with the FakeBlobBuilder class. Also use JSZip to combine multiple files into one for 
// 			convenience (otherwise multiple flash buttons would be required).
//			Require: FileSaver, FakeBlobBuilder, jDataView_write, JSZip.
// IE:		We have to fake everything and use the flash downloadify object. Works effectively the same as firefox.

/*
 * Helper classes / 3rd party code used in this file:
 * FileSaver, used in _saveNative method for saving in Chrome:
 * 
 * FileSaver.js
 * A saveAs() FileSaver implementation.
 * 2011-08-02
 * 
 * By Eli Grey, http://eligrey.com
 * License: X11/MIT
 *   See LICENSE.md
 * http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js
 * 
 * BlobBuilder: for providing a blob-like object that allows access to its data, modified slightly, source
 * and license at the end of this file 
 * 
 * JSZip: for combining multiple files into a single file for more convenient download, source and license at
 * the end of this file. 
 */

/** Class to handle saving input binary data to a file in a moderately cross-browser way
 * Usage pattern is to create an HTML button or small Flash button that when pressed will initiate the save
 * This is because saving from Flash (via Downloadify) cannot be initiated without user action i.e. click on 
 * a button
 * 
 * By Harry Gibson, 2012-02-08
 * GNU / GPL v3
 * 
 * Usage:
 * var blob1 = BinaryHelper.createBlob();
 * var blob2 = BinaryHelper.createBlob();
 * blob1.append(someArrayBuffer);
 * blob2.append(someBinaryStringData);
 * var bH = new BinaryHelper();
 * // "file1" and "file2" will be the file extensions
 * // "saved." will be the filename
 * // this usage pattern is done for esri shapefiles where we want a common filename but different extensions
 * // probably more useful to modify this for general use
 * var dataObject = {
 * 	file1: blob1.getBlob(),
 * 	file2: blob2.getBlob()
 * } 
 * bH.addData(dataObject,"saved."); 
 * // create the button in an existing div; clicking it will save the file
 * var btn = bH.createSaveControl("existingDivId);
 * // In Chrome we can programmatically or otherwise just call: 
 * bH._saveNative()
 
 * @param {Object} preferredOptions
 */
(function(preferredOptions){
	
	var getSaveMethod = function(preferred){
	// preferred options for saving are chosen in order (or specify "FLASH" to force that): 
	// 1 - saveAs from eligrey.com FileSaver library. Saves files natively and correctly with Chrome directly
	// from blob objects. Use to save individual files all at once in Chrome. But not in Firefox as filename
	// can't be set there so user can't tell which file is which 
	// 2 - downloadify flash library. If flash is installed will work in any browser based on base64 encoded
	// input string. Inconvenient to save multiple files so combine with JSZip to zip all into a single 
	// file. Blobs not then required for saving (but still used in shapefile creation)
	// 3 - saveAs from eligrey.com in Firefox. Works, but filename cannot be set. Therefore use this if we're in
	// firefox but flash not installed. Zip file first so there is only one, and warn user to rename to xyz.zip   
	if (typeof(chrome)!=='undefined' && !(preferred && preferred != "CHROME")){
		// Case 1: can use saveAs which will use filesystem method to save
		return "CHROME";
	}
	var hasFlash = false;
	try {
		var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
		if (fo) 
			hasFlash = true;
	} 
	catch (e) {
		if (navigator.mimeTypes["application/x-shockwave-flash"] != undefined) 
			hasFlash = true;
	}
	if (hasFlash && !(preferred && preferred != "FLASH")){
		// Case 2: can use flash library
		return "FLASH";
	}
	// maybe we don't have flash but can use data URIs. If data URIs are available, the saveAs object will
	// work albeit with dodgy download names
	var data = new Image();
	data.onload = data.onerror = function(){
		if(this.width != 1 || this.height != 1){
			// failed - we can't save anything
			return "NONE";
		}
		else {
			// case 3:  can use saveAs which will use data uri method to save
			return "DATAURI";
		}
	}
	data.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
}
	
	var BinaryHelper = function(preferredType){
		if (preferredType) {
			this._saveMethod = getSaveMethod(preferredType);
		}
		else {this._saveMethod = getSaveMethod();}
		this._data = {};
		
	}
	BinaryHelper.RequireFakeBlob = getSaveMethod() === "FLASH" ? true : false;
	var sC_Proto = BinaryHelper.prototype;
	sC_Proto.addData = function(dataObject,fileBaseName){
		// dataObject is an object where keys are filename and values are Fake-blobs of data (where data property
		// is accessible)
		// optional fileBaseName parameter if true will treat the keys as a suffix rather than full filename
		this.data = dataObject;
		this._filenamebase = fileBaseName || null;
	}
	sC_Proto._saveNative = function(dataObjOrArray,fileNamesOrArray){
		// function calls the native FileSaver, via the saveAs wrapper class for now
		// saveAs function to neaten native saving in Chrome, taken from:
		/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
		// saveAs does enable saving in browsers with data URI support too but no filenames then
		if (typeof(saveAs) === 'undefined') {
			// run the code to set up native saving as a global object only when we need it
			saveAs = function(h){
				"use strict";
				var r = h.document, l = function(){
					return h.URL || h.webkitURL || h
				}, e = h.URL || h.webkitURL || h, n = r.createElementNS("http://www.w3.org/1999/xhtml", "a"), g = "download" in n, j = function(t){
					var s = r.createEvent("MouseEvents");
					s.initMouseEvent("click", true, false, h, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
					return t.dispatchEvent(s)
				}, o = h.webkitRequestFileSystem, p = h.requestFileSystem || o || h.mozRequestFileSystem, m = function(s){
					(h.setImmediate || h.setTimeout)(function(){
						throw s
					}, 0)
				}, c = "application/octet-stream", k = 0, b = [], i = function(){
					var t = b.length;
					while (t--) {
						var s = b[t];
						if (typeof s === "string") {
							e.revokeObjectURL(s)
						}
						else {
							s.remove()
						}
					}
					b.length = 0
				}, q = function(t, s, w){
					s = [].concat(s);
					var v = s.length;
					while (v--) {
						var x = t["on" + s[v]];
						if (typeof x === "function") {
							try {
								x.call(t, w || t)
							} 
							catch (u) {
								m(u)
							}
						}
					}
				}, f = function(t, u){
					var v = this, B = t.type, E = false, x, w, s = function(){
						var F = l().createObjectURL(t);
						b.push(F);
						return F
					}, A = function(){
						q(v, "writestart progress write writeend".split(" "))
					}, D = function(){
						if (E || !x) {
							x = s(t)
						}
						w.location.href = x;
						v.readyState = v.DONE;
						A()
					}, z = function(F){
						return function(){
							if (v.readyState !== v.DONE) {
								return F.apply(this, arguments)
							}
						}
					}, y = {
						create: true,
						exclusive: false
					}, C;
					v.readyState = v.INIT;
					if (!u) {
						u = "download"
					}
					if (g) {
						x = s(t);
						n.href = x;
						n.download = u;
						if (j(n)) {
							v.readyState = v.DONE;
							A();
							return
						}
					}
					if (h.chrome && B && B !== c) {
						C = t.slice || t.webkitSlice;
						t = C.call(t, 0, t.size, c);
						E = true
					}
					if (o && u !== "download") {
						u += ".download"
					}
					if (B === c || o) {
						w = h
					}
					else {
						w = h.open()
					}
					if (!p) {
						D();
						return
					}
					k += t.size;
					p(h.TEMPORARY, k, z(function(F){
						F.root.getDirectory("saved", y, z(function(G){
							var H = function(){
								G.getFile(u, y, z(function(I){
									I.createWriter(z(function(J){
										J.onwriteend = function(K){
											w.location.href = I.toURL();
											b.push(I);
											v.readyState = v.DONE;
											q(v, "writeend", K)
										};
										J.onerror = function(){
											var K = J.error;
											if (K.code !== K.ABORT_ERR) {
												D()
											}
										};
										"writestart progress write abort".split(" ").forEach(function(K){
											J["on" + K] = v["on" + K]
										});
										J.write(t);
										v.abort = function(){
											J.abort();
											v.readyState = v.DONE
										};
										v.readyState = v.WRITING
									}), D)
								}), D)
							};
							G.getFile(u, {
								create: false
							}, z(function(I){
								I.remove();
								H()
							}), z(function(I){
								if (I.code === I.NOT_FOUND_ERR) {
									H()
								}
								else {
									D()
								}
							}))
						}), D)
					}), D)
				}, d = f.prototype, a = function(s, t){
					return new f(s, t)
				};
				d.abort = function(){
					var s = this;
					s.readyState = s.DONE;
					q(s, "abort")
				};
				d.readyState = d.INIT = 0;
				d.WRITING = 1;
				d.DONE = 2;
				d.error = d.onwritestart = d.onprogress = d.onwrite = d.onabort = d.onerror = d.onwriteend = null;
				h.addEventListener("unload", i, false);
				return a
			}(self);
		}
		for (key in this.data) {
			if (this.data.hasOwnProperty(key)){
				saveAs(this.data[key],this._getFileName(key));
			}
		}
	}
	sC_Proto.createBlob = function(){
		// if we are using saveAs native saving then blob builder can also be native (WebKitBlobBuilder).
		// If not then it needs to be something to which we can append either normal arrays, arraybuffers,
		// or strings, and from which we can extract the data in a (binary) string format
		// we will use the BlobBuilder class from Eli Grey for this; it has lots of more advanced handling
		// not needed here but will minimise changes needed in clients later 
		return new BlobBuilder();
	}	
	// sort out filename for saved data
	sC_Proto._getFileName = function(key){
		if (this._filenamebase == null){
			return key;
		}
		else {
			return this._filenamebase + key;
		}
	}
	sC_Proto._getBase64DataAsSingleFile = function(){
		// function returns the data to be sent to the downloadify swf as a base64 string
		// it will be the file itself if only one in the data object, or a zip of them if multiple
		var numFiles = 0;
		for (key in this.data){
			if (this.data.hasOwnProperty(key)){
				numFiles+=1;
				//if (numFiles==1){fileName = key;}
			}
		}
		if (numFiles==0) return;
		if (numFiles==1){
			var saveData = JSZipBase64.encode(this.data[key].data);
			return saveData;
		}
		
		var zip = new JSZip();
		for (key in this.data) {
			if (this.data.hasOwnProperty(key)) {
				// need to use the blob's data directly. This is a dirty hack which isn't in the "native" blob,
				// only in the fake blob. 
				// should instead check whether flash saving will be required when making the shapefile
				// and simply return binary string if so
				var b64 = JSZipBase64.encode(this.data[key].data);
				var fname = this._getFileName(key);
				//zip.add(fname, b64, {
				//	base64: true
				//});
				zip.add(fname,b64,{base64:true})
			}
		}
		return zip.generate();
	}
	
	sC_Proto.createSaveControl = function(locationDiv,append){
		// function takes as input the id of a div; to this it will append either a native HTML button 
		// or a flash movie looking
		// like one. div will have size 96*22 pixels. clicking the button will cause the data to be saved
		//var wrapper = document.createElement("div");
		//wrapper.style.width=96;
		//wrapper.style.height=22;
		var that = this;
		if (!append){document.getElementById(locationDiv).innerHTML="";}
		if (this._saveMethod == "CHROME"){
			var btn = document.createElement("input");
			btn.value = "Save results";
			btn.type = "button";
			btn.onclick = function(){
				that._saveNative();
			};
			document.getElementById(locationDiv).appendChild(btn);
		}
		else if (this._saveMethod == "FLASH"){
			Downloadify.create(locationDiv,{
				swf: '../lib/downloadify/media/downloadify.swf',
				downloadImage: '../lib/downloadify/images/download_nativelook.png',
				filename: function(){
					console.log("filename requested");
					return that._getFileName("zip");
				},
				width:96,
				height:22,
				data: function(){
					console.log("data requested");
					return	that._getBase64DataAsSingleFile();
					//return that.getBlobData();
				},
				//dataType:"string", 
				dataType: 'base64',
				transparent:false,
				append:true
			});
		}
		else if (this._saveMethod == "DATAURI"){
			// not implemented yet
			locationDiv.innerHTML="Error!";
			console.log("DATA URI save methods not implemented yet, try getting flash or Chrome");
		}
		else if (this._saveMethod == "NONE"){
			// error
			locationDiv.innerHTML="Error!";
			console.error("Cannot save, no method is available... get a better browser!");
		}
		//return wrapper;
	}
	self.BinaryHelper = BinaryHelper;
}());

	
/* BlobBuilder.js
 * A BlobBuilder implementation.
 * 2011-07-13
 * 
 * By Eli Grey, http://eligrey.com
 * License: X11/MIT
 *   See LICENSE.md
 */

/*global self, unescape */
/*jslint bitwise: true, regexp: true, confusion: true, es5: true, vars: true, white: true,
  plusplus: true */

/*! @source http://purl.eligrey.com/github/BlobBuilder.js/blob/master/BlobBuilder.js */

var BlobBuilder =  BlobBuilder ||// self.WebKitBlobBuilder || self.MozBlobBuilder ||
(function(view) {
"use strict";
// modified to allow forcing of fake blob builder. Used in browsers (firefox) where real blobs are 
// available but no useful native means of saving them is implemented. Saving to files is then 
// based on Downloadify, but this needs string input and therefore needs access to the data of the blob,
// therefore MozBlobBuilder is no use for building a file-saving application
if (!BinaryHelper.RequireFakeBlob && (self.WebKitBlobBuilder || self.MozBlobBuilder)){
	return self.WebKitBlobBuilder || self.MozBlobBuilder;
}
var
	  get_class = function(object) {
		return Object.prototype.toString.call(object).match(/^\[object\s(.*)\]$/)[1];
	}
	, FakeBlobBuilder = function(){
		this.data = [];
	}
	, FakeBlob = function(data, type, encoding) {
		this.data = data;
		this.size = data.length;
		this.type = type;
		this.encoding = encoding;
	}
	, FBB_proto = FakeBlobBuilder.prototype
	, FB_proto = FakeBlob.prototype
	, FileReaderSync = view.FileReaderSync
	, FileException = function(type) {
		this.code = this[this.name = type];
	}
	, file_ex_codes = (
		  "NOT_FOUND_ERR SECURITY_ERR ABORT_ERR NOT_READABLE_ERR ENCODING_ERR "
		+ "NO_MODIFICATION_ALLOWED_ERR INVALID_STATE_ERR SYNTAX_ERR"
	).split(" ")
	, file_ex_code = file_ex_codes.length
	, realURL = view.URL || view.webkitURL || view
	, real_create_object_URL = realURL.createObjectURL
	, real_revoke_object_URL = realURL.revokeObjectURL
	, URL = realURL
	, btoa = view.btoa
	, atob = view.atob
	, can_apply_typed_arrays = false
	, can_apply_typed_arrays_test = function(pass) {
		can_apply_typed_arrays = !pass;
	}

	, ArrayBuffer = view.ArrayBuffer
	, Uint8Array = view.Uint8Array
;
FakeBlobBuilder.fake = FB_proto.fake = true;
while (file_ex_code--) {
	FileException.prototype[file_ex_codes[file_ex_code]] = file_ex_code + 1;
}
try {
	if (Uint8Array) {
		can_apply_typed_arrays_test.apply(0, new Uint8Array(1));
	}
} catch (ex) {}
if (!realURL.createObjectURL) {
	URL = view.URL = {};
}
URL.createObjectURL = function(blob) {
	var
		  type = blob.type
		, data_URI_header
	;
	if (type === null) {
		type = "application/octet-stream";
	}
	if (blob instanceof FakeBlob) {
		data_URI_header = "data:" + type;
		if (blob.encoding === "base64") {
			return data_URI_header + ";base64," + blob.data;
		} else if (blob.encoding === "URI") {
			return data_URI_header + "," + decodeURIComponent(blob.data);
		} if (btoa) {
			return data_URI_header + ";base64," + btoa(blob.data);
		} else {
			return data_URI_header + "," + encodeURIComponent(blob.data);
		}
	} else if (typeof(real_create_object_url)!=="undefined") {
		return real_create_object_url.call(realURL, blob);
	}
};
URL.revokeObjectURL = function(object_url) {
	if (object_url.substring(0, 5) !== "data:" && real_revoke_object_url) {
		real_revoke_object_url.call(realURL, object_url);
	}
};
FBB_proto.append = function(data/*, endings*/) {
	var bb = this.data;
	// decode data to a binary string
	if (Uint8Array && data instanceof ArrayBuffer) {
		if (can_apply_typed_arrays) {
			bb.push(String.fromCharCode.apply(String, new Uint8Array(data)));
		} else {
			var
				  str = ""
				, buf = new Uint8Array(data)
				, i = 0
				, buf_len = buf.length
			;
			for (; i < buf_len; i++) {
				str += String.fromCharCode(buf[i]);
			}
		}
		// what about bb.push?? missing
	} else if (get_class(data) === "Blob" || get_class(data) === "File") {
		if (FileReaderSync) {
			var fr = new FileReaderSync;
			bb.push(fr.readAsBinaryString(data));
		} else {
			// async FileReader won't work as BlobBuilder is sync
			throw new FileException("NOT_READABLE_ERR");
		}
	} else if (data instanceof FakeBlob) {
		if (data.encoding === "base64" && atob) {
			bb.push(atob(data.data));
		} else if (data.encoding === "URI") {
			bb.push(decodeURIComponent(data.data));
		} else if (data.encoding === "raw") {
			bb.push(data.data);
		}
	} else {
		if (typeof data !== "string") {
			data += ""; // convert unsupported types to strings
		}
		// decode UTF-16 to binary string
		// cancelled this ... 
		//bb.push(unescape(encodeURIComponent(data)));
		bb.push(data);
	}
};
FBB_proto.getBlob = function(type) {
	if (!arguments.length) {
		type="";//type = null;
	}
	return new FakeBlob(this.data.join(""), type, "raw");
};
FBB_proto.toString = function() {
	return "[object BlobBuilder]";
};
FB_proto.slice = function(start, end, type) {
	var args = arguments.length;
	if (args < 3) {
		type = null;
	}
	return new FakeBlob(
		  this.data.slice(start, args > 1 ? end : this.data.length)
		, type
		, this.encoding
	);
};
FB_proto.toString = function() {
	return "[object Blob]";
};
return FakeBlobBuilder;
}(self));



/**

JSZip - A Javascript class for generating Zip files
<http://jszip.stuartk.co.uk>

(c) 2009 Stuart Knightley <stuart [at] stuartk.co.uk>
Licenced under the GPLv3 and the MIT licences

Usage:
   zip = new JSZip();
   zip.add("hello.txt", "Hello, World!").add("tempfile", "nothing");
   zip.folder("images").add("smile.gif", base64Data, {base64: true});
   zip.add("Xmas.txt", "Ho ho ho !", {date : new Date("December 25, 2007 00:00:01")});
   zip.remove("tempfile");

   base64zip = zip.generate();

**/

function JSZip(compression)
{
   // default : no compression
   this.compression = (compression || "STORE").toUpperCase();
   this.files = [];

   // Where we are in the hierarchy
   this.root = "";

   // Default properties for a new file
   this.d = {
      base64: false,
      binary: false,
      dir: false,
      date: null
   };

   if (!JSZip.compressions[this.compression]) {
      throw compression + " is not a valid compression method !";
   }
}

/**
 * Add a file to the zip file
 * @param   name  The name of the file
 * @param   data  The file data, either raw or base64 encoded
 * @param   o     File options
 * @return  this JSZip object
 */
JSZip.prototype.add = function(name, data, o)
{
   o = o || {};
   name = this.root+name;

   if (o.base64 === true && o.binary == null) o.binary = true;

   for (var opt in this.d)
   {
      o[opt] = o[opt] || this.d[opt];
   }

   // date
   // @see http://www.delorie.com/djgpp/doc/rbinter/it/52/13.html
   // @see http://www.delorie.com/djgpp/doc/rbinter/it/65/16.html
   // @see http://www.delorie.com/djgpp/doc/rbinter/it/66/16.html

   o.date = o.date || new Date();
   var dosTime, dosDate;

   dosTime = o.date.getHours();
   dosTime = dosTime << 6;
   dosTime = dosTime | o.date.getMinutes();
   dosTime = dosTime << 5;
   dosTime = dosTime | o.date.getSeconds() / 2;

   dosDate = o.date.getFullYear() - 1980;
   dosDate = dosDate << 4;
   dosDate = dosDate | (o.date.getMonth() + 1);
   dosDate = dosDate << 5;
   dosDate = dosDate | o.date.getDate();

   if (o.base64 === true) data = JSZipBase64.decode(data);
   // decode UTF-8 strings if we are dealing with text data
   if(o.binary === false) data = this.utf8encode(data);


   var compression    = JSZip.compressions[this.compression];
   var compressedData = compression.compress(data);

   var header = "";

   // version needed to extract
   header += "\x0A\x00";
   // general purpose bit flag
   header += "\x00\x00";
   // compression method
   header += compression.magic;
   // last mod file time
   header += this.decToHex(dosTime, 2);
   // last mod file date
   header += this.decToHex(dosDate, 2);
   // crc-32
   header += this.decToHex(this.crc32(data), 4);
   // compressed size
   header += this.decToHex(compressedData.length, 4);
   // uncompressed size
   header += this.decToHex(data.length, 4);
   // file name length
   header += this.decToHex(name.length, 2);
   // extra field length
   header += "\x00\x00";

   // file name

   this.files[name] = {header: header, data: compressedData, dir: o.dir};

   return this;
};

/**
 * Add a directory to the zip file
 * @param   name  The name of the directory to add
 * @return  JSZip object with the new directory as the root
 */
JSZip.prototype.folder = function(name)
{
   // Check the name ends with a /
   if (name.substr(-1) != "/") name += "/";

   // Does this folder already exist?
   if (typeof this.files[name] === "undefined") this.add(name, '', {dir:true});

   // Allow chaining by returning a new object with this folder as the root
   var ret = this.clone();
   ret.root = this.root+name;
   return ret;
};

/**
 * Compare a string or regular expression against all of the filenames and
 * return an informational object for each that matches.
 * @param   string/regex The regular expression to test against
 * @return  An array of objects representing the matched files. In the form
 *          {name: "filename", data: "file data", dir: true/false}
 */
JSZip.prototype.find = function(needle)
{
   var result = [], re;
   if (typeof needle === "string")
   {
      re = new RegExp("^"+needle+"$");
   }
   else
   {
      re = needle;
   }

   for (var filename in this.files)
   {
      if (re.test(filename))
      {
         var file = this.files[filename];
         result.push({name: filename, data: file.data, dir: !!file.dir});
      }
   }

   return result;
};

/**
 * Delete a file, or a directory and all sub-files, from the zip
 * @param   name  the name of the file to delete
 * @return  this JSZip object
 */
JSZip.prototype.remove = function(name)
{
   var file = this.files[name];
   if (!file)
   {
      // Look for any folders
      if (name.substr(-1) != "/") name += "/";
      file = this.files[name];
   }

   if (file)
   {
      if (name.match("/") === null)
      {
         // file
         delete this.files[name];
      }
      else
      {
         // folder
         var kids = this.find(new RegExp("^"+name));
         for (var i = 0; i < kids.length; i++)
         {
            if (kids[i].name == name)
            {
               // Delete this folder
               delete this.files[name];
            }
            else
            {
               // Remove a child of this folder
               this.remove(kids[i].name);
            }
         }
      }
   }

   return this;
};

/**
 * Generate the complete zip file
 * @return  A base64 encoded string of the zip file
 */
JSZip.prototype.generate = function(asBytes)
{
   asBytes = asBytes || false;

   // The central directory, and files data
   var directory = [], files = [], fileOffset = 0;

   for (var name in this.files)
   {
      if( !this.files.hasOwnProperty(name) ) { continue; }

      var fileRecord = "", dirRecord = "";
      fileRecord = "\x50\x4b\x03\x04" + this.files[name].header + name + this.files[name].data;

      dirRecord = "\x50\x4b\x01\x02" +
      // version made by (00: DOS)
      "\x14\x00" +
      // file header (common to file and central directory)
      this.files[name].header +
      // file comment length
      "\x00\x00" +
      // disk number start
      "\x00\x00" +
      // internal file attributes TODO
      "\x00\x00" +
      // external file attributes
      (this.files[name].dir===true?"\x10\x00\x00\x00":"\x00\x00\x00\x00")+
      // relative offset of local header
      this.decToHex(fileOffset, 4) +
      // file name
      name;

      fileOffset += fileRecord.length;

      files.push(fileRecord);
      directory.push(dirRecord);
   }

   var fileData = files.join("");
   var dirData = directory.join("");

   var dirEnd = "";

   // end of central dir signature
   dirEnd = "\x50\x4b\x05\x06" +
   // number of this disk
   "\x00\x00" +
   // number of the disk with the start of the central directory
   "\x00\x00" +
   // total number of entries in the central directory on this disk
   this.decToHex(files.length, 2) +
   // total number of entries in the central directory
   this.decToHex(files.length, 2) +
   // size of the central directory   4 bytes
   this.decToHex(dirData.length, 4) +
   // offset of start of central directory with respect to the starting disk number
   this.decToHex(fileData.length, 4) +
   // .ZIP file comment length
   "\x00\x00";

   var zip = fileData + dirData + dirEnd;
   return (asBytes) ? zip : JSZipBase64.encode(zip);

};

/*
 * Compression methods
 * This object is filled in as follow :
 * name : {
 *    magic // the 2 bytes indentifying the compression method
 *    compress // function, take the uncompressed content and return it compressed.
 * }
 *
 * STORE is the default compression method, so it's included in this file.
 * Other methods should go to separated files : the user wants modularity.
 */
JSZip.compressions = {
   "STORE" : {
      magic : "\x00\x00",
      compress : function (content) {
         return content; // no compression
      }
   }
};

// Utility functions

JSZip.prototype.decToHex = function(dec, bytes)
{
   var hex = "";
   for(var i=0;i<bytes;i++) {
      hex += String.fromCharCode(dec&0xff);
      dec=dec>>>8;
   }
   return hex;
};

/**
*
*  Javascript crc32
*  http://www.webtoolkit.info/
*
**/

JSZip.prototype.crc32 = function(str, crc)
{

   if (str === "") return "\x00\x00\x00\x00";

   var table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";

   if (typeof(crc) == "undefined") { crc = 0; }
   var x = 0;
   var y = 0;

   crc = crc ^ (-1);
   for( var i = 0, iTop = str.length; i < iTop; i++ ) {
      y = ( crc ^ str.charCodeAt( i ) ) & 0xFF;
      x = "0x" + table.substr( y * 9, 8 );
      crc = ( crc >>> 8 ) ^ x;
   }

   return crc ^ (-1);

};

// Inspired by http://my.opera.com/GreyWyvern/blog/show.dml/1725165
JSZip.prototype.clone = function()
{
   var newObj = new JSZip();
   for (var i in this)
   {
      if (typeof this[i] !== "function")
      {
         newObj[i] = this[i];
      }
   }
   return newObj;
};

JSZip.prototype.utf8encode = function(input)
{
   input = encodeURIComponent(input);
   input = input.replace(/%.{2,2}/g, function(m) {
      var hex = m.substring(1);
      return String.fromCharCode(parseInt(hex,16));
   });
   return input;
};

/**
*
*  Base64 encode / decode
*  http://www.webtoolkit.info/
*
*  Hacked so that it doesn't utf8 en/decode everything
**/

var JSZipBase64 = function() {
   // private property
   var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

   return {
      // public method for encoding
      encode : function(input, utf8) {
         var output = "";
         var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
         var i = 0;

         while (i < input.length) {

            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
               enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
               enc4 = 64;
            }

            output = output +
            _keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
            _keyStr.charAt(enc3) + _keyStr.charAt(enc4);

         }

         return output;
      },

      // public method for decoding
      decode : function(input, utf8) {
         var output = "";
         var chr1, chr2, chr3;
         var enc1, enc2, enc3, enc4;
         var i = 0;

         input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

         while (i < input.length) {

            enc1 = _keyStr.indexOf(input.charAt(i++));
            enc2 = _keyStr.indexOf(input.charAt(i++));
            enc3 = _keyStr.indexOf(input.charAt(i++));
            enc4 = _keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
               output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
               output = output + String.fromCharCode(chr3);
            }

         }

         return output;

      }
   };
   self.BinaryHelper = BinaryHelper;
}();
