<div class="middle">
	<h1>Use this tool to output SQL from CSV</h1>
    <p>Currently INSERT, UPDATE, and DELETE statements can be created. 
     The key used in UPDATE and DELETE is specified by setting the key column.
     You can specify which fields to include. 
     A field may be trimmed, made uppercase, or lowercase. You can add custom text around the field value by
     using the template feature. 
     For example, if you are using Oracle and want to convert a field in YYYYMMDD format to DATE, use TO_DATE('{f}','YYYYMMDD').
     The field value will be substituted for {f}.
     Future versions will allow DROP/CREATE TABLE. 
     It will also add database specific output and support ORACLE, MYSQL, and SQL SERVER. There are slight variations
     in the way different databases handle NULLs, empty strings, DATES, etc. .
    </p>
<h3>CSV To SQL Converter</h3>

<form>
<br><b>Load CSV file here</b>
     <input type="file" id="f1" onchange="loadTextFile(this,assignText)" />
<b>or paste into Text Box below</b><br/>
<label><input type="checkbox" name="chkHeader" id="chkHeader" value="Y" onclick="parseAndOptions(CSV)" checked /> First row is column names</label>
 &nbsp;
 Limit # of lines: <input type="text" id="txtRowLimit" size="5" maxlength="5" onblur="CSV.limit=this.value;parseAndOptions(CSV)">
<br/>Field Separator: 
   <label><input type="radio" name="sep" id="sepAuto" value="" onclick="CSV.autodetect=true;parseAndOptions(CSV)" checked> Auto Detect</label>
   <label><input type="radio" name="sep" id="sepComma" value="," onclick="CSV.autodetect=false;CSV.delimiter = ','; parseAndOptions(CSV)" > Comma-,</label>
   <label><input type="radio" name="sep" id="sepSemicolon" value=";" onclick="CSV.autodetect=false;CSV.delimiter = ';'; parseAndOptions(CSV)"> Semi-colon-;</label>
   <label><input type="radio" name="sep" id="sepPipe" value="|" onclick="CSV.autodetect=false;CSV.delimiter = '|'; parseAndOptions(CSV)"> Bar-|</label>
   <label><input type="radio" name="sep" id="sepTab" value=" " onclick="CSV.autodetect=false;CSV.delimiter = '\t'; parseAndOptions(CSV)"> Tab</label>
<input type="button" value="Clear Input" onclick="clearAll()"><br/>
<textarea class="xxxxlined" rows="10" cols="100" id="txt1" onchange="parseAndOptions(CSV)" wrap="off">id,name,amount,Remark
1,"Johnson, Smith, and Jones Co.",345.33,Pays on time
2,"Sam ""Mad Dog"" Smith",993.44,
3,"Barney & Company",0,"Great to work with
and always pays with cash."
4,Johnson Automotive,2344,
</textarea><br/>

<br/><input type="button" id="btnRun" value="Convert CSV To SQL Insert" title="Convert CSV To SQL Insert" 
    onclick="document.getElementById('txta').value = csvToSql(CSV, this.form.tabname.value, 'I', false,this.form.chkTable.checked,this.form.chkDropTable.checked);" >
<input type="button" value="Convert CSV To SQL Update" onclick="document.getElementById('txta').value=csvToSql(CSV, this.form.tabname.value, 'U', false);" >
<input type="button" value="Convert CSV To SQL Delete" onclick="document.getElementById('txta').value=csvToSql(CSV, this.form.tabname.value, 'D', false);" >

  <br/><label>Table Name: <input type="text" name="tabname" id="tabname" value="mytable"></label>
  <!--
    <label>Database Target 
  <select>
     <option>Oracle</option>
     <option>Sql Server</option>
     <option>MySql</option>
     <option>Sqlite</option>
     <option>ANSI</option>
  </select></label>-->
    <label><input type="checkbox" name="chkTable" id="chkTable" disabled onclick="if (!this.checked) this.form.chkDropTable.checked = false;" />Create Table</label>
    <label><input type="checkbox" name="chkDropTable" id="chkDropTable" disabled  onclick="if (this.checked) this.form.chkTable.checked = true;" />Drop Table</label>
  <div id="divOptions"></div>
</form>

</div>
<textarea id="txta" rows="15" cols="100" wrap="off"></textarea>
</div>
</div>
