<div class="middle">
	<h1>Use this tool to output JSON data from CSV</h1>
    <p>You have the option of making your attribute names
        upper and lower case. You can limit the number of records processed also.
        Future versions of this tool will allow you to select the fields to output and limit the rows selected.
    </p>


<form>
   <br><b>Choose CSV file here</b> <input type="file" id="f1" onchange="loadTextFile(this,assignText)" title="Choose a local CSV file">
   <b>or paste into Text Box below</b><br>
   <label><input type="checkbox" name="chkHeader" id="chkHeader" value="Y" onclick="parseAndOptions(CSV)" checked=""> First row is column names- Make: </label>
<label><input type="checkbox" id="chkHeaderUpper" onclick="if(this.checked)document.getElementById(&#39;chkHeaderLower&#39;).checked=false;parseAndOptions(CSV);"> Upper</label>
<label><input type="checkbox" id="chkHeaderLower" onclick="if(this.checked)document.getElementById(&#39;chkHeaderUpper&#39;).checked=false;parseAndOptions(CSV);"> Lower</label>
   &nbsp;&nbsp;
    Limit # of lines: <input type="text" id="txtRowLimit" size="5" maxlength="5" onblur="CSV.limit=this.value;parseAndOptions(CSV)" title="Specify how many records to convert">
   <br>Field Separator: 
   <label><input type="radio" name="sep" id="sepAuto" value="" onclick="CSV.autodetect=true;parseAndOptions(CSV)" checked=""> Auto Detect</label>
   <label><input type="radio" name="sep" id="sepComma" value="," onclick="CSV.autodetect=false;CSV.delimiter = &#39;,&#39;; parseAndOptions(CSV)"> Comma-,</label>
   <label><input type="radio" name="sep" id="sepSemicolon" value=";" onclick="CSV.autodetect=false;CSV.delimiter = &#39;;&#39;; parseAndOptions(CSV)"> Semi-colon-;</label>
   <label><input type="radio" name="sep" id="sepPipe" value="|" onclick="CSV.autodetect=false;CSV.delimiter = &#39;|&#39;; parseAndOptions(CSV)"> Bar-|</label>
   <label><input type="radio" name="sep" id="sepTab" value=" " onclick="CSV.autodetect=false;CSV.delimiter = &#39;\t&#39;; parseAndOptions(CSV)"> Tab</label>
   &nbsp;<input type="button" value="Clear Input" onclick="clearAll()"><br>
  <textarea class="xxxxlined" rows="10" cols="100" id="txt1" onchange="parseAndOptions(CSV)" wrap="off">id,name,amount,Remark
1,"Johnson, Smith, and Jones Co.",345.33,Pays on time
2,"Sam ""Mad Dog"" Smith",993.44,
3,"Barney &amp; Company",0,"Great to work with
and always pays with cash."
4,Johnson Automotive,2344,
</textarea>
    <br>

<input type="button" id="btnRun" value="Convert CSV To JSON" title="Convert CSV To JSON" onclick="document.getElementById(&#39;txta&#39;).value = csvToJSON(CSV)">
<input type="button" id="btnRun2" value="Convert CSV To JSON Array" title="Convert CSV To JSON Array" onclick="document.getElementById(&#39;txta&#39;).value = csvToJSONArray(CSV)">
<input type="button" id="btnRun3" value="Convert CSV To JSON Column Array" title="Convert CSV To JSON Column Array" onclick="document.getElementById(&#39;txta&#39;).value = csvToJSONColumnArray(CSV)">

   </form>
   
</div>
<textarea id="txta" rows="15" cols="100" wrap="off"></textarea>

</div>