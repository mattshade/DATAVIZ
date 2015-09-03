<script type="text/javascript">
    function assignText(s) {
        document.getElementById('txt1').value = s;
        parseAndOptions(CSV);
    }
    function genit() {
        document.getElementById('txta').value = csvToKml(CSV, document.getElementById('txtNameCol').value, document.getElementById('txtDescCol').value, document.getElementById('txtLatCol').value, document.getElementById('txtLongCol').value);
    }
</script>


<div class="middle">
	<h1>Use this tool to translate CSV into KML</h1>
    <p> You must have a description and latitude and longitude information in your data.
        Future versions of this tool will geocode an address field to supply the latitude and longitude.
         </p>

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
  <textarea class="xxxxlined" rows="10" cols="100" id="txt1" onchange="parseAndOptions(CSV)" wrap="off">National Park,$ Obligated,State,Latitude,Longitude
Abraham Lincoln Birthplace NHS,"$34,584",KY,37.61163334230,-85.64429400210
Acadia,"$102,631",ME,44.35938077530,-68.23973198080
Andersonville,"$65,133",GA,32.197905290823,-84.1302615685733
Andrew Johnson ,"$17,949",TN,36.1562449930463,-82.8370902853041
Antietam,"$54,743",MD,39.46238161400,-77.73598540160
Appomattox Court House,"$12,651",VA,37.38264480730,-78.80274304090
Assateague Island,"$51,921",MD,38.0556022623662,-75.2453836072023
Big Bend,"$535,983",TX,29.01035623890,-103.31111552100
Big South Fork National River and Recreation Area,"$3,009","TN, KY",36.38373752350,-84.67430698240
</textarea>
    <br/>
   <input type="button" id="btnRun" value="Convert CSV To KML" title="Convert CSV To KML" onclick="genit()" >
   <br/>
    For each line in the CSV, identify the field position (starting at 1) for this information:<br/>
    <label> Name Field # <input type="text" id="txtNameCol" value="1" size="3" maxlength="3" title="Field position (starting at 1) for Name"></label>
    &nbsp; <label> Description Field # <input type="text" id="txtDescCol" value="2" size="3" maxlength="3"></label>
    <br/><label> Latitude Field # <input type="text" id="txtLatCol" value="4" size="3" maxlength="3"></label>
     &nbsp; <label> Longitude Field # <input type="text" id="txtLongCol" value="5" size="3" maxlength="3"></label>
    <br>Save this file on your server and reference the URL in Google Maps to display each marker.
    <a href="http://maps.google.com?q=http://convertcsv.com/test.kml">This is an Example</a>
   </form>
   
    </div>
   <textarea id="txta" rows="15" cols="100" wrap="off"></textarea>
</div>
