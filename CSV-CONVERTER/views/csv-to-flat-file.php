<div class="middle">
	<h1>What is a flat file?</h1>
    <p>A flat (or fixed width) file  is a plain text file where each field value is the same width and padded with spaces. 
        It is much easier to read than CSV files but takes up more space than CSV. We examine the CSV value and remember the
        longest width for each field. We then output each field padded to the longest width. 
        We add one additional space (optionally another character) before each field.
        <br/>We also will convert a CSV or Excel data to an ASCII Table by checking "ASCII Table-ize It".
       
   </p>

<form>
  <br/><b>Choose CSV file here</b> 
    <input type="file" id="f1" onchange="loadTextFile(this,assignText)" title="Choose a local CSV file" />
   <b>or paste into Text Box below</b><br/>
   <label><input type="checkbox" name="chkHeader" id="chkHeader" value="Y" onclick="parseAndOptions(CSV)" checked /> First row is column names&nbsp;&nbsp; </label>
   &nbsp;&nbsp;
    Limit # of lines: <input type="text" id="txtRowLimit" size="5" maxlength="5" onblur="CSV.limit=this.value;parseAndOptions(CSV)" title="Specify how many records to convert">
   <br/>Field Separator: 
   <label><input type="radio" name="sep" id="sepAuto" value="" onclick="CSV.autodetect=true;parseAndOptions(CSV)" checked> Auto Detect</label>
   <label><input type="radio" name="sep" id="sepComma" value="," onclick="CSV.autodetect=false;CSV.delimiter = ','; parseAndOptions(CSV)" > Comma-,</label>
   <label><input type="radio" name="sep" id="sepSemicolon" value=";" onclick="CSV.autodetect=false;CSV.delimiter = ';'; parseAndOptions(CSV)"> Semi-colon-;</label>
   <label><input type="radio" name="sep" id="sepPipe" value="|" onclick="CSV.autodetect=false;CSV.delimiter = '|'; parseAndOptions(CSV)"> Bar-|</label>
   <label><input type="radio" name="sep" id="sepTab" value=" " onclick="CSV.autodetect=false;CSV.delimiter = '\t'; parseAndOptions(CSV)"> Tab</label>
   &nbsp;<input type="button" value="Clear Input" onclick="clearAll()"> <br/>
  <textarea class="xxxxlined" rows="10" cols="100" id="txt1" onchange="parseAndOptions(CSV)" wrap="off">id,name,amount,Remark
1,"Johnson, Smith, and Jones Co.",345.33,Pays on time
2,"Sam ""Mad Dog"" Smith",993.44,
3,"Barney & Company",0,"Great to work with
and always pays with cash."
4,Johnson Automotive,2344,
</textarea>
    <br/>

   <input type="button" id="btnRun" value="Convert CSV To Flat File" title="Convert CSV To Flat File" 
    onclick="document.getElementById('txta').value = csvToFixed(CSV,document.getElementById('txtSep').value,document.getElementById('chkTableize').checked,document.getElementById('chkLineNumbers').checked)" >
<label> Field Separator (default space) 
    <input type="text" id="txtSep" value=" " size="1" maxlength="1" onfocus="this.select()" title="Choose separater character (default space)"/></label>
    <label><input type="checkbox" value="Y" id="chkLineNumbers"> Add Line Numbers</label>
    <label><input type="checkbox" id="chkTableize" value="Y"/> ASCII Table-ize it</label>
    <div id="divFlatOptions"></div>
</form>
   
</div>
<textarea id="txta" rows="15" cols="100" wrap="off"></textarea>
</div>
