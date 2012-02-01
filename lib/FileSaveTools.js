// Compatibility notes:
// Chrome: We can use Dataview, ArrayBuffer and Blobs (as WebKitBlobBuilder). We can save the blobs as-is.
// 			Only a saveAs helper library is required
//			Require: saveAs
// Firefox: We can use ArrayBuffer but need to use a fake Dataview. Blobs are available (as MozBlobBuilder) but
// 			we cannot save them. Saving needs the Downloadify flash library (data URI is possible but no filename)
// 			and that cannot accept real blobs as input. Need to be able to get the "blob"'s data itself, which is
//			possible with the FakeBlobBuilder class. Need JSZip to combine multiple files into one for convenience.
//			Require: FileSaver, FakeBlobBuilder, jDataView_write, JSZip.
// IE:		We have to fake everything and use the flash downloadify object. Works effectively the same as firefox.
var binaryCompatibility = function(){
	var available = {
		dataView: false,
		arrayBuffer: false,
		blobs: false,
		saving: false
	}
	if (typeof(chrome) !== 'undefined'){
		available.dataView = true,available.arrayBuffer=true,available.blobs=true,available.saving=true;
	}
	
}

var FileSaver = FileSaver || (function(preferredType){
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
	
	var saveControl = function(preferredType){
		if (preferredType) {
			this._saveMethod = getSaveMethod(preferredType);
		}
		else {this._saveMethod = getSaveMethod();}
		this._data = {};
	}
	var sC_Proto = saveControl.prototype;
	sC_Proto.addData = function(dataObject,fileBaseName){
		// dataObject is an object where keys are filename and values are Fake-blobs of data (where data property
		// is accessible)
		// optional fileBaseName parameter if true will treat the keys as a suffix rather than full filename
		this.data = dataObject;
		this._filenamebase = fileBaseName || null;
	}
	
	sC_Proto.saveNative = function(dataObjOrArray,fileNamesOrArray){
		// function calls the native FileSaver, via the saveAs wrapper class for now
		for (key in this.data) {
			if (this.data.hasOwnProperty(key)){
				saveAs(this.data[key],this._getFileName(key));
			}
		}
	}
	sC_Proto._getFileName = function(key){
		if (this._filenamebase == null){
			return key;
		}
		else {
			return this._filenamebase + key;
		}
	}
	sC_Proto.getBase64Data = function(){
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
			var saveData = encodeBase64(this.data[key]);
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
	sC_Proto.turnBlobBackToString = function(bl){
		// downloadify / flash can't take HTML5 blobs, and we can't easily get data back out of blob in
		// native format. Options:
		// 1. Use fake blob builder and access its data property directly. Works but need to force fake in firefox
		// 2. make some wrapper class for buffers and have the shapefile library make these rather than blobs. Only 
		// use blobs for html5 saving (chrome) (wrapper needs
		//  append functionality etc). most reliable but another wrapper layer.
		// 3. turn the blob back into some kind of string or array that downloadify / jszip can handle. needs filereader
		// see http://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers
		var f = new FileReader();
		f.onload = function(e){
			return e.target.result;
		}
		f.readAsArrayBuffer(bl);
	}
	sC_Proto.createSaveControl = function(){
		// function returns a div that will contain either a native HTML button or a flash movie looking
		// like one. div will have size 96*22 pixels. clicking the button will cause the data to be saved
		var wrapper = document.createElement("div");
		wrapper.style.width=96;
		wrapper.style.height=22;
		var that = this;
		if (this._saveMethod == "CHROME"){
			var btn = document.createElement("input");
			btn.value = "Save results";
			btn.type = "button";
			btn.onclick = function(){
				that.saveNative();
			};
			wrapper.appendChild(btn);
		}
		else if (this._saveMethod == "FLASH"){
			Downloadify.create(wrapper,{
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
					return	that.getBase64Data();
					//return that.getBlobData();
				},
				//dataType:"string", 
				dataType: 'base64',
				transparent:false,
				append:false
			});
		}
		else if (this._saveMethod == "DATAURI"){
			// not implemented yet
			wrapper.innerHTML="Error!";
			console.log("DATA URI save methods not implemented yet, try getting flash or Chrome");
		}
		else if (this._saveMethod == "NONE"){
			// error
			wrapper.innerHTML="Error!";
			console.error("Cannot save, no method is available... get a better browser!");
		}
		return wrapper;
	}
	return saveControl;
})();

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
var saveAs=saveAs||(function(h){"use strict";var r=h.document,l=function(){return h.URL||h.webkitURL||h},e=h.URL||h.webkitURL||h,n=r.createElementNS("http://www.w3.org/1999/xhtml","a"),g="download" in n,j=function(t){var s=r.createEvent("MouseEvents");s.initMouseEvent("click",true,false,h,0,0,0,0,0,false,false,false,false,0,null);return t.dispatchEvent(s)},o=h.webkitRequestFileSystem,p=h.requestFileSystem||o||h.mozRequestFileSystem,m=function(s){(h.setImmediate||h.setTimeout)(function(){throw s},0)},c="application/octet-stream",k=0,b=[],i=function(){var t=b.length;while(t--){var s=b[t];if(typeof s==="string"){e.revokeObjectURL(s)}else{s.remove()}}b.length=0},q=function(t,s,w){s=[].concat(s);var v=s.length;while(v--){var x=t["on"+s[v]];if(typeof x==="function"){try{x.call(t,w||t)}catch(u){m(u)}}}},f=function(t,u){var v=this,B=t.type,E=false,x,w,s=function(){var F=l().createObjectURL(t);b.push(F);return F},A=function(){q(v,"writestart progress write writeend".split(" "))},D=function(){if(E||!x){x=s(t)}w.location.href=x;v.readyState=v.DONE;A()},z=function(F){return function(){if(v.readyState!==v.DONE){return F.apply(this,arguments)}}},y={create:true,exclusive:false},C;v.readyState=v.INIT;if(!u){u="download"}if(g){x=s(t);n.href=x;n.download=u;if(j(n)){v.readyState=v.DONE;A();return}}if(h.chrome&&B&&B!==c){C=t.slice||t.webkitSlice;t=C.call(t,0,t.size,c);E=true}if(o&&u!=="download"){u+=".download"}if(B===c||o){w=h}else{w=h.open()}if(!p){D();return}k+=t.size;p(h.TEMPORARY,k,z(function(F){F.root.getDirectory("saved",y,z(function(G){var H=function(){G.getFile(u,y,z(function(I){I.createWriter(z(function(J){J.onwriteend=function(K){w.location.href=I.toURL();b.push(I);v.readyState=v.DONE;q(v,"writeend",K)};J.onerror=function(){var K=J.error;if(K.code!==K.ABORT_ERR){D()}};"writestart progress write abort".split(" ").forEach(function(K){J["on"+K]=v["on"+K]});J.write(t);v.abort=function(){J.abort();v.readyState=v.DONE};v.readyState=v.WRITING}),D)}),D)};G.getFile(u,{create:false},z(function(I){I.remove();H()}),z(function(I){if(I.code===I.NOT_FOUND_ERR){H()}else{D()}}))}),D)}),D)},d=f.prototype,a=function(s,t){return new f(s,t)};d.abort=function(){var s=this;s.readyState=s.DONE;q(s,"abort")};d.readyState=d.INIT=0;d.WRITING=1;d.DONE=2;d.error=d.onwritestart=d.onprogress=d.onwrite=d.onabort=d.onerror=d.onwriteend=null;h.addEventListener("unload",i,false);return a}(self));
