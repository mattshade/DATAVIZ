function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');

        if (decodeURIComponent(pair[0]) == variable) {           
				return decodeURIComponent(pair[1]);
			}

    }
	return "";
    console.log('Query variable %s not found', variable);
}

var dataSource = "https://docs.google.com/spreadsheet/tq?";
// var winHeight = getQueryVariable('winHeight');
// var winWidth = getQueryVariable('winWidth');
// var key = getQueryVariable('key');
var range = "A:DD";
var headers = getQueryVariable('headers');

var sizes = ["small","medium","large","rail","mobile","massive"];

sizes["small"] = new Object();
sizes["medium"] = new Object();
sizes["large"] = new Object();
sizes["rail"] = new Object();
sizes["mobile"] = new Object();
sizes["massive"] = new Object();

sizes["small"].width = 260;
sizes["small"].height = 200;

sizes["medium"].width = 530;
sizes["medium"].height = 420;

sizes["large"].width = 940;
sizes["large"].height = 580;

sizes["rail"].width = 330;
sizes["rail"].height = 280;

sizes["mobile"].width = 320;
sizes["mobile"].height = 400;

sizes["massive"].width = 1400;
sizes["massive"].height = 1000;

// var winWidth = sizes[getQueryVariable('size')].width;
// var winHeight = sizes[getQueryVariable('size')].height;


var winWidth = 530;
var winHeight = 520;





