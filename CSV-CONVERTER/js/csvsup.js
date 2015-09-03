// Copyright 2013 Data Design Group, Inc  All Rights Reserved


function temGetVal(oCsv,s,rownum)
{
  oCsv = oCsv || CSV; 
  var k;
  var rn = rownum + 1;
  var nr = oCsv.table.length;
  var nh = oCsv.arHeaderRow.length;
  var nf = 0;
  var br = "\n";
  var lb = "{";
  var rb = "}";

  for (k = 0; k < oCsv.maxColumnsFound; k++) { //for each column init
       eval("var f" + (k + 1) + "=''");
       eval("var h" + (k + 1) + "=''");
  }
  for(k=0;k<oCsv.arHeaderRow.length;k++) { //for each header column
      eval("var h" + (k + 1) + "=oCsv.arHeaderRow[k]");
  }
  if (rownum >= 0) {
      for (k = 0; k < oCsv.table[rownum].length; k++) { //for each column
          eval("var f" + (k + 1) + "=oCsv.table[rownum][k]");
      }
  }
  nf = (rownum>=0 ) ? oCsv.table[rownum].length : 0;

  var a=s.split('.');
  var b;
  for (var j = 0; j < a.length;j++ ) {
      b=a[j].trim().split('(');
      if(b[0].trim().toLowerCase()=='csv' && b.length>1 && b[1].trim()===')') {
          a[j]="csv(" + oCsv.quote.enclose('"','\\') + "," + oCsv.quote.enclose('"','\\') + ")";
      }
  }
  try {
     return eval(a.join('.'));
  }
  catch (e) {
     return "";
  }
}
function temHandler(oCsv, tem, rownum)
{
  oCsv = oCsv || CSV;
  if (tem == "") return "";
  //var tem = "{{h1}}:{{f1}}{{br}}{{h2}}:{{f2}}";
  var a = tem.replace(/{{/g,'{{\n').split(/{{|}}/);
  var s=a.join('\n');
  var j=0;
  var cmd=false;
  lines=s.split("\n");
  var t = [];
 
  while(j < lines.length)  
  {
     if(cmd && lines[j] != "") {
         // expand variable and push
         t.push(temGetVal(oCsv, lines[j], rownum));
         cmd=false;
     }
     else if (lines[j] == "") {
        cmd=true;
     }
     else {
        t.push(lines[j]);
     }
     j++;
  }
  return t.join('');
}

// Generate String from template
function csvFromTem(oCsv,temHead,tem,temFoot)
{
  var j;    
  oCsv = oCsv || CSV;  
  var s="";
  //alert(tem);
  s+=temHandler(oCsv, temHead, -1);
  for(j=0;j<oCsv.table.length;j++)
  {
     // alert('Calling temHandler for row j=' + j);
     s+=temHandler(oCsv, tem, j);
  }
  s+=temHandler(oCsv, temFoot, -1);
  return s;
}

// wrap an array of values with html table tags
function csvToTable(oCsv,addLineNumbers)
{
  var j,k,coltag;
  var s="<table border=\"1\">\n";
  oCsv = oCsv || CSV;  
  if(oCsv.isFirstRowHeader) {
     s+="<thead><tr>";
     if (addLineNumbers) s += "<th>#</th>";
     for(k=0;k<oCsv.arHeaderRow.length;k++) { //for each header column
         s+="<th>"+htmlEscape(oCsv.arHeaderRow[k]).replace(/\r\n|\n/g,"<br/>")+"</th>\n";
     }
     s+="</tr></thead>\n";
  }
  s+="<tbody>";
  for(j=0;j<oCsv.table.length;j++)
  {
     s+="<tr>";
     if (addLineNumbers) s += "<td>"+(j+1)+"</td>\n";
     for(k=0;k<oCsv.table[j].length;k++) { //for each column
        s+="<td>"+htmlEscape(oCsv.table[j][k]).replace(/\r\n|\n/g,"<br>")+"</td>\n";
     }
     s+="</tr>\n";
  }
  s+="</tbody></table>";
  return s;
}
// wrap an array of values with XML tags
function csvToXml(oCsv, topName, rowName)
{
  var j=0,k,col;
  var hdr;
  var topLevel = topName || "ROWSET";
  var rowLevel = rowName || "ROW";
  var s="<?xml version=\"1.0\"?>\n<" + topLevel + ">\n";
  oCsv = oCsv || CSV;  
  if (oCsv.table.length==0) return s + "</" + topLevel + ">";
  hdr=getCsvHeader(oCsv);
  for(j=0;j<oCsv.table.length;j++)
  {
     s+="<" + rowLevel + ">\n";
     for(k=0;k<oCsv.table[j].length;k++) {
        if(k>=hdr.length)break;//test this.
        s+="<"+hdr[k]+ ">"+htmlEscape(oCsv.table[j][k])+"</" + hdr[k] + ">\n";
     }
     s+="</" + rowLevel + ">\n";
  }
  s+="</" + topLevel + ">";
  return s;
}
function csvToXmlProperties(oCsv, topName, rowName)
{
  var j=0,k,col;
  var hdr;
  var topLevel = topName || "ROWSET";
  var rowLevel = rowName || "ROW";
  var s="<?xml version=\"1.0\"?>\n<" + topLevel + ">\n";
  oCsv = oCsv || CSV;  
  if (oCsv.table.length==0) return s + "</" + topLevel + ">";
  hdr=getCsvHeader(oCsv);
  for(j=0;j<oCsv.table.length;j++)
  {
     s+="<" + rowLevel;
     for(k=0;k<oCsv.table[j].length;k++) {
        if(k>=hdr.length)break;//test this.
        s+=" " + hdr[k]+ '="'+htmlEscape(oCsv.table[j][k])+'"';
     }
     s+="></" + rowLevel + ">\n";
  }
  s+="</" + topLevel + ">";
  return s;
}
// wrap an array of values with JSON 
function csvToJSON(oCsv)
{
  var j=0,k,col;
  var hdr;
  var s="[\n";
  oCsv = oCsv || CSV;  
  if (oCsv.table.length==0) return s + "]";
  hdr=getCsvHeader(oCsv);
  for(j=0;j<oCsv.table.length;j++) // for each data row
  {
     s+="  {\n";
     for(k=0;k<oCsv.table[j].length;k++) {
        if(k>=hdr.length)break;//test this.
        s+='    "'+hdr[k]+ '":';
        // if numeric then don't wrap in double quotes
        if (oCsv.statsCnt[k] && (oCsv.statsCnt[k].fieldType == "N" || oCsv.statsCnt[k].fieldType == "I") ) {
            if (oCsv.table[j][k])
                s += oCsv.table[j][k];
            else
                s += 'null';
        }
        else {
            s += '"' + oCsv.table[j][k].replace(/\\/g,"\\\\").replace(/"/g, '\\"').replace(/\r\n|\n/g, '\\n').replace(/\t/g, '\\t') + '"';
        }
        s += (k < oCsv.table[j].length - 1 ? ',' : '') + "\n";
     }
     s+="  }";
     if(j<oCsv.table.length-1)s+=",";
     s+="\n";
  }
  s+="]";
  return s;
}
// wrap an array of values with JSON in array format
function csvToJSONArray(oCsv)
{
  var j=0,k,col;
  var hdr;
  var s="[\n";
  oCsv = oCsv || CSV;  
  if (oCsv.table.length==0) return s + "]";
  hdr=getCsvHeader(oCsv);
  for(j=0;j<oCsv.table.length;j++)
  {
     s+="  [";
     for(k=0;k<oCsv.table[j].length;k++) {
        if(k>=hdr.length)break;//test this.
        if (oCsv.statsCnt[k] && (oCsv.statsCnt[k].fieldType == "N" || oCsv.statsCnt[k].fieldType == "I")) {
            if (oCsv.table[j][k])
                s += oCsv.table[j][k];
            else
                s += 'null';
        }
        else {
            s += '"' + oCsv.table[j][k].toJson() + '"';
        }
        s+= (k<oCsv.table[j].length-1?',':'');
     }
     s+="  ]";
     if(j<oCsv.table.length-1)s+=",";
     s+="\n";
  }
  s+="]";
  return s;
}
// wrap an array of values with JSON - field:[v1,v2,...]
function csvToJSONColumnArray(oCsv)
{
  var j=0,k,col;
  var hdr;
  var s="{\n";
  oCsv = oCsv || CSV;  
  if (oCsv.table.length==0) return s + "]";
  hdr=getCsvHeader(oCsv);
  for(j=0;j<hdr.length;j++) // for each column
  {
     s+='    "'+hdr[j]+ '":['
     for(k=0;k<oCsv.table.length;k++) { // for each row
         if (oCsv.statsCnt[j] && (oCsv.statsCnt[j].fieldType == "N" || oCsv.statsCnt[j].fieldType == "I")) {
             if (oCsv.table[k][j])
                 s += oCsv.table[k][j];
             else
                 s += 'null';
         }
         else {
             s += '"' + oCsv.table[k][j].replace(/"/g, '\\"').replace(/\r\n|\n/g, '\\n').replace(/\t/g, '\\t') + '"';
         }
        s+= (k<oCsv.table.length-1?',':'');
     }
     s+="]";
     if(j<oCsv.table.length-1)s+=",";
     s += "\n";
  }
  s+="}";
  return s;
}
// produce fixed width lines from an array of values, optionally wrap with ascii table
function csvToFixed(oCsv,addsep,addTable,addLineNumbers)
{
  var j=0,k,col;
  var s="";
  var v = "";
  var centerAdjust = false;
  var rightAdjust = false;
  if(typeof addsep==='undefined' || addsep==null) addsep=" ";
  if (addTable && (addsep==="" || addsep === " ")) addsep = "|";
  oCsv = oCsv || CSV;  
  if (oCsv.table.length==0) return s;
  var hdr=getCsvHeader(oCsv);
  var stats=getCsvColLength(oCsv);
  var linewidth = 0;
  if (addTable) {
      for (k = 0; k < oCsv.table[j].length; k++) { // what is width of all fields
          if (oCsv.isFirstRowHeader && hdr[k] && hdr[k].length > stats[k]) stats[k] = hdr[k].length;
          linewidth += stats[k]+1;
      }
      if (addLineNumbers) linewidth += ("" + oCsv.table.length).length+1;

      s += "+".rpad(linewidth, "-") + "+\n";
      if (oCsv.isFirstRowHeader) {
          s += addsep;
          if (addLineNumbers) s += "#".rpad((""+oCsv.table.length).length)+addsep;
          for (k = 0; k < hdr.length; k++) { // output header
              if(k>0)s+=addsep;
              s+=hdr[k].replace(/\r|\n/g,' ').rpad(stats[k]);
          }
          s += addsep + "\n";
          s += "+".rpad(linewidth, "-") + "+\n";
      }
  }
  for(j=0;j<oCsv.table.length;j++) // for each line
  {
     if (addTable) s += addsep;
     if (addLineNumbers) s += ("" + (j + 1)).rpad(("" + oCsv.table.length).length)+addsep;

     for(k=0;k<oCsv.table[j].length;k++) { // for each column
        if(k>=hdr.length)break;//test this.
        if(k>0)s+=addsep;
        v = oCsv.table[j][k];
        rightAdjust = false;
        centerAdjust = false;
        if (document.getElementById("ftrim" + (k + 1))) if (document.getElementById("ftrim" + (k + 1)).checked) v = v.trim();
        if (document.getElementById("chkupper" + (k + 1))) if (document.getElementById("chkupper" + (k + 1)).checked) v = v.toUpperCase();
        if (document.getElementById("chklower" + (k + 1))) if (document.getElementById("chklower" + (k + 1)).checked) v = v.toLowerCase();
        if (document.getElementById("chkrjust" + (k + 1))) if (document.getElementById("chkrjust" + (k + 1)).checked) rightAdjust=true; 
        if (document.getElementById("chkcjust" + (k + 1))) if (document.getElementById("chkcjust" + (k + 1)).checked) centerAdjust=true;
        if(centerAdjust)s+=v.replace(/\r|\n/g,' ').cjust(stats[k]);
        else if(rightAdjust)s+=v.replace(/\r|\n/g,' ').rjust(stats[k]);
        else s+=v.replace(/\r|\n/g,' ').rpad(stats[k]);
     }
     if (addTable) s += addsep;
     s+="\n";
  }
  if(addTable) s += "+".rpad(linewidth, "-") + "+\n";
  return s;
}
// convert array of values to multi-line data
function csvToMulti(oCsv,sep)
{
  var j=0,k,col;
  var hdr;
  var s="";
  oCsv = oCsv || CSV;  
  if (oCsv.table.length==0) return s;
  hdr=getCsvHeader(oCsv);
  for(j=0;j<oCsv.table.length;j++) // each row
  {
     for(k=0;k<oCsv.table[j].length;k++) { // each column
        if(k>=hdr.length)break;//test this.
        s+=oCsv.table[j][k].replace(/\r|\n/g,' ')+ "\n";
     }
     s+=sep+"\n";
  }
  return s;
}
// convert array of values to google Earth KML format
// https://developers.google.com/kml/documentation/kml_tut
// http://econym.org.uk/gmap/kml.htm
function csvToKml(oCsv,nameCol,descCol,latCol,longCol)
{
  var j=0,k,col;
  var hdr;
  var s="<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  s+="<kml xmlns=\"http://earth.google.com/kml/2.0\">\n";
  s+="<Document>\n";
  oCsv = oCsv || CSV;
  if (oCsv.table.length==0) return s + "</Document></kml>";
  hdr=getCsvHeader(oCsv);
  for(j=0;j<oCsv.table.length;j++)
  {
     s+="<Placemark>\n";
     // <name></name><description></description><Point><coordinates>-74.0,40.7,0</coordinates></Point>
     for(k=0;k<oCsv.table[j].length;k++) {
        if(k>=hdr.length)break;//test this.
        if (!isNaN(latCol) && k == (latCol-1)) continue;
        if (!isNaN(longCol) && k == (longCol-1)) continue;
        if (!isNaN(nameCol) && k == (nameCol - 1)) hdr[k] = "name";
        else if (!isNaN(descCol) && k == (descCol - 1)) hdr[k] = "description";
        else continue;
        s+="<"+hdr[k]+ ">"+htmlEscape(oCsv.table[j][k])+"</" + hdr[k] + ">\n";
     }
     if (!isNaN(latCol) && !isNaN(longCol) && latCol.length>0 && longCol.length>0 
         && latCol*1 <= oCsv.table[j].length && longCol*1 <= oCsv.table[j].length
         && oCsv.table[j][latCol*1-1] && oCsv.table[j][longCol*1-1] ) {
         s += "<Point><coordinates>";
         s+=oCsv.table[j][longCol*1-1] + "," + oCsv.table[j][latCol*1-1]+",0";
         s += "</coordinates></Point>\n";
     }
     s+="</Placemark>\n";
  }
  s+="</Document>\n</kml>";
  return s;
}

function csvToCsv(oCsv,delimiter,headingSpecified,excelForceMode,defaultHeader)
{
  oCsv = oCsv || CSV;   
  if (oCsv.table.length==0) return "";
  var j=0,k,col;
  var hdr;
  var s="";
  if (headingSpecified || defaultHeader) {
      hdr = getCsvHeader(oCsv);
      for (j = 0; j < hdr.length; j++) {
          if (j > 0) s += delimiter;
          s += hdr[j].toCsv(oCsv.quote);
      }
      if (s != "") s += "\n";
  }
  for (j = 0; j < oCsv.table.length; j++) {
          for (k = 0; k < oCsv.table[j].length; k++) {
              if(excelForceMode && oCsv.table[j][k] != "")
              {
                  if (oCsv.table[j][k].indexOf(',') < 0) {
                      s += "=" + oCsv.table[j][k].toCsv();
                  }
                  else {
                      s += '"="' + oCsv.table[j][k].toCsv() + '""';
                  }
              }
              else if (oCsv.statsCnt[k] && (oCsv.statsCnt[k].fieldType == "N" || oCsv.statsCnt[k].fieldType == "I")) {
                  if (oCsv.table[j][k])
                      s += oCsv.table[j][k];
                  else
                      s += '';
              }
              else {
                  s += oCsv.table[j][k].toCsv(oCsv.quote);
              }
              s += (k < oCsv.table[j].length - 1 ? delimiter    : '');
          }
          s += "\n";
      }
  return s;
  //return oCsv.stringify(oCsv.table);
}
function getCsvColLength(oCsv)
{
  var j=0,k=0;
  var stats=new Array();
  oCsv = oCsv || CSV;
  if (oCsv.table.length==0) return stats;
  for(k=0;k<oCsv.table[0].length;k++) stats.push(0); // max length of columns
  for(j=0;j<oCsv.table.length;j++) // for each row
  {
     for(k=0;k<stats.length;k++) {// for each column
        if(oCsv.table[j][k].length>stats[k])stats[k]=oCsv.table[j][k].length; 
     }
  }
  return stats;
}
function csvToSql(oCsv,tabname,operation,newlines,createTable,dropTable)
{
  var j=0,k,col,n;
  var hdr;
  var s="";
  var tp="";
  var v="";
  var tem="";// template
  var cv="";
  var incl = [];
  var usrhdr = [];
  var where = "";
  var keys = [];
  oCsv = oCsv || CSV;
  if (oCsv.table.length==0) return s;
  operation = operation || "I";
  newlines = newlines || false;
  hdr=getCsvHeader(oCsv);
  for(n=k=0;k<hdr.length;k++) {
      usrhdr[k] = hdr[k];
      keys[k] = false;
      if (document.getElementById("fkey" + (k + 1))) if (document.getElementById("fkey" + (k + 1)).checked) keys[k] = true;
      if(document.getElementById("fname"+(k+1)))usrhdr[k]=document.getElementById("fname"+(k+1)).value.toUpperCase();
      if(document.getElementById("finc"+(k+1)))
      {
        if(document.getElementById("finc"+(k+1)).checked) {
           incl[k]=true;
           n++;
        }
        else {
           incl[k]=false;
        }
      }
      else {
         incl[k]=true;
         n++;
      }
  }
  if(n==0)return ""; // no included fields
  //if (dropTable) s += "DROP TABLE " + tabname;
  switch (operation) {
      case "I":
          for (j = 0; j < oCsv.table.length; j++) {
              s += "INSERT INTO " + tabname + "(";
              if (newlines) s += "\n";
              for (n = k = 0; k < hdr.length; k++) {
                  if (!incl[k]) continue;
                  if (n > 0) s += ",";
                  s += usrhdr[k];
                  if (newlines) s += "\n";
                  n++;
              }
              s += ") VALUES (";
              if (newlines) s += "\n";
              for (n = k = 0; k < oCsv.table[j].length; k++) {
                  if (!incl[k]) continue;
                  tp = oCsv.statsCnt[k].fieldType;
                  v = oCsv.table[j][k];
                  if (document.getElementById("ftype" + (k + 1))) { tp = document.getElementById("ftype" + (k + 1)).value; }
                  if (document.getElementById("ftem" + (k + 1))) tem = document.getElementById("ftem" + (k + 1)).value;
                  if (document.getElementById("ftrim" + (k + 1))) if (document.getElementById("ftrim" + (k + 1)).checked) v = v.trim();
                  if (document.getElementById("chkupper" + (k + 1))) if (document.getElementById("chkupper" + (k + 1)).checked) v = v.toUpperCase();
                  if (document.getElementById("chklower" + (k + 1))) if (document.getElementById("chklower" + (k + 1)).checked) v = v.toLowerCase();
                  if (n > 0) s += ",";
                  if (tem != "") {
                      s += tem.replace("{f}", v.toSql());
                  }
                  else {
                      switch (tp) {
                          case "B": s += "'" + v.toSql() + "'";
                              break;
                          case "N": if (v === "") s += "NULL"; else s += v.toSql();
                              break;
                          case "I": if (v === "") s += "NULL"; else s += v.toSql();
                              break;
                          case "D": if (v === "") s += "NULL"; else s += "'" + v.toSql() + "'";
                              break;
                          default: s += "'" + v.toSql() + "'";
                              break;
                      }
                  } // else
                  if (newlines) s += "\n";
                  n++;
              } // each column
              s += ");\n";
          } // big for
          break;
      case "U": // Update

          for (j = 0; j < oCsv.table.length; j++) // for each row
          {
              where = "1=1";
              s += "UPDATE " + tabname + " SET ";
              if (newlines) s += "\n";
              for (k = 0; k < hdr.length; k++) { // set where
                  if (keys[k]) where += " AND " + usrhdr[k] + "= {f" + k + "}";
              }
              if (where === "1=1") where += " AND " + usrhdr[0] + "= {f0}"; // missing keys, default 1st column
              for (n = k = 0; k < hdr.length; k++) { // each column
                  if (incl[k]) {
                      if (n > 0) s += ",";
                      s += usrhdr[k] + " = ";
                      n++;
                  }
                  tp = oCsv.statsCnt[k].fieldType;
                  v = oCsv.table[j][k];
                  if (document.getElementById("ftype" + (k + 1))) tp = document.getElementById("ftype" + (k + 1)).value;
                  if (document.getElementById("ftem" + (k + 1))) tem = document.getElementById("ftem" + (k + 1)).value;
                  if (document.getElementById("ftrim" + (k + 1))) if (document.getElementById("ftrim" + (k + 1)).checked) v = v.trim();
                  if (document.getElementById("chkupper" + (k + 1))) if (document.getElementById("chkupper" + (k + 1)).checked) v = v.toUpperCase();
                  if (document.getElementById("chklower" + (k + 1))) if (document.getElementById("chklower" + (k + 1)).checked) v = v.toLowerCase();
                  if (tem != "") {
                      s += tem.replace("{f}", v.toSql());
                  }
                  else {
                      switch (tp) {
                          case "B":
                              if (incl[k]) s += "'" + v.toSql() + "'";
                              where = where.replace("{f" + k + "}", "'" + v.toSql() + "'");
                              break;
                          case "N":
                              if (incl[k]) {
                                  if (v === "") s += "NULL";
                                  else s += v.toSql();
                              }
                              where = where.replace("{f" + k + "}", v.toSql());
                              break;
                          case "I":
                              if (incl[k]) {
                                  if (v === "") s += "NULL";
                                  else s += v.toSql();
                              }
                              where = where.replace("{f" + k + "}", v.toSql());
                              break;
                          case "D":
                              if (incl[k]) {
                                  if (v === "") s += "NULL";
                                  else s += "'" + v.toSql() + "'";
                              }
                              where = where.replace("{f" + k + "}", "'" + v.toSql() + "'");
                              break;
                          default:
                              if (incl[k]) {
                                  s += "'" + v.toSql() + "'";
                              }
                              where = where.replace("{f" + k + "}", "'" + v.toSql() + "'");
                              break;
                      }
                  } // else
                  if (incl[k]) {
                      if (newlines) s += "\n";
                      n++;
                  }
              } // each column
              s += " WHERE " + where;
              // determine the keys and use those in where clause
              s += ";\n";
          } // big for case update  
          break;
      case "D":
          for (j = 0; j < oCsv.table.length; j++) // for each row
          {
              where = "1=1";
              s += "DELETE FROM " + tabname;
              if (newlines) s += "\n";
              // determine the keys and use those in where clause
              for (k = 0; k < usrhdr.length; k++) { // set where
                  if (keys[k]) where += " AND " + usrhdr[k] + "= {f" + k + "}";
              }
              if (where === "1=1") where += " AND " + usrhdr[0] + "= {f0}"; // missing keys, default 1st column
              for (n = k = 0; k < hdr.length; k++) { // each column
                  n++;
                  tp = oCsv.statsCnt[k].fieldType;
                  v = oCsv.table[j][k];
                  if (document.getElementById("ftype" + (k + 1))) tp = document.getElementById("ftype" + (k + 1)).value;
                  if (document.getElementById("ftem" + (k + 1))) tem = document.getElementById("ftem" + (k + 1)).value;
                  if (document.getElementById("ftrim" + (k + 1))) if (document.getElementById("ftrim" + (k + 1)).checked) v = v.trim();
                  if (document.getElementById("chkupper" + (k + 1))) if (document.getElementById("chkupper" + (k + 1)).checked) v = v.toUpperCase();
                  if (document.getElementById("chklower" + (k + 1))) if (document.getElementById("chklower" + (k + 1)).checked) v = v.toLowerCase();
                  if (tem != "") {
                      s += tem.replace("{f}", v.toSql());
                  }
                  else {
                      switch (tp) {
                          case "B":
                              where = where.replace("{f" + k + "}", "'" + v.toSql() + "'");
                              break;
                          case "N":
                              where = where.replace("{f" + k + "}", v.toSql());
                              break;
                          case "I":
                              where = where.replace("{f" + k + "}", v.toSql());
                              break;
                          case "D":
                              where = where.replace("{f" + k + "}", "'" + v.toSql() + "'");
                              break;
                          default:
                              where = where.replace("{f" + k + "}", "'" + v.toSql() + "'");
                              break;
                      }
                  } // else
                  if (newlines) s += "\n";
                  n++;
              } // each column
              s += " WHERE " + where;
              s += ";\n";
          }
          break;
  } // switch
  return s;
}
function htmlEscape(str) {
    return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}
function getCsvHeader(oCsv)
{
  var k;
  var hdr=new Array();
  oCsv = oCsv || CSV;
  if (!oCsv)alert('Missing oCsv');
  if (!oCsv.arHeaderRow)alert('Missing arHeaderRow');
  for(k=0;k<oCsv.arHeaderRow.length;k++) { 
      if(oCsv.arHeaderRow[k]) {
         hdr.push(oCsv.arHeaderRow[k]);
      }
      else {
         hdr.push("FIELD"+(k+1)); 
      }
      if (oCsv.headerToUpper) {
          oCsv.arHeaderRow[k] = oCsv.arHeaderRow[k].toUpperCase();
          hdr[hdr.length - 1] = hdr[hdr.length - 1].toUpperCase();
          //alert('ok in upper it done');
      }
      else if (oCsv.headerToLower) {
          oCsv.arHeaderRow[k] = oCsv.arHeaderRow[k].toLowerCase();
          hdr[hdr.length - 1] = hdr[hdr.length - 1].toLowerCase();
      }
  }
  return hdr;
}

function sqlOptions(oCsv)
{
//alert('in sqlOptions');
   oCsv = oCsv || CSV;
   var stats=getCsvColLength(oCsv);
   var hdr=getCsvHeader(oCsv);
   var s="<table>\n<tr>\n<th>Col #</th><th>Field Name</th><th>Data Type</th><th>Max Size</th>";
   s += "<th>Key</th><th>Include</th><th>Required</th><th>Trim</th><th>Upper</th><th>Lower</th><th title=\"Modify output by using {f} for field value. Ex: {f}+100\">Template ({f}=field)</th></tr>";
   var template="<tr><td>{#}</td>";
   template+="<td><input type=text id=\"fname{#}\" value=\"{FIELDNAME{#}}\"></td>\n";
   template+="<td><select id=\"ftype{#}\" title=\"Choose data type of column\" >";
   template+="<option value=\"VC\" {VC{#}}>Character Varying</option>";
   template+="<option value=\"C\" {C{#}}>Character Fixed</option>";
   template+="<option value=\"N\" {N{#}}>Numeric</option>";
   template+="<option value=\"I\" {I{#}}>Integer</option>";   
   template+="<option value=\"D\" {D{#}}>Date</option>";
   template+="<option value=\"B\" {B{#}}>Bit(0,1)</option>";
   template+="</select>\n</td><td><input name=\"fsize{#}\"size=4 maxlength=4 value=\"{FIELDSIZE{#}}\"></td>";
   template += "<td><input type=checkbox id=\"fkey{#}\"  value=\"Y\" ></td>\n";
   template += "<td><input type=checkbox id=\"finc{#}\"  value=\"Y\" checked></td>\n";
   template+="<td><input type=checkbox id=\"freq{#}\"  value=\"Y\" ></td>\n";
   template+="<td><input type=checkbox id=\"ftrim{#}\" value=\"Y\" checked></td>\n";
   template+="<td><input type=checkbox id=\"chkupper{#}\"  value=\"Y\" onclick=\"if(this.checked)document.getElementById('chklower{#}').checked=false\"></td>\n";
   template+="<td><input type=checkbox id=\"chklower{#}\"  value=\"Y\" onclick=\"if(this.checked)document.getElementById('chkupper{#}').checked=false\"></td>\n";
   template+="<td><input type=\"text\" id=\"ftem{#}\" value=\"\" size=\"20\" maxlength=\"100\"></td>";
   template+="</tr>";
   var j;
//alert('in options, hdr length='+hdr.length);   
   for(j=0;j<hdr.length;j++) // for each column
   {
      s+=template.replace(/{#}/g,""+(j+1))
                 .replace("{FIELDNAME"+(j+1)+"}",hdr[j].toUpperCase().replace(/\s+/g,"_"))
                 .replace("{FIELDSIZE"+(j+1)+"}",(stats[j])==0?1:stats[j])
                 ;
      s=s.replace("ftitle"+(j+1)+"}","Type:"+oCsv.statsCnt[j].fieldType+",Counts: Total: " +oCsv.table.length +",Int: " +oCsv.statsCnt[j].intCnt+" ,Numeric:"+oCsv.statsCnt[j].realCnt+",Bit:"+oCsv.statsCnt[j].bitCnt+",Date:"+oCsv.statsCnt[j].dateCnt+",Empty:"+oCsv.statsCnt[j].emptyCnt);
      if(oCsv.statsCnt[j].fieldType==="VC")s=s.replace("{VC"+(j+1)+"}","selected");
      if(oCsv.statsCnt[j].fieldType==="C" )s=s.replace("{C"+(j+1)+"}","selected");
      if(oCsv.statsCnt[j].fieldType==="N" )s=s.replace("{N"+(j+1)+"}","selected");
      if(oCsv.statsCnt[j].fieldType==="I" )s=s.replace("{I"+(j+1)+"}","selected");
      if(oCsv.statsCnt[j].fieldType==="B" )s=s.replace("{B"+(j+1)+"}","selected");
      if(oCsv.statsCnt[j].fieldType==="D" )s=s.replace("{D"+(j+1)+"}","selected");
   }
   //alert(s);
   s+="</table>";
   return s;
}
function setOptions(oCsv)
{
   var j;
   //fname
   //ftype
   //fsize
   //finc
   //freq  
   //ftrim
   //chkupper
   //chklower
   //ftem
  // alert('setOptions:beginning');
   oCsv = oCsv || CSV;
   var hdr=getCsvHeader(oCsv);
//alert('in setOptions, header length='+hdr.length);
   if (document.getElementById('fkey1')) document.getElementById('fkey1').checked = true;
   if (document.getElementById('freq1')) document.getElementById('freq1').checked = true;
   for(j=0;j<hdr.length;j++) // for each column
   {
      if(!document.getElementById('fname'+(j+1)))continue;
      document.getElementById('fname'+(j+1)).value=hdr[j].toUpperCase();
      if(!document.getElementById('ftype'+(j+1)))continue;
      if (oCsv.statsCnt[j]) continue;
      document.getElementById('ftype'+(j+1)).value=oCsv.statsCnt[j].fieldType;
      document.getElementById('ftype'+(j+1)).title="Type:"+oCsv.statsCnt[j].fieldType+",Counts: Total: " +oCsv.table.length +",Int: " +oCsv.statsCnt[j].intCnt+" ,Numeric:"+oCsv.statsCnt[j].realCnt+",Bit:"+oCsv.statsCnt[j].bitCnt+",Date:"+oCsv.statsCnt[j].dateCnt+",Empty:"+oCsv.statsCnt[j].emptyCnt;

   }
 //alert('at end of setOptions')
}
function flatOptions(oCsv)
{
//alert('in flatOptions');
   oCsv = oCsv || CSV;
   var stats=getCsvColLength(oCsv);
   var hdr=getCsvHeader(oCsv);
   var s="<table>\n<tr>\n<th>Col #</th><th>Field Name</th><thInclude/th><th>Trim</th>";
   s += "<th>Upper</th><th>Lower</th><th>Right<br/>Justify</th><th>Center<br/>Justify</th></tr>";
   var template="<tr><td>{#}</td>";
   template+="<td>{FIELDNAME{#}}</td>\n";
   //template += "<td><input type=checkbox id=\"finc{#}\"  value=\"Y\" checked></td>\n";
   template+="<td><input type=checkbox id=\"ftrim{#}\" value=\"Y\" checked></td>\n";
   template+="<td><input type=checkbox id=\"chkupper{#}\"  value=\"Y\" onclick=\"if(this.checked)document.getElementById('chklower{#}').checked=false\"></td>\n";
   template+="<td><input type=checkbox id=\"chklower{#}\"  value=\"Y\" onclick=\"if(this.checked)document.getElementById('chkupper{#}').checked=false\"></td>\n";
   template+="<td><input type=checkbox id=\"chkrjust{#}\"  value=\"Y\" onclick=\"if(this.checked)document.getElementById('chkcjust{#}').checked=false\"></td>\n";
   template+="<td><input type=checkbox id=\"chkcjust{#}\"  value=\"Y\" onclick=\"if(this.checked)document.getElementById('chkrjust{#}').checked=false\"></td>\n";
   template+="</tr>";
   var j;
//alert('in options, hdr length='+hdr.length);   
   for(j=0;j<hdr.length;j++) // for each column
   {
      s+=template.replace(/{#}/g,""+(j+1))
                 .replace("{FIELDNAME"+(j+1)+"}",hdr[j].toUpperCase().replace(/\s+/g,"_"))
                 ;
   }
   //alert(s);
   s+="</table>";
   return s;
}
function parseAndOptions(oCsv)
{
    //alert('in parseAndOptions');
    oCsv = oCsv || CSV;
    oCsv.limit = document.getElementById('txtRowLimit').value;
    if(document.getElementById('divOptions'))document.getElementById('divOptions').innerHTML = "";
    if(document.getElementById('chkHeader'))oCsv.isFirstRowHeader = document.getElementById('chkHeader').checked;
    if(document.getElementById('chkHeaderUpper'))oCsv.headerToUpper=document.getElementById('chkHeaderUpper').checked;
    if(document.getElementById('chkHeaderLower'))oCsv.headerToLower=document.getElementById('chkHeaderLower').checked;
    //alert('*****************'+oCsv.headerToUpper + ":" + oCsv.headerToLower);
    if(document.getElementById('txt1'))CSV.parse(document.getElementById('txt1').value);
    //alert('in parseAndOptions 44444');
    if (document.getElementById('divOptions')) {
        document.getElementById('divOptions').innerHTML = sqlOptions(CSV);
        setOptions(oCsv);
    }
    if (document.getElementById('divFlatOptions')) {
        document.getElementById('divFlatOptions').innerHTML = flatOptions(CSV);
        setFlatOptions(oCsv);
    }
    
    //alert('in parseAndOptions at end');
}
function clearAll()
{
    if(document.getElementById('sepAuto'))document.getElementById('sepAuto').checked = true;
    if (CSV) { CSV.delimiter = ","; CSV.autodetect = true; }
    if(document.getElementById('txt1'))document.getElementById('txt1').value = "";
    if(document.getElementById('chkHeader'))document.getElementById('chkHeader').checked = true;
    if(document.getElementById('chkHeaderUpper'))document.getElementById('chkHeaderUpper').checked = false;
    if(document.getElementById('chkHeaderLower'))document.getElementById('chkHeaderLower').checked = false;
    if(document.getElementById('diva'))document.getElementById('diva').innerHTML = "";
    if(document.getElementById('divOptions'))document.getElementById('divOptions').innerHTML = "";
    if(document.getElementById('divFlatOptions'))document.getElementById('divFlatOptions').innerHTML = "";
    parseAndOptions();
}

function getUserOptions(colpos)
{
    
}
function radiovalue(rad)
{
    for(var j=0;j < rad.length; j++) {
        if(rad[j].checked) return rad[j].value;
    }
    return "";
}