
<html>
<head>
<!-- Copyright 2013 ConvertCsv.com -->
    <meta name="description" content="Reformat CSV via Template Engine"/>
<title>CSV Template Engine</title>
<script src="js/jquery.min.js"></script>
<script src="js/jquery-linedtextarea.js"></script>
<link href="js/jquery-linedtextarea.css" type="text/css" rel="stylesheet" />
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
    function runit() {
        if (!document.getElementById('chkHtml').checked) {
            document.getElementById('diva').innerHTML = '<pre>' + htmlEscape(csvFromTem(CSV, document.getElementById('txtHeader').value, document.getElementById('txtTemplate').value, document.getElementById('txtFooter').value)) + '</pre>';
        }
        else {
            document.getElementById('diva').innerHTML = csvFromTem(CSV, document.getElementById('txtHeader').value, document.getElementById('txtTemplate').value, document.getElementById('txtFooter').value);

        }
    }
    function genTemplate() {
        var ttype = document.getElementById('selType').value;
        var s = "";
        switch (ttype) {
            case 'HTML':
                s = '<table><tr>';
                for (j = 1; j <= CSV.arHeaderRow.length; j++) {
                    s += '<th>{{h' + j + '.toHtml()}}</th>';
                }
                s += '</tr>{{br}}';
                document.getElementById('txtHeader').value = s;
                s = '<tr>';
                for (j = 1; j <= CSV.arHeaderRow.length; j++) {
                    s += '<td>{{f' + j + '.toHtml()}}</td>';
                }
                s += '</tr>{{br}}';
                document.getElementById('txtTemplate').value = s;
                document.getElementById('txtFooter').value = '</table>';
                document.getElementById("chkHtml").checked = true;
                document.getElementById('btnRun').click();
                break;
            case 'HTML#':
                s = '<table><tr><th>#</th>';
                for (j = 1; j <= CSV.arHeaderRow.length; j++) {
                    s += '<th>{{h' + j + '.toHtml()}}</th>';
                }
                s += '</tr>{{br}}';
                document.getElementById('txtHeader').value = s;
                s = '<tr><td>{{rn}}</td>';
                for (j = 1; j <= CSV.arHeaderRow.length; j++) {
                    s += '<td>{{f' + j + '.toHtml()}}</td>';
                }
                s += '</tr>{{br}}';
                document.getElementById('txtTemplate').value = s;
                document.getElementById('txtFooter').value = '</table>';
                document.getElementById("chkHtml").checked = true;
                document.getElementById('btnRun').click();
                break;
            case 'XML':
                s = '<?xml version="1.0"?>{{br}}<rowset>{{br}}';
                document.getElementById('txtHeader').value = s;
                s = '<row>{{br}}';
                for (j = 1; j <= CSV.arHeaderRow.length; j++) {
                    s += '<{{h' + j  + '}}>{{f' + j + '.toHtml()}}</{{h' + j + '}}>{{br}}';
                }
                s += '</row>{{br}}';
                document.getElementById('txtTemplate').value = s;
                document.getElementById('txtFooter').value = '</rowset>';
                document.getElementById("chkHtml").checked = false;
                document.getElementById('btnRun').click();
                break;
            case 'JSON': // array of structures
                s = 'var myvar = [{{br}}';
                document.getElementById('txtHeader').value = s;
                s = '{{lb}}{{br}}';
                for (j = 1; j <= CSV.arHeaderRow.length; j++) {
                    s += '"{{h' + j  + '}}":"{{f' + j + '.toJson()}}"{{br}}';
                    if (j != CSV.arHeaderRow.length) s += ",";
                }
                s += '{{rb}}{{if(rn<nr)","}}{{br}}';
                document.getElementById('txtTemplate').value = s;
                document.getElementById('txtFooter').value = '];';
                document.getElementById("chkHtml").checked = false;
                document.getElementById('btnRun').click();
                break;
            case 'OPTION':
                s = 'Choose: <select>{{br}}';
                document.getElementById('txtHeader').value = s;
                s = '<option value="{{f1.toHtml()}}">{{f2.toHtml()}}</option>{{br}}';
                document.getElementById('txtTemplate').value = s;
                document.getElementById('txtFooter').value = '</select>';
                document.getElementById("chkHtml").checked = false;
                document.getElementById('btnRun').click();
                break;
            case 'CSV':
                s = '';
                for (j = 1; j <= CSV.arHeaderRow.length; j++) {
                    s += '{{h' + j + '.toCsv()}}';
                    if (j != CSV.arHeaderRow.length) s += ";";
                }
                s += "{{br}}";
                document.getElementById('txtHeader').value = s;
                s = '';
                for (j = 1; j <= CSV.arHeaderRow.length; j++) {
                    s += '{{f' + j + '.toCsv()}}';
                    if (j != CSV.arHeaderRow.length) s += ";";
                }
                s += "{{br}}";
                document.getElementById('txtTemplate').value = s;
                document.getElementById('txtFooter').value = '';
                document.getElementById("chkHtml").checked = false;
                document.getElementById('btnRun').click();
                break;
        }
    }
