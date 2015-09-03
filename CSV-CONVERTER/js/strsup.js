// Copyright 2013 Data Design Group, Inc  All Rights Reserved
// Portions found here and there

//pads left to length
String.prototype.lpad = function (length, pad) {
    if (typeof (pad) == "undefined") { var pad = ' '; }
    var str = this;
    while (str.length < length)
        str = pad + str;
    return str;
}

//pads right to length
String.prototype.rpad = function(length, pad ) {
    if (typeof(pad) == "undefined") { var pad = ' '; }
    var str = this;
    while (str.length < length)
        str += pad;
    return str;
}
// trim
if(typeof String.prototype.trim !== 'function') {
    String.prototype.trim = function () {
        //return this.replace(/^\s+|\s+$/g, ''); 
        return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    }
}

String.prototype.ltrim=function(){return this.replace(/^\s+/,'');};
String.prototype.rtrim=function(){return this.replace(/\s+$/g,'');};

// repeat string
if (typeof String.prototype.repeat !== 'function') {
    String.prototype.repeat = function (n) {
        n = n || 1;
        return Array(n + 1).join(this);
    }
}
String.prototype.ljust = function( width, pad ) {
	pad = pad || " ";
	pad = pad.substr( 0, 1 );
	if( this.length < width )
		return this + pad.repeat( width - this.length );
	else
		return this;
}
String.prototype.rjust = function( width, pad ) {
	pad = pad || " ";
	pad = pad.substr( 0, 1 );
	if( this.length < width )
		return pad.repeat( width - this.length ) + this;
	else
		return this;
}

String.prototype.cjust = function (width, pad) {
    pad = pad || " ";
    pad = pad.substr(0, 1);
    if (this.length < width-1) {
        var len = width - this.length;
        var remain = (len % 2 == 0) ? "" : pad;
        var pads = pad.repeat(Math.floor(len / 2));
        return pads + this + pads + remain;
    }
    else
        return this.rpad(width);
}

if (typeof String.prototype.left !== 'function') {
    String.prototype.left = function (n) { return this.substring(0, n); }    // return left side of string
}
if (typeof String.prototype.right !== 'function') {
    String.prototype.right = function (n) { return this.substring(this.length - n); }    // return right side of string
}


String.prototype.removePunctuation = function() {
    return this.replace(/[\!\@\#\$\%\^\&\*\?\.]/g, "");
};

// enclose(by,escape)
if(typeof String.prototype.enclose !== 'function') {
    String.prototype.enclose = function (byChar, escapeByCharWith) {
        if (typeof byChar === "undefined") byChar = '';
        if (typeof escapeByCharWith === "undefined") escapeByCharWith = '';
        if (escapeByCharWith != '') {
            var re = new RegExp(byChar.regExpEscape(byChar), "gmi");
            return byChar + this.replace(re, escapeByCharWith + byChar) + byChar;
        }
        return byChar + this + byChar;
    }
}
String.prototype.toHtml = function()
{
    return this.replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

}
String.prototype.toCsv = function(quoteChar,escapeChar) {
    if (typeof quoteChar === "undefined") quoteChar = '"';
    if (typeof escapeChar === "undefined") escapeChar = quoteChar;
    return this.enclose(quoteChar,escapeChar);
};
if (typeof String.prototype.isNumeric !== 'function') {
    String.prototype.isNumeric = function () {
        return this == String(parseFloat(this));
    }
}
//convert string to number
String.prototype.toNumber = function () {
    var str = this.replace(/[^\d.\-\+]/g, "");
    if (str.length > 0 && !isNaN(str))
        str = (str * 1);
    return str;
}
String.prototype.toInteger = function() {
    return parseInt(this.toNumber().toString(), 10);
};

//convert string to number, run toFixed, and return to string
String.prototype.toFixed = function (dec) {
    var str = this.toNumber().toString();
    if (str.length > 0 && !isNaN(str))
        str = (str * 1).toFixed(dec);
    return String(str);
}
//convert string to dollar string with formatting
String.prototype.toDollar = function (dec, dollarsymbol) {
    var str = this.toNumber().toString();
    if (typeof dec === 'undefined') dec = 2;
    if (typeof dollarsymbol === 'undefined') dollarsymbol = '$';
    if (str.length > 0 && !isNaN(str)) {
        var x, x1, x2, re;
        x = ((1 * str).toFixed(dec)).split('.');
        x1 = x[0];
        if (x.length > 1) x2 = '.' + x[1];
        else x2 = "";
        var re = /(\d+)(\d{3})/;
        while (re.test(x1)) x1 = x1.replace(re, '$1' + ',' + '$2');
        str = dollarsymbol + x1 + x2;
    }
    return String(str);
}
String.prototype.toJson = function()
{
    return this.replace(/\t/g,"\\t")    // tab
               .replace(/\\/g, "\\\\")  //  backslash
               .replace(/\"/g, "\\\"")  // double quote
               .replace(/\n/g, "\\n")   // linefeed
               .replace(/\r/g, "\\r");  // carriage return

}
String.prototype.toSql = function()
{
    return this.replace(/'/g,"''")    // escape single quote to 2 single quotes

}

String.prototype.regExpEscape = function(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

RegExp.prototype.escape = function(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};
function selectDivText(element) {
    var doc = document;
    var text = doc.getElementById(element);    
    if (doc.body.createTextRange) {
        var range = document.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    } else if (window.getSelection) {
        var selection = window.getSelection();
        if (selection.selectAllChildren) {
            selection.selectAllChildren(text);
        } else {
            var range = document.createRange();
            range.selectNodeContents(text);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}
// cookie stuff
function createCookie(name,value,days) {
	if (days) {
		var date = new Date();
		date.setTime(date.getTime()+(days*24*60*60*1000));
		var expires = "; expires="+date.toGMTString();
	}
	else var expires = "";
	document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

function eraseCookie(name) {
	createCookie(name,"",-1);
}

