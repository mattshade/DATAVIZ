$("#docs").on('click', function(){
	window.location = "http://leafletjs.com/reference.html";
});

var mapSource = "";
$("#source").on('blur', function(){
	mapSource = $(this).val();
	$("#map-source").text(mapSource)
});
var map_height = $("#height").val();
$("#height").on('blur', function(){
map_height = $("#height").val();
});
$("#add-height").on('click', function(){
	
	$("#map").css('height',map_height+"px");
	map.invalidateSize();
	updateEmbedCode();
	
});

var zoom = $("#zoom").val();
$("#zoom").on('blur', function(){
zoom = $("#zoom").val();
});

var latitude = $("#latitude").val();
$("#latitude").on('blur', function(){
latitude = $("#latitude").val();
});

var longitude = $("#longitude").val();
$("#longitude").on('blur', function(){
longitude = $("#longitude").val();
});

var setCenterCode = "L.map('map').setView([" + latitude + "," + longitude + "], " + zoom + ")";
$("#set-center").on('click', function(){
	// L.map('map').setView([latitude, longitude], 2);
	// L.marker([50.5, 30.5]).addTo(map);
	
	map.setView([latitude, longitude], zoom);
	setCenterCode = "L.map('map').setView([" + latitude + "," + longitude + "], " + zoom + ")";
	updateEmbedCode();
});


$("#embed").on('click', function(){
	updateEmbedCode();
});

function updateEmbedCode(){
	$("#code textarea").val("<style>"
+ "#map{width: 100%; height: " + map_height +"px;}"
+ "</style>"
+ "<link rel='stylesheet' href='http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/DATA-VISUALIZATION/SHADY-MAPS/css/leaflet.css' />"
+ "<div id='map'></div>"
+ $("#first-js").val()
+ "var map =" + setCenterCode +";"
+ $("#second-js").val()
+ markerCode
+ $("#third-js").val()
+"<div id='attribution' style='padding-top:15px;font-family:klavikar;'><div id='map-source' style='float:left;font-size:12px;color:#a3a3a3;font-weight:normal;'>"+mapSource +"</div><div id='cnbc-logo' style='text-align:right;'><img src='http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/DATA-VISUALIZATION/logos/cnbc-logo-charts.png'></div></div>");
	
}

var marker_number = 0;
$("#add-marker").on('click', function(){
	$("#form").append(marker_fragment);
	marker_number++;
	
});
var markerCode ="";
var setLat;
var setLong;
var popupMessage;
$(document).on('click', '.set-marker', function(){
	setLat  = $(this).parent().find('.latitude').val();
	setLong  = $(this).parent().find('.longitude').val();
	popupMessage = $(this).parent().find('.popup-text').val();
	
	L.marker([setLat, setLong]).addTo(map).bindPopup(popupMessage).openPopup();
	
	
	popupMessage.replace('"', '&quot;');
	popupMessage.replace("'", "&#39;");
	
	markerCode += 'L.marker([' + setLat + ',' + setLong + ']).addTo(map).bindPopup(' +"'"+ popupMessage +"'"+ ').openPopup()'+'\n';
	
	map.invalidateSize();
	
	$(this).parent().remove();
	
});
var marker_fragment ='<div id="mform'+marker_number+'"  class="form-inline marker-form" >'		
	+ '<input type="text" class="latitude form-control" value="0">'
	+ '<input type="text" class="longitude form-control" value="0">'
	+ '<br><textarea class="popup-text form-control" value=""></textarea>'
	+ '<br><button type="button" class="set-marker btn btn-info btn-md">'
    + '<span class="glyphicon glyphicon-plus"></span> add'
	+ '</button>'
	+ '</div>';	