</script>
<style>
 table { border-collapse:collapse; }
 table,th, td { border: 1px solid black; }
</style>
</head> 
<body  onload="document.getElementById('btnRun').click()">

<div class="heading">
<h1>Convert CSV To Anything using Template Engine</h1>
</div>
<div class="container">
<div class="left">
    <b>CSV Conversions</b><br/>
 
        <a href="csv-to-html.htm">CSV To HTML Table</a><br/>
        <a href="csv-to-xml.htm">CSV To XML</a><br/>
        <a href="csv-to-json.htm">CSV To JSON</a><br/>
        <a href="csv-to-multiline-data.htm">CSV To Multi-line Data</a><br/>
        <a href="csv-to-sql.htm">CSV To SQL</a><br/>
        <a href="csv-to-flat-file.htm">CSV To Flat File</a><br/>
        <a href="csv-to-kml.htm">CSV To KML</a><br/>
    <a href="csv-to-template-output.htm">CSV Template Engine</a><br/>
        <a href="csv-to-csv.htm">CSV To CSV</a><br/>
        <a href="/">CSV Home</a><br/>
<br>
<br>

</div>
<div class="right">
<!-- advertising goes here -->
    <br>
<br>
<br>

</div>
<div class="middle">
    <p>This tool allows the reforming of CSV based on a scripting language you use to control the output.
    See the Template Writer below for examples that work on your current data.</p>

<script type="text/javascript"><!--
google_ad_client = "ca-pub-2674404638298268";
/* WideAcross */
google_ad_slot = "4850643811";
google_ad_width = 728;
google_ad_height = 90;
//-->
</script>
<script type="text/javascript"
src="http://pagead2.googlesyndication.com/pagead/show_ads.js">
</script>
    <br/>
<form>
 <br/><b>Choose CSV file here</b>
    <input type="file" id="f1" onchange="loadTextFile(this,assignText)" title="Choose a local CSV file" />
   <b>or paste into Text Box below</b><br/>
   <label><input type="checkbox" name="chkHeader" id="chkHeader" value="Y" onclick="parseAndOptions(CSV)" checked /> First row is column names- Make: </label>
<label><input type="checkbox" id="chkHeaderUpper" onclick="if(this.checked)document.getElementById('chkHeaderLower').checked=false;parseAndOptions(CSV);"> Upper</label>
<label><input type="checkbox" id="chkHeaderLower" onclick="if(this.checked)document.getElementById('chkHeaderUpper').checked=false;parseAndOptions(CSV);"> Lower</label>
   &nbsp;&nbsp;
    Limit # of lines: <input type="text" id="txtRowLimit" size="5" maxlength="5" onblur="CSV.limit=this.value;parseAndOptions(CSV)" title="Specify how many records to convert">
   <br/>Field Separator: 
   <label><input type="radio" name="sep" id="sepAuto" value="" onclick="CSV.autodetect=true;parseAndOptions(CSV)" checked> Auto Detect</label>
   <label><input type="radio" name="sep" id="sepComma" value="," onclick="CSV.autodetect=false;CSV.delimiter = ','; parseAndOptions(CSV)" > Comma-,</label>
   <label><input type="radio" name="sep" id="sepSemicolon" value=";" onclick="CSV.autodetect=false;CSV.delimiter = ';'; parseAndOptions(CSV)"> Semi-colon-;</label>
   <label><input type="radio" name="sep" id="sepPipe" value="|" onclick="CSV.autodetect=false;CSV.delimiter = '|'; parseAndOptions(CSV)"> Bar-|</label>
   <label><input type="radio" name="sep" id="sepTab" value=" " onclick="CSV.autodetect=false;CSV.delimiter = '\t'; parseAndOptions(CSV)"> Tab</label>
   &nbsp;<input type="button" value="Clear Input" onclick="clearAll()"><br/>
  <textarea class="xxxxlined" rows="10" cols="80" id="txt1" onchange="parseAndOptions(CSV)">id,name,amount,Remark
