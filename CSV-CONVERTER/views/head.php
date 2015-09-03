<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Convert CSV to XML"/>
<title>CSV Conversions</title>
<link id="favicon" rel="shortcut icon" type="image/png" href="http://fm.cnbc.com/applications/cnbc.com/resources/styles/skin/INTERNAL/TOOLS/CSV-CONVERTER/favicon.ico" />
<script src="js/jquery.min.js"></script>
<script src="js/jquery-linedtextarea.js"></script>
<link href="css/jquery-linedtextarea.css" type="text/css" rel="stylesheet">
<script src="js/strsup.js"></script>
<script src="js/localread.js"></script>
<script src="js/csvparse.js"></script>
<script src="js/csvsup.js"></script>
<link href="css/layout3col.css" rel="stylesheet" type="text/css">



<script type="text/javascript">
    function assignText(s) {
        document.getElementById('txt1').value = s;
        parseAndOptions(CSV);
    }
    function namesUpper(checked) {
        if (checked) document.getElementById('chkHeaderLower').checked = false;
        parseAndOptions(CSV);
        document.getElementById('txtTopName').value = document.getElementById('txtTopName').value.toUpperCase();
        document.getElementById('txtRowName').value = document.getElementById('txtRowName').value.toUpperCase();
    }
    function namesLower(checked) {
        if (checked) document.getElementById('chkHeaderUpper').checked = false;
        parseAndOptions(CSV);
        document.getElementById('txtTopName').value = document.getElementById('txtTopName').value.toLowerCase();
        document.getElementById('txtRowName').value = document.getElementById('txtRowName').value.toLowerCase();
    }
</script>
<style>
 table { border-collapse:collapse; }
 table,th, td { border: 1px solid black; }
</style>
</head> 
<body>

<div class="container">
<div class="left">
<ul>
	<li><a href="csv-to-html-table.php">CSV To HTML Table</a></li>
    <li><a href="csv-to-xml.php">CSV To XML</a></li>
    <li><a href="csv-to-json.php">CSV To JSON</a></li>
    <li><a href="csv-to-multiline-data.php">CSV To Multi-line Data</a></li>
    <li><a href="csv-to-sql.php">CSV To SQL</a></li>
    <li><a href="csv-to-flat-file.php">CSV To Flat File</a></li>
    <li><a href="csv-to-kml.php">CSV To KML</a></li>
</ul>

</div>