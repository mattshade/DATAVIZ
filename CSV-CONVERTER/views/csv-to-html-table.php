<div class="middle">
	<h1>Use this tool to reformat CSV data into a HTML table</h1>
    <p>A HTML table makes it extremely easy to visualize your CSV.
       Unlike other sites, here you can see not only the HTML code, but the table itself. 
        Future versions will allow your to re-arrange fields and limit the data output.
   </p>

<form>
    <br/><b>Choose CSV file here</b> <input type="file" id="f1" onchange="loadTextFile(this,assignText)" title="Choose a local CSV file" />
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
  <textarea class="xxxxlined" rows="10" cols="100" id="txt1" onchange="parseAndOptions(CSV)" wrap="off">id,name,amount,Remark
1,"Johnson, Smith, and Jones Co.",345.33,Pays on time
2,"Sam ""Mad Dog"" Smith",993.44,
3,"Barney & Company",0,"Great to work with
and always pays with cash."
4,Johnson Automotive,2344,</textarea>
    <br/>

   <input type="button" id="btnRun" value="Convert CSV To HTML Table" title="Convert CSV To HTML Table (HTML and View Table)"  
     onclick ="document.getElementById('diva').innerHTML = csvToTable(CSV,document.getElementById('chkLineNumbers').checked);document.getElementById('txta').value = csvToTable(CSV,document.getElementById('chkLineNumbers').checked)" >

   <label><input type="checkbox" value="Y" id="chkLineNumbers"> Add Line Numbers</label>
    &nbsp; &nbsp; <small>See results below</small>
   </form>
  
</div>
<textarea id="txta" rows="15" cols="100" wrap="off"></textarea>
<div id="diva"></div>
</div>
