// A prototype implementation of (parts of) the HTML5 DataView specification available at 
// http://www.khronos.org/registry/typedarray/specs/latest/#8
// Provides a way to _create_ "binary" data in browsers that do not have DataView (currently only Chrome does).
// Based on jsDataView at https://github.com/gmarty/jsDataView
// which is read only. This is write only. Maybe someone ought to combine them...
// Data are created as an ArrayBuffer if available and a JS array of ints if not.
// Use the createEmptyBuffer(length) method to create a buffer of the best available type first,
// then pass this to the constructor: 
// var buf = jDataView_write.createEmptyBuffer(100); 
// var vw = new jDataView_write(buf);
// The byteOffset and byteLength parameters are not used yet; the view will be of the whole buffer
// Retrieve the buffer using vw.getBuffer(), this will return either an ArrayBuffer or 
// a binary string where each character's code represents the associated value
// Either are suitable for appending to BlobBuilder (implemented by eli grey, code below) 	
//var jDataView_write = jDataView_write ||
//self.DataView ||
(function(){
var compatibility = {
		ArrayBuffer: typeof ArrayBuffer !== 'undefined',
		DataView: typeof DataView !== 'undefined' && 'getFloat64' in DataView.prototype
};
var jDataView_write = function(buffer,byteOffset,byteLength,debug){
		this._buffer = buffer;
		if (!(compatibility.ArrayBuffer && buffer instanceof ArrayBuffer) &&
			!(buffer instanceof Array)){
			throw new TypeError('Type Error');
		}
		this._isArrayBuffer = compatibility.ArrayBuffer && buffer instanceof ArrayBuffer;
		// FOR TESTING - log things to console
		this._log = debug;
		// we should never be here because this whole thing only comes into being if window.DataView doesn't exist
		this._isDataView = compatibility.DataView && this._isArrayBuffer;
		// Default endian-ness for get/set methods - this has been added in jDataView but I am 
		// not implementing for now (as per standard DataView), use methods to set required value each time
		this._littleEndian = false; 
		var bufferLength = this._isArrayBuffer ? buffer.byteLength : buffer.length;
		// Start offset of view relative to its buffer - not implementing for now, will force 
		// view length = buffer length 
		var byteOffset=0;
		if (byteLength == undefined){ // which it is, until we implement it
			byteLength = bufferLength - byteOffset; // == bufferLength until byteOffset implemented
		}
		if (!this._isDataView){
		// Do additional checks to simulate DataView
			if (typeof byteOffset !== 'number') {
				throw new TypeError('Type error');
			}
			if (typeof byteLength !== 'number') {
				throw new TypeError('Type error');
			}
			if (typeof byteOffset < 0) {
				throw new Error('INDEX_SIZE_ERR: DOM Exception 1');
			}
			if (typeof byteLength < 0) {
				throw new Error('INDEX_SIZE_ERR: DOM Exception 1');
			}
		}
		if (this._isDataView) {
			this._view = new DataView(buffer, byteOffset, byteLength);
			this._start = 0;
		}
		this._start = byteOffset; // not using offset tracking stuff, just doing basic dataview
		if (byteOffset >= bufferLength) {
			throw new Error('INDEX_SIZE_ERR: DOM Exception 1');
		}
		this._offset = 0; // not using offset tracking stuff, just doing basic dataview
		this.length = byteLength;
	};
	
jDataView_write.createBuffer = function(){
	// left this in from jsDataView but not used - string array buffer type needs zero filling
	if (typeof ArrayBuffer !== 'undefined') {
		var buffer = new ArrayBuffer(arguments.length);
		var view = new Int8Array(buffer);
		for (var i = 0; i < arguments.length; ++i) {
			view[i] = arguments[i];
		}
		return buffer;
	}
	return String.fromCharCode.apply(null, arguments);
}
jDataView_write.createEmptyBuffer = function(length,forceString){
	// temporary replacement for createBuffer. If ArrayBuffer isn't available (or forceString is 
	// set true, for debugging in a browser that does have ArrayBuffer), it creates 
	// a normal array containing zero at each position
	if (typeof ArrayBuffer !== 'undefined' && !forceString){
		var buffer = new ArrayBuffer(length);
		return buffer;	
	}
	var buffer = [];
	for (var i=0;i<length;i++){
		//buffer[i] = String.fromCharCode(0);
		buffer[i]=0x00;
	}
	return buffer;
}
var JDV_proto = jDataView_write.prototype;
JDV_proto.setUint8 = function(offset,value){
	// the fundamental method for setting a value, writing a single unsigned byte to the buffer 
	if (this._isArrayBuffer){
		// if arraybuffer available then so is Uint8 typed array
		// need to rewrite other methods to do the same by iterating over the bytes of hte input value
		// and setting into a Uint32Array etc, rather than making a new Uint8Array for each byte... 
		(new Uint8Array(this._buffer,offset,1))[0] = value;
	}
	else {
		//this._buffer[offset] = String.fromCharCode(value&0xff)
		//this._buffer[offset]=value;
		if (typeof(value)==="string") this._buffer[offset]=value.charCodeAt(0)
		else this._buffer[offset]=value;
	}
}
JDV_proto.setInt8 = function(offset,value){
	if (value < 0){
		this.setUint8(offset,Math.pow(2,8)+value) // -1 will be stored as 255, -128 as 128, 
	}
	else {
		this.setUint8(offset,value);
	}
}
JDV_proto.setUint16 = function(offset,value,littleEndian){
	if (this._isDataView) {
		// use the native dataview methods directly if they're available
		this._view.setUint16(offset, value, littleEndian);
	}
	else {
		var byte0 = Math.floor(value / Math.pow(2, 8));
		var byte1 = value % (Math.pow(2, 8));
		this.setUint8(this._getOffsetOfByte(offset, 0, 2, littleEndian), byte0);
		this.setUint8(this._getOffsetOfByte(offset, 1, 2, littleEndian), byte1);
	}
}
JDV_proto.setInt16 = function(offset,value,littleEndian){
	if (this._isDataView) {
		this._view.setInt16(offset,value,littleEndian);
		return;
	}
	if (value < 0){
		var twoscomp = Math.pow(2,16)+value;
		this.setUint16(offset,twoscomp,littleEndian);
	}
	else {
		this.setUint16(offset,value,littleEndian);
	}
}
JDV_proto.setUint32 = function(offset,value,littleEndian){
	if (this._isDataView){
		this._view.setUint32(offset,value,littleEndian);
		return;
	}
	var byte0 = value % 256; // least significant
	var byte1 = (value >>> 8) % 256;
	var byte2 = (value >>> 16) % 256;
	var byte3 = (value >>> 24) % 256; // most significant
	this.setUint8 (this._getOffsetOfByte(offset,0,4,littleEndian),byte3);
	this.setUint8(this._getOffsetOfByte(offset,1,4,littleEndian),byte2);
	this.setUint8 (this._getOffsetOfByte(offset,2,4,littleEndian),byte1);
	this.setUint8(this._getOffsetOfByte(offset,3,4,littleEndian),byte0);
}
JDV_proto.setInt32 = function(offset,value,littleEndian){
	if (this._isDataView){
		this._view.setInt32(offset,value,littleEndian);
		return;
	}
	var bytesArray = this._encodeInt(value,32,true); //bytesarray in LE order
	if (!littleEndian){bytesArray.reverse();} //bytes array is returned as little-endian
	if (this._log)console.log("About to set int32 value of "+value) 
	for (var bytenum=0;bytenum<bytesArray.length;bytenum+=1){
		//var offsetOfByte = this._getOffsetOfByte(offset,bytenum,4,littleEndian);
		// the array is in the right order for the required endian-ness so don't need to calculate the 
		// byte offset by working backwards
		var offsetOfByte = offset+bytenum; 
		var val = bytesArray[bytenum];
		if (this._log)console.log("LE: "+littleEndian+" setting byte "+bytenum+" of int32 to "+val+" or hex "+val.toString(16)+" at "+offsetOfByte);
		//this.setUint8(this._getOffsetOfByte(offset,bytenum,4,littleEndian),bytesArray[bytenum]);
		this.setUint8(offsetOfByte,val);
	}
}
JDV_proto.setFloat32 = function(offset,value,littleEndian){
	if (this._isDataView){
		this._view.setFloat32(offset,value,littleEndian);
		return;
	}
	// now it gets tricky. single precision floating point format consists of:
	// 32 bits / 4 bytes where
	// bit 31 = sign
	// bits 30-23 = exponent
	// bits 22 - 0 = fraction
	// luckily someone else has already written a method for doing it 
	// which I have included as _encodeFloat...
	var bytesArray = this._encodeFloat(value,23,8);
	if (!littleEndian){bytesArray.reverse();}
	for (var bytenum=0;bytenum<bytesArray.length;bytenum+=1){
		this.setUint8(this._getOffsetOfByte(offset,bytenum,8,littleEndian),bytesArray[bytenum]);
	}	
}
JDV_proto.setFloat64 = function(offset,value,littleEndian){
	if (this._isDataView){
		this._view.setFloat64(offset,value,littleEndian);
		return;
	}
	// 64 bits / 8 bytes, where 
	// bit 63 = sign, 0=positive, 1=non-positive
	// bits 62 - 62 = exponent (ll bits)
	// bits 51 - 0 = fraction (52 bits)
	var bytesArray = this._encodeFloat(value,52,11); // method always returns in littleEndian order
	if (!littleEndian){bytesArray.reverse();}
	// debug setting
	if (this._log)console.log("About to set float64 value of "+value) 
	for (var bytenum=0;bytenum<bytesArray.length;bytenum+=1){
		//var offsetOfByte = this._getOffsetOfByte(offset,bytenum,8,littleEndian);
		// the array is in the right order for the required endian-ness so don't need to calculate the 
		// byte offset by working backwards
		var offsetOfByte = offset+bytenum; 
		var val = bytesArray[bytenum];
		// debug setting
		if (this._log)console.log("LE: "+littleEndian+" setting byte "+bytenum+" of float64 to "+val+" or hex "+val.toString(16)+" at "+offsetOfByte);
		this.setUint8(offsetOfByte,val);
		//this.setUint8(this._getOffsetOfByte(offset,bytenum,8,littleEndian),bytesArray[bytenum]);
	}
}
JDV_proto.getBuffer = function(){
	if (this._isArrayBuffer) {
		return this._buffer;
	}
	else {
		var stringBuf; 
		if (this._buffer.map) {
			stringBuf=this._buffer.map(function(x){
				return String.fromCharCode(x & 0xff);
				//return "\x" + (x.toString(16).length == 1 ? "0" + x.toString(16) : x.toString(16))
			});
		}
		else { // no array map function in IE
			stringBuf=[];
			for (var i=0;i<this._buffer.length;i++){
				stringBuf.push(String.fromCharCode((this._buffer[i])&0xff));
			}
		}
		var binaryString = stringBuf.join("");
		//var output = unescape(encodeURIComponent(binaryString));
		//no, we'll let the caller deal with encoding if needed, not our problem here
		return binaryString;
	}
}

// UTILITY FUNCTIONS
JDV_proto._getOffsetOfByte = function(offset,pos,max,littleEndian){
	// left in for posterity as it's used in the original jDataview class however we're not using it
	// offset = the start byte of the number
	// pos = the byte within this number
	// max = the length of the value we're working with in bytes
	// littleEndian - whether we need to work right to left or not
	return offset + (littleEndian? max - pos - 1 : pos);
}
JDV_proto._encodeFloat = function(value,precisionBits,exponentBits){
	// This function taken from binary parser by Jonas Raoni Soares Silva at 
	// http://jsfromhell.com/classes/binary-parser, with return object modified slightly to return 
	// array of ints rather than string
	// Returns float value as an array of length (precisionbits+exponentbits+1)/8, each member being 
	// the int value of that byte, ordered in little-endian order. 
	// See also "pack" at http://phpjs.org/functions/pack:880
	// and jspack at http://code.google.com/p/jspack/source/browse/
	var bias = Math.pow(2,exponentBits-1)-1;
	var minExp = -bias+1;
	var maxExp = bias;
	var minUnnormExp = minExp - precisionBits;
	var status = isNaN(n = parseFloat(value)) || n == -Infinity || n == +Infinity ? n : 0;
	var exp = 0;
	var len = 2*bias + 1 + precisionBits + 3;
	var bin = new Array(len);
	var signal = (n=status !== 0 ? 0 : n)<0;
	var n = Math.abs(n);
	var intPart = Math.floor(n);
	var floatPart = n-intPart;
	var i,lastBit,rounded,j,result;
	for (i=len;i;bin[--i]=0);
	for(i = bias + 2; intPart && i; bin[--i] = intPart % 2, intPart = Math.floor(intPart / 2));
	for(i = bias + 1; floatPart > 0 && i; (bin[++i] = ((floatPart *= 2) >= 1) - 0) && --floatPart);
	for(i = -1; ++i < len && !bin[i];);
	if(bin[(lastBit = precisionBits - 1 + (i = (exp = bias + 1 - i) >= minExp && exp <= maxExp ? i + 1 : bias + 1 - (exp = minExp - 1))) + 1]){
			if(!(rounded = bin[lastBit]))
				for(j = lastBit + 2; !rounded && j < len; rounded = bin[j++]);
			for(j = lastBit + 1; rounded && --j >= 0; (bin[j] = !bin[j] - 0) && (rounded = 0));
		}
	for(i = i - 2 < 0 ? -1 : i - 3; ++i < len && !bin[i];);

	(exp = bias + 1 - i) >= minExp && exp <= maxExp ? ++i : exp < minExp &&
		(exp != bias + 1 - len && exp < minUnnormExp && this.warn("encodeFloat::float underflow"), i = bias + 1 - (exp = minExp - 1));
	(intPart || status !== 0) && (this.warn(intPart ? "encodeFloat::float overflow" : "encodeFloat::" + status),
		exp = maxExp + 1, i = bias + 2, status == -Infinity ? signal = 1 : isNaN(status) && (bin[i] = 1));
	for(n = Math.abs(exp + bias), j = exponentBits + 1, result = ""; --j; result = (n % 2) + result, n = n >>= 1);
	for(n = 0, j = 0, i = (result = (signal ? "1" : "0") + result + bin.slice(i, i + precisionBits).join("")).length, r = [];
		i; n += (1 << j) * result.charAt(--i), j == 7 && 
			(r[r.length] = 
			//String.fromCharCode(n), // make it return array of ints not the binary string rep of them
			n, 
			n = 0), j = (j + 1) % 8);
	// commented out this line as it adds an empty string at the end, not sure why necessary:
	//r[r.length] = n ? String.fromCharCode(n) : "";
	return r; // array of bytes in little-endian order, reverse in caller if necessary		
}
JDV_proto._encodeInt = function(number,bits,signed){
	// function taken from binary parser by Jonas Raoni Soares Silva at 
	// http://jsfromhell.com/classes/binary-parser
	var max = Math.pow(2, bits), r = [];
	(number >= max || number < -(max >> 1)) && this.warn("encodeInt::overflow") && (number = 0);
	number < 0 && (number += max);
	for(; number; r[r.length] = 
		//String.fromCharCode(number % 256),
		number % 256, 
	number = Math.floor(number / 256));
	for(bits = -(-bits >> 3) - r.length; bits--; r[r.length] = "\0");
	return r; // array of bytes in little-endian order, reverse in caller if necessary
}

self.jDataView_write = jDataView_write;
})();
	
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

var BlobBuilder =  BlobBuilder || self.WebKitBlobBuilder || //self.MozBlobBuilder ||
(function(view) {
"use strict";
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

      // public method for encoding
      encodeBase64 = function(input, utf8) {
	  	 var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

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
      }

      // public method for decoding
      decodeBase64 = function(input, utf8) {
	  		  	 var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

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


