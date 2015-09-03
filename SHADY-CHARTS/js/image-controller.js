// BOOTSTRAP STUFF
$("select").selectpicker({style: 'mbl btn-primary ', menuStyle: 'dropdown-inverse'});

var oCanvas;
var canvas;

// AFTER CHART LOADS FIRE READY EVENT
function myReadyHandler(){	
	addSource();
	addTitle();
	addSubTitle();
	addNotes();
	$('svg').attr('id', 'thesvg');
	addTempLogo();
	// $("text:contains(" + options.title + ")").attr({'x':'10', 'y':'30','width':'600', 'font-weight':'normal'});
	$('#make-png').hide();
}

// FORM DRIVEN EVENTS

// SET CHART TYPE
// chart = new google.visualization.BarChart(document.getElementById('chart_div'));

$("#chart_type").on('change', function(){
	// alert($(this).val());
	chartType = $(this).val();
	chartTypeString = "new google.visualization."+chartType+"(document.getElementById('chart_div'));";
  // chart = chartTypeString;
chart = eval(chartTypeString);

if($(this).find('option:selected').text() == "Donut Chart"){
	options.pieHole = 0.4;
}else if($(this).find('option:selected').text() == "Pie Chart"){
	options.pieHole = 0;
}
$('#log').text(options.series);
chart.draw(data, options);
drawChart();
});

// END SET CHART TYPE

var chartHeight;
$('#chart-height').on('blur', function(){
	chartHeight = $(this).val();
	options.height = chartHeight;
   	drawChart();
});

$('#chart-key').on('blur', function(){
	key = $(this).val();
	// alert(key);
	if(key == ""){
		alert('key is blank');
		key = "0AgAtV671nd7CdE5od0I4Z0JUVmYxWENDWHliUmhqUlE";
	}
	dataSourceUrl = dataSource + "&range=" + range + "&key=" + key;
	chart.draw(data, options);
	drawChart();
});

var chartTitle ="  ";
$('#chart-title').on('blur', function(){
	chartTitle = $(this).val();
	// alert(options.title);
	$('#thetitle').text(chartTitle);
	// options.title = chartTitle;
   	// drawChart();
    // $("text:contains(" + options.title + ")").attr({'x':'10', 'y':'30','width':'600', 'font-weight':'normal'});
  });

var chartSubTitle ="  ";
var chart_subtitle_font_size = 14;
$('#chart-sub-title').on('blur', function(){
	chartSubTitle = $(this).val();
	$('#thesubtitle').text(chartSubTitle);
  });

var chart_title_font_size = 18;
$('#chart-title-font-size').on('blur', function(){
	chart_title_font_size = $(this).val();
	$('#thetitle').attr('font-size', chart_title_font_size);
});
var chartFontSize="  ";
$('#chart-font-size').on('blur', function(){
	chartFontSize = $(this).val();
	options.fontSize = chartFontSize;
	drawChart();

  });

var chartSource="  ";
$('#chart-source').on('blur', function(){
	chartSource = $(this).val();
	$('#thesource').text(chartSource);

  });
var chartNotes="  ";
$('#chart-notes').on('blur', function(){
	chartNotes = $(this).val();
	$('#thenotes').text(chartNotes);

  });



// END FORM DRIVEN EVENTS

// CONVERT SVG TO CANVAS SO WE CAN DOWNLOAD AN IMAGE
$('#make-canvas').on('click', function(){
	canvg();
	$('#make-png').fadeIn();
	$('canvas').attr('id', 'thecanvas');
	addLogo();					
});

// DOWNLOAD PNG
$('#make-png').on('click', function(){	
	oCanvas = document.getElementById("thecanvas");
	Canvas2Image.saveAsPNG(oCanvas);		
});
	
// ADD SOURCE
function addSource(){
	$('svg').attr('id', 'thesvg');
	var source_bottom_position = $('#thesvg').height() - 10;
	var source_left_position = 10;
	var newText = document.createElementNS("http://www.w3.org/2000/svg","text");
	newText.setAttributeNS(null,"x",source_left_position);     
	newText.setAttributeNS(null,"y",source_bottom_position); 
	newText.setAttributeNS(null,"font-family","Gotham Narrow SSm 4r");
	newText.setAttributeNS(null,"font-size","11");
	newText.setAttributeNS(null,"fill","#a3a3a3");
	newText.setAttributeNS(null,"id","thesource");
	var textNode = document.createTextNode(chartSource);
	newText.appendChild(textNode);
	document.getElementById("thesvg").appendChild(newText);
}
// END ADD SOURCE
function addTitle(){	
	var title_top_position = 30;
	var title_left_position = 10;
	var newTitleText = document.createElementNS("http://www.w3.org/2000/svg","text");
	newTitleText.setAttributeNS(null,"x",title_left_position);     
	newTitleText.setAttributeNS(null,"y",title_top_position); 
	newTitleText.setAttributeNS(null,"font-family","Gotham Narrow SSm 4r");
	newTitleText.setAttributeNS(null,"font-size",chart_title_font_size);
	newTitleText.setAttributeNS(null,"fill","#333");
	newTitleText.setAttributeNS(null,"id","thetitle");
	var textNode = document.createTextNode(chartTitle);
	newTitleText.appendChild(textNode);
	document.getElementById("thesvg").appendChild(newTitleText);
}