1,"Johnson, Smith, and Jones Co.",345.33,Pays on time
2,"Sam ""Mad Dog"" Smith",993.44,
3,"Barney & Company",0,"Great to work with
and always pays with cash."
4,Johnson Automotive,2344,
</textarea>

   <br/><br/>
    <table><tr><th colspan="2">Template Engine Help</th></tr>
        <tr><th>Value</th><th>Description</th></tr>
        <tr><td>{{br}}</td><td>Line break</td></tr>
        <tr><td>{{lb}}</td><td>Left bracket {</td></tr>
        <tr><td>{{rb}}</td><td>Right bracket }</td></tr>
        <tr><td>{{h1}} {{h2}} {{h3}} ....</td><td>Heading for field 1,2,3 ...</td></tr>
        <tr><td>{{nh}} </td><td>Number of fields in heading row</td></tr>
        <tr><td>{{f1}} {{f2}} {{f3}} ....</td><td>Field value 1,2,3 ...</td></tr>
        <tr><td>{{nf}} </td><td>Number of fields in current row</td></tr>
        <tr><td>{{nr}} </td><td>Number of data rows in CSV</td></tr>
        <tr><td>{{rn}} </td><td>Current data row number</td></tr>
        <tr><td>{{f1.function()}}</td><td>Where function is a valid Javascript string method or built-in function. Examples below.</td></tr>
        <tr><td>{{f1.toUpperCase()}}</td><td>Field value to uppercase letters</td></tr>
        <tr><td>{{f1.toLowerCase()}}</td><td>Field value to lowercase letters</td></tr>
        <tr><td>{{f1.toCsv()}}</td><td>convert field to a CSV field by enclosing in double-quotes.</td></tr>
        <tr><td>{{f1.toDollar()}}</td><td>Format field value as dollar amount</td></tr>
        <tr><td>{{f1.toFixed(n)}}</td><td>Field value to numeric value with n decimal places</td></tr>
        <tr><td>{{f1.toInteger()}}</td><td>Field value to integer value</td></tr>
        <tr><td>{{f1.toNumber()}}</td><td>Field value to numeric value</td></tr>
        <tr><td>{{f1.rpad(n)}}</td><td>Right pad field value with spaces until n characters long</td></tr>
        <tr><td>{{f1.lpad(n)}}</td><td>Left pad field value with spaces until n characters long</td></tr>
        <tr><td>{{f1.ltrim()}}</td><td>Trim spaces from left side of field</td></tr>
        <tr><td>{{f1.rtrim()}}</td><td>Trim spaces from right side of field</td></tr>
        <tr><td>{{f1.rjust(n)}}</td><td>Right justify text to size n. i.e. {{f1.rjust(20)}}</td></tr>
        <tr><td>{{f1.ljust(n)}}</td><td>Trim and Left justify text to size n. i.e. {{f1.ljust(20)}}</td></tr>
        <tr><td>{{f1.rjust(n)}}</td><td>Trim and Right justify text to size n. i.e. {{f1.rjust(20)}}</td></tr>
        <tr><td>{{f1.cjust(n)}}</td><td>Trim and Center justify text to size n. i.e. {{f1.cjust(20)}}</td></tr>
        <tr><td>{{f1.left(n)}}</td><td>Return n characters from left side of field</td></tr>
        <tr><td>{{f1.right(n)}}</td><td>Return n characters from right side of field</td></tr>
        <tr><td>{{f1.trim()}}</td><td>Trim spaces from both sides of field</td></tr>
        <tr><td>{{f1.toHtml()}}</td><td>Make field suitable for viewing as HTML</td></tr>
        <tr><td>{{f1.toJson()}}</td><td>Make field suitable for JSON value</td></tr>
        <tr><td>{{f1.toSql()}}</td><td>Make field suitable for SQL string value</td></tr>
    </table>
    <br/><label for="selType">Template Writer</label>
       <select id="selType" onchange="genTemplate()" title="Choose a template and we will write it!">
            <option value="">--Choose Example--</option>
            <option value="HTML">HTML Table</option>
            <option value="HTML#">HTML Table with Line Numbers</option>
            <option value="CSV">CSV with semi-colons</option>
            <option value="OPTION">HTML SELECT tag for first 2 fields</option>
            <option value="XML">XML</option>
           <option value="JSON">JSON</option>
         </select>
   <br/><br/><label>Heading Template - text at beginning of output<br/>
    <input type="text" id="txtHeader" size="90" value="{{h1}};{{h3}};{{h2}}{{br}}"></label>
   <br/><br/><label>Each Record Template - text for each line in CSV<br/>
    <input type="text" id="txtTemplate" value="{{f1}};{{f3.toDollar()}};{{f2.toUpperCase().toCsv()}}{{br}}" size="90"></label>
   <br/><br/><label>Footer Template - text at end of output<br/>
    <input type="text" id="txtFooter" size="90" value="#----------------------------------{{br}}# of Records: {{nr}}"></label>
   <br/><br/>
   <input type="button" id="btnRun" value="Convert CSV Using Template" title="Reformat CSV Using Template Language" 
         onclick="runit()" >
     <label><input type="checkbox" id="chkHtml" value="Y" /> Render as HTML</label>
   </form>
   <hr/>
    </div>
   <div id="diva" ></div>

</div>
<div class="footer">
  <hr class="fatline"/>
<img src="images/ddgfloridabinary.png" alt="Logo" width="100%"/>
<b>Copyright &copy; 2013 Data Design Group, Inc.  All Rights Reserved</b>
</div>


<script>
$(function() {
	$(".lined").linedtextarea(
	);
});
parseAndOptions(CSV);
</script>
</body>
</html>
