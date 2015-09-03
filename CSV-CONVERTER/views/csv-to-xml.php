<div class="middle">
	<h1>Use this tool to reformat CSV into XML format</h1>
    <p> You have the option of specifying the top-level root name and 
        the XML record name. You can also make each XML name upper or lower case.
    </p>


<form>
 <br/><b>Choose CSV file here</b>
     <input type="file" id="f1" onchange="loadTextFile(this,assignText)" title="Choose a local CSV file" />
   <b>or paste into Text Box below</b><br/>
   <label><input type="checkbox" name="chkHeader" id="chkHeader" value="Y" onclick="parseAndOptions(CSV)" checked /> First row is column names- Make: </label>
<label><input type="checkbox" id="chkHeaderUpper" onclick="namesUpper(this.checked)"> Upper</label>
<label><input type="checkbox" id="chkHeaderLower" onclick="namesLower(this.checked)"> Lower</label>
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
4,Johnson Automotive,2344,
</textarea>
    <br/>
   <input type="button" id="btnRun" value="Convert CSV To XML" title="Convert CSV To XML" onclick="document.getElementById('txta').value = csvToXml(CSV,document.getElementById('txtTopName').value,document.getElementById('txtRowName').value)" >
   <input type="button" id="btnRun2" value="Convert CSV To XML Properties" title="Convert CSV To XML Properties" onclick="document.getElementById('txta').value = csvToXmlProperties(CSV,document.getElementById('txtTopName').value,document.getElementById('txtRowName').value)" >
   <br/><label> Top-level Root Name <input type="text" id="txtTopName" value="ROWSET" size="15" maxlength="80"></label>
   <label> Each Record XML Name <input type="text" id="txtRowName" value="ROW" size="15" maxlength="80"></label>
   </form>
   
    </div>
  <textarea id="txta" rows="15" cols="100" wrap="off"></textarea>
</div>