function addSubTitle(){	
	var subTitle_top_position = 50;
	var subTitle_left_position = 10;
	var subTitleText = document.createElementNS("http://www.w3.org/2000/svg","text");
	subTitleText.setAttributeNS(null,"x",subTitle_left_position);     
	subTitleText.setAttributeNS(null,"y",subTitle_top_position); 
	subTitleText.setAttributeNS(null,"font-family","Gotham Narrow SSm 4r");
	subTitleText.setAttributeNS(null,"font-size",chart_subtitle_font_size);
	subTitleText.setAttributeNS(null,"fill","#333");
	subTitleText.setAttributeNS(null,"id","thesubtitle");
	var subTitletextNode = document.createTextNode(chartSubTitle);
	subTitleText.appendChild(subTitletextNode);
	document.getElementById("thesvg").appendChild(subTitleText);
}

function addNotes(){	
	var notes_top_position = $('#thesvg').height() - 30;
	var notes_left_position = 10;
	var notesText = document.createElementNS("http://www.w3.org/2000/svg","text");
	notesText.setAttributeNS(null,"x",notes_left_position);     
	notesText.setAttributeNS(null,"y",notes_top_position); 
	notesText.setAttributeNS(null,"font-family","Gotham Narrow SSm 4r");
	notesText.setAttributeNS(null,"font-size",'11');
	notesText.setAttributeNS(null,"fill","#a3a3a3");
	notesText.setAttributeNS(null,"id","thenotes");
	var notesTextNode = document.createTextNode(chartNotes);
	notesText.appendChild(notesTextNode);
	document.getElementById("thesvg").appendChild(notesText);
}

// ADD LOGO
$('#add-logo').on('click', function(){
addLogo();
});
// add temporary for svg
function addTempLogo(){	
	var logo_bottom_position = $('#chart_div').height() - 25;
	var logo_right_position = $('svg').width() - 110;
	var svgimg = document.createElementNS('http://www.w3.org/2000/svg','image');
	svgimg.setAttributeNS(null,'height','15');
	svgimg.setAttributeNS(null,'width','99');
	svgimg.setAttributeNS('http://www.w3.org/1999/xlink','href', 'img/cnbc-logo-charts.png');
	svgimg.setAttributeNS(null,'x',logo_right_position);
	svgimg.setAttributeNS(null,'y',logo_bottom_position);
	svgimg.setAttributeNS(null, 'visibility', 'visible');
	$('#thesvg').append(svgimg);
}

function addLogo(){
	canvas = document.getElementById('thecanvas'),
	context = canvas.getContext('2d');
	make_base();
}

function make_base(){
	var logo_bottom_position = $('canvas').height() - 25;
	var logo_right_position = $('canvas').width() - 110;
	base_image = new Image();
	base_image.src = 'img/cnbc-logo-charts.png';
	base_image.onload = function(){
    context.drawImage(base_image, logo_right_position, logo_bottom_position);
  }
}
// END ADD LOGO


//================================ ADVANCED OPTIONS ======================================

$('#advanced-switch input[type="checkbox"]').on('change', function() {
	$('#advanced-options').slideToggle('fast'); 
	});
	
// 	SHOW/HIDE LEGEND
$('#hide_legend').on('change', function() {
if($(this).attr('checked') == "checked"){
		options.legend.position = 'none';
		chart.draw(data, options);
		drawChart();
	}else{
		options.legend.position = 'bottom';
		chart.draw(data, options);
		drawChart();
	}		 
});
// END SHOW/HIDE LEGEND


// SERIES
var chartSeries=" ";
$('#chart-series').on('blur', function(){	
	chartSeries = $(this).val();
	// var jsonObj = chartSeries;
	// var obj = $.parseJSON(jsonObj);
	// newChartSeries = parseJSON(chartSeries);
	$('#log').text(chartSeries);
	dataSourceUrl = dataSource + "&range=" + range + "&key=" + key;	
	options.series = chartSeries;
	// alert(chartSeries);
	chart.draw(data, options);
	drawChart();

  });

//{0:{type: "line"}}
//{0:{targetAxisIndex:0, type: "line"},1:{targetAxisIndex:1}}
//{0:{targetAxisIndex:0},1:{targetAxisIndex:1, type: "line"}}
// var chartSeriesType="  ";
$('#chart-series-type').on('blur', function(){
	chartSeriesType = $(this).val();
	$('#log').text(chartSeriesType);	
	options.seriesType = chartSeriesType;
	chart.draw(data, options);
	// drawChart();

  });
//{0:{targetAxisIndex:0, type: "line"},1:{targetAxisIndex:1}}
//{3: {type: "line"}}
//0AkwgJlRgEsqUdFFYaGQ0WmtTcUdjX2NTYXYyenBBWmc


//series:{2:{targetAxisIndex:1}}, vAxes:{1:{title:'Losses',textStyle:{color: 'red'}}}
// END SERIES

//vAxes


$('#chart-vAxes').on('blur', function(){
	chartvAxes = $(this).val();	
	options.vAxes = chartvAxes;
	alert(options.vAxes);
	chart.draw(data, options);
	drawChart();
  });
//vAxes: {0: {logScale: false},1: {logScale: false, maxValue: 10}},
// END vAxes

// hAxis
$('#chart-haxis-options').on('blur', function(){
	hAxisValue = $(this).val();
	// $('#log').text(chartSeriesType);	
	options.hAxis = hAxisValue;
	// chart.draw(data, options);
	drawChart();
chart.draw(data, options);
  });
// END hAxis
//================================ END ADVANCED OPTIONS ======================================
// SAMPLE KEYS
$('#sample-keys .close').on('click', function(){
$('.table-wrapper').toggle();
$('#sample-keys-open').toggle();
});
$('#sample-keys-open').on('click', function(){
	$('.table-wrapper').toggle();
	$(this).toggle();
});