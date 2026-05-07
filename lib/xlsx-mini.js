/**
 * xlsx-mini.js v2 — XLSX writer dengan styling penuh
 * Support: cell styles, merged cells, column widths, row heights, number formats
 * Output persis seperti format "PROGRAMMER Man Hour" asli
 */
const XlsxMini = (() => {
  const CRC_TABLE = (()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(c>>>1)^0xEDB88320:(c>>>1);t[i]=c;}return t;})();
  function crc32(d){let c=0xFFFFFFFF;for(let i=0;i<d.length;i++)c=CRC_TABLE[(c^d[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
  const ENC=new TextEncoder();
  function s2b(s){return typeof s==='string'?ENC.encode(s):s;}
  function u16(v){return[v&0xFF,(v>>8)&0xFF];}
  function u32(v){return[v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF];}
  function xe(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function cr(r,c){const col=c<26?String.fromCharCode(65+c):(String.fromCharCode(64+Math.floor(c/26))+String.fromCharCode(65+c%26));return col+(r+1);}

  function zipFiles(fileMap){
    const list=Object.entries(fileMap).map(([name,content])=>{const nb=s2b(name),db=s2b(content);return{nb,db,crc:crc32(db),sz:db.length};});
    const total=list.reduce((a,e)=>a+30+e.nb.length+e.sz,0)+list.reduce((a,e)=>a+46+e.nb.length,0)+22;
    const buf=new Uint8Array(total);let pos=0;
    const w=b=>{for(const x of b)buf[pos++]=x;};
    const wb=a=>{buf.set(a,pos);pos+=a.length;};
    const offs=[];
    list.forEach(e=>{offs.push(pos);w([0x50,0x4B,0x03,0x04,20,0,0,0,0,0,0,0,0,0]);w(u32(e.crc));w(u32(e.sz));w(u32(e.sz));w(u16(e.nb.length));w([0,0]);wb(e.nb);wb(e.db);});
    const cdOff=pos;
    list.forEach((e,i)=>{w([0x50,0x4B,0x01,0x02,20,0,20,0,0,0,0,0,0,0,0,0]);w(u32(e.crc));w(u32(e.sz));w(u32(e.sz));w(u16(e.nb.length));w([0,0,0,0,0,0,0,0,0,0,0,0]);w(u32(offs[i]));wb(e.nb);});
    const cdSz=pos-cdOff,n=list.length;
    w([0x50,0x4B,0x05,0x06,0,0,0,0]);w(u16(n));w(u16(n));w(u32(cdSz));w(u32(cdOff));w([0,0]);
    return buf;
  }

  // Style index constants
  const S={DEFAULT:0,HDR_TITLE:1,HDR_INFO:2,HDR_VAL:3,COL_HDR:4,DATE_HDR:5,DAY_HDR:6,DAY_HDR_WKD:7,
    PROJ_NAME:8,PROJ_NOTE:9,ITEM_NO:10,ITEM_NAME:11,DATA:12,DATA_WKD:13,
    NONOP_LBL:14,NONOP_ITEM:15,NONOP_DATA:16,NONOP_DATA_WKD:17,
    NWT_LBL:18,NWT_VAL:19,TOT_LBL:20,TOT_VAL:21,RATIO_LBL:22,RATIO_VAL:23,
    OT_LBL:24,OT_VAL:25,CUTI_LBL:26,TOT_HR:27,NOTE:28,PARAF:29,DATE_HDR_WKD:30,
    TOTALL_LBL:31,TOTALL_VAL:32};

  function buildStyles(){
    const numFmts='<numFmts count="2"><numFmt numFmtId="164" formatCode="0"/><numFmt numFmtId="165" formatCode="0%"/></numFmts>';
    const fonts='<fonts count="8">'+
      '<font><sz val="10"/><name val="Calibri"/></font>'+
      '<font><sz val="12"/><b/><color rgb="FFFFFF"/><name val="Calibri"/></font>'+
      '<font><sz val="10"/><b/><name val="Calibri"/></font>'+
      '<font><sz val="10"/><color rgb="FFFFFF"/><name val="Calibri"/></font>'+
      '<font><sz val="10"/><b/><color rgb="FFFFFF"/><name val="Calibri"/></font>'+
      '<font><sz val="10"/><color rgb="FF0000"/><name val="Calibri"/></font>'+
      '<font><sz val="10"/><b/><color rgb="FF0000"/><name val="Calibri"/></font>'+
      '<font><sz val="10"/><b/><name val="Calibri"/></font>'+
      '</fonts>';
    const fills='<fills count="14">'+
      '<fill><patternFill patternType="none"/></fill>'+
      '<fill><patternFill patternType="gray125"/></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="1F3864"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="2E5596"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="E2EFDA"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="FCE4D6"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFF00"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="4472C4"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="FFD7E4"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF2CC"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="70AD47"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="DEEAF1"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0000"/></patternFill></fill>'+
      '<fill><patternFill patternType="solid"><fgColor rgb="FFC000"/></patternFill></fill>'+
      '</fills>';
    const bdN='<border><left/><right/><top/><bottom/><diagonal/></border>';
    const bdT='<border><left style="thin"><color rgb="BFBFBF"/></left><right style="thin"><color rgb="BFBFBF"/></right><top style="thin"><color rgb="BFBFBF"/></top><bottom style="thin"><color rgb="BFBFBF"/></bottom><diagonal/></border>';
    const bdM='<border><left style="medium"><color rgb="4472C4"/></left><right style="medium"><color rgb="4472C4"/></right><top style="medium"><color rgb="4472C4"/></top><bottom style="medium"><color rgb="4472C4"/></bottom><diagonal/></border>';
    const borders=`<borders count="3">${bdN}${bdT}${bdM}</borders>`;
    const csx='<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
    function xf(nf,f,fi,b,h,v,w){let a='';if(h||v||w)a=`<alignment${h?` horizontal="${h}"`:''}${v?` vertical="${v}"`:''}${w?' wrapText="1"':''}/>`;return`<xf numFmtId="${nf}" fontId="${f}" fillId="${fi}" borderId="${b}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${a}</xf>`;}
    const cxfs='<cellXfs count="33">'+
      xf(0,0,0,0,'','',0)+    // 0 DEFAULT
      xf(0,1,2,0,'center','center',0)+ // 1 HDR_TITLE
      xf(0,7,0,0,'','',0)+    // 2 HDR_INFO bold
      xf(0,0,0,0,'','',0)+    // 3 HDR_VAL
      xf(0,4,3,2,'center','center',1)+ // 4 COL_HDR
      xf(0,4,3,2,'center','center',0)+ // 5 DATE_HDR
      xf(0,4,3,2,'center','center',0)+ // 6 DAY_HDR
      xf(0,5,3,2,'center','center',0)+ // 7 DAY_HDR_WKD (red text)
      xf(0,7,4,1,'center','center',1)+ // 8 PROJ_NAME bold green
      xf(0,0,4,1,'center','center',0)+ // 9 PROJ_NOTE green
      xf(0,0,0,1,'center','',0)+       // 10 ITEM_NO
      xf(0,0,0,1,'left','',0)+         // 11 ITEM_NAME
      xf(0,0,0,1,'right','',0)+        // 12 DATA
      xf(0,5,0,1,'right','',0)+        // 13 DATA_WKD red
      xf(0,7,5,1,'center','center',1)+ // 14 NONOP_LBL bold salmon
      xf(0,0,5,1,'left','',0)+         // 15 NONOP_ITEM
      xf(0,0,5,1,'right','',0)+        // 16 NONOP_DATA
      xf(0,5,5,1,'right','',0)+        // 17 NONOP_DATA_WKD
      xf(0,7,6,1,'left','center',0)+   // 18 NWT_LBL bold yellow
      xf(164,7,6,2,'center','center',0)+ // 19 NWT_VAL bold yellow
      xf(0,4,7,2,'left','center',0)+   // 20 TOT_LBL white on blue
      xf(164,4,7,2,'right','center',0)+ // 21 TOT_VAL
      xf(0,7,8,1,'left','center',0)+   // 22 RATIO_LBL pink
      xf(165,0,8,1,'right','center',0)+ // 23 RATIO_VAL %
      xf(0,7,9,1,'left','center',0)+   // 24 OT_LBL yellow
      xf(164,0,9,1,'right','center',0)+ // 25 OT_VAL
      xf(0,0,0,0,'left','',0)+         // 26 CUTI_LBL
      xf(164,4,7,2,'right','center',0)+ // 27 TOT_HR
      xf(0,0,0,1,'left','',0)+         // 28 NOTE
      xf(0,7,0,0,'left','',0)+         // 29 PARAF
      xf(0,6,3,2,'center','center',0)+ // 30 DATE_HDR_WKD red bold
      xf(0,4,10,2,'left','center',0)+  // 31 TOTALL_LBL green
      xf(164,4,10,2,'right','center',0)+ // 32 TOTALL_VAL
      '</cellXfs>';
    return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts}${fonts}${fills}${borders}${csx}${cxfs}<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }

  function buildManHourSheet(db, period){
    const [y,mn]=period.split('-');
    const monthShort=new Date(+y,+mn-1,1).toLocaleDateString('id-ID',{month:'long'});
    const td=new Date(+y,+mn,0).getDate();
    const mData=db.months?.[period]||{days:{},parafLeader:'',parafForeman:''};
    const opItems=db.opItems||[];
    const nonOpItems=db.nonOpItems||[];
    // Col layout: 0=blank,1=ProjNum,2=ProjName,3=Note,4=No,5=Item,6..6+td-1=dates,6+td=TotalHour,6+td+1=Note
    const C_A=0,C_PN=1,C_NAME=2,C_NOTE=3,C_NO=4,C_ITEM=5,C_D1=6;
    const C_TOTAL=C_D1+td,C_LNOTE=C_D1+td+1;
    function isWkd(d){const w=new Date(+y,+mn-1,d).getDay();return w===0||w===6;}
    function dAbbr(d){return new Date(+y,+mn-1,d).toLocaleDateString('id-ID',{weekday:'short'}).substring(0,3);}
    // Shared strings
    const allSS=new Map();let ssi=0;
    function rSS(s){const k=String(s??'');if(k==='')return -1;if(!allSS.has(k))allSS.set(k,ssi++);return allSS.get(k);}
    // Pre-register all strings
    const preStrings=['PROGRAMMER Man Hour','Nama',db.profile?.name||'','NPK',db.profile?.npk||'','Month',monthShort,
      'Project\nNumber','Project Name','Note','No.','Item Pekerjaan','Total\nHour','Operation','Non\nOperation',
      'Normal Working Time','Tanggal Input Laporan Harian',
      `Paraf Leader (${mData.parafLeader||'___'})`,`Paraf Foreman (${mData.parafForeman||'___'})`,
      'Total Operational','Total Non Operational','Total Jam Kerja','Operation Ratio','Overtime','Cuti/Sakit/Flexible Day',
      ...opItems,...nonOpItems];
    preStrings.forEach(s=>rSS(s));
    for(let d=1;d<=td;d++) rSS(dAbbr(d));
    // Collect project data
    const projOrder=[],seenP=new Set(),projData={};
    for(let d=1;d<=td;d++){
      const day=mData.days[d];if(!day)continue;
      day.operations.forEach(p=>{
        if(!seenP.has(p.projectName)){seenP.add(p.projectName);projOrder.push({name:p.projectName,number:p.projectNumber||''});}
        rSS(p.projectName);rSS(p.projectNumber||'');
        if(!projData[p.projectName])projData[p.projectName]={};
        opItems.forEach(item=>{
          const v=Number(p.items?.[item])||0;
          if(v>0){if(!projData[p.projectName][item])projData[p.projectName][item]={};projData[p.projectName][item][d]=(projData[p.projectName][item][d]||0)+v;}
        });
      });
    }
    const nonOpD={};
    for(let d=1;d<=td;d++){
      const day=mData.days[d];if(!day)continue;
      Object.entries(day.nonOperations||{}).forEach(([item,min])=>{
        const v=Number(min)||0;
        if(v>0){if(!nonOpD[item])nonOpD[item]={};nonOpD[item][d]=(nonOpD[item][d]||0)+v;}
      });
    }
    // Build rows
    const rows=[],merges=[];let rowIdx=0;
    function addRow(ht,cells){rows.push({ht,cells});rowIdx++;}
    function addMerge(r1,c1,r2,c2){merges.push({r1,c1,r2,c2});}
    function cell(c,v,t,s){return{c,v,t,s};}
    function strCell(c,v,s){return{c,v:v??'',t:'s',s};}
    function numCell(c,v,s){return v?{c,v,t:'n',s}:{c,v:'',t:'s',s};}
    function emptyRange(c1,c2,s){const a=[];for(let c=c1;c<=c2;c++)a.push(strCell(c,'',s));return a;}

    // ROW 1: Title
    addRow(22,[strCell(C_A,'PROGRAMMER Man Hour',S.HDR_TITLE),...emptyRange(C_PN,C_LNOTE,S.HDR_TITLE)]);
    addMerge(0,0,0,C_LNOTE);

    // ROW 2: Nama/NPK/Month
    addRow(18,[strCell(C_A,'',S.DEFAULT),strCell(C_PN,'Nama',S.HDR_INFO),strCell(C_NAME,db.profile?.name||'',S.HDR_VAL),
      strCell(C_NOTE,'',S.HDR_VAL),strCell(C_NO,'',S.HDR_VAL),strCell(C_ITEM,'NPK',S.HDR_INFO),
      strCell(C_D1,db.profile?.npk||'',S.HDR_VAL),strCell(C_D1+1,'',S.HDR_VAL),strCell(C_D1+2,'',S.DEFAULT),
      strCell(C_D1+3,'Month',S.HDR_INFO),strCell(C_D1+4,monthShort,S.HDR_VAL),
      ...emptyRange(C_D1+5,C_LNOTE,S.DEFAULT)]);
    addMerge(1,C_NAME,1,C_NO);addMerge(1,C_D1,1,C_D1+1);addMerge(1,C_D1+4,1,C_D1+6);

    // ROW 3: blank
    addRow(6,[]);

    // ROW 4: column headers
    const r4=[strCell(C_A,'',S.COL_HDR),strCell(C_PN,'Project\nNumber',S.COL_HDR),strCell(C_NAME,'Project Name',S.COL_HDR),
      strCell(C_NOTE,'Note',S.COL_HDR),strCell(C_NO,'No.',S.COL_HDR),strCell(C_ITEM,'Item Pekerjaan',S.COL_HDR)];
    for(let d=1;d<=td;d++) r4.push({c:C_D1+d-1,v:d,t:'n',s:isWkd(d)?S.DATE_HDR_WKD:S.DATE_HDR});
    r4.push(strCell(C_TOTAL,'Total\nHour',S.COL_HDR),strCell(C_LNOTE,'Note',S.COL_HDR));
    addRow(20,r4);
    addMerge(3,C_NOTE,4,C_NOTE);addMerge(3,C_NO,4,C_NO);

    // ROW 5: day name headers
    const r5=[strCell(C_A,'',S.COL_HDR),strCell(C_PN,'',S.COL_HDR),strCell(C_NAME,'',S.COL_HDR),
      strCell(C_NOTE,'',S.COL_HDR),strCell(C_NO,'',S.COL_HDR),strCell(C_ITEM,'',S.COL_HDR)];
    for(let d=1;d<=td;d++) r5.push(strCell(C_D1+d-1,dAbbr(d),isWkd(d)?S.DAY_HDR_WKD:S.DAY_HDR));
    r5.push(strCell(C_TOTAL,'',S.COL_HDR),strCell(C_LNOTE,'',S.COL_HDR));
    addRow(16,r5);
    [C_A,C_PN,C_NAME,C_TOTAL,C_LNOTE].forEach(c=>addMerge(3,c,4,c));

    // OPERATION PROJECTS
    projOrder.forEach(proj=>{
      const pStart=rowIdx;
      opItems.forEach((item,ii)=>{
        const cells=[strCell(C_A,'',S.PROJ_NOTE)];
        cells.push(ii===0?strCell(C_PN,proj.number||'',S.PROJ_NAME):strCell(C_PN,'',S.PROJ_NAME));
        cells.push(ii===0?strCell(C_NAME,proj.name,S.PROJ_NAME):strCell(C_NAME,'',S.PROJ_NAME));
        cells.push(ii===0?strCell(C_NOTE,'Operation',S.PROJ_NOTE):strCell(C_NOTE,'',S.PROJ_NOTE));
        cells.push({c:C_NO,v:ii+1,t:'n',s:S.ITEM_NO});
        cells.push(strCell(C_ITEM,item,S.ITEM_NAME));
        let rt=0;
        for(let d=1;d<=td;d++){const v=projData[proj.name]?.[item]?.[d]||0;rt+=v;cells.push(numCell(C_D1+d-1,v,isWkd(d)?S.DATA_WKD:S.DATA));}
        cells.push(numCell(C_TOTAL,rt,S.TOT_HR));cells.push(strCell(C_LNOTE,'',S.NOTE));
        addRow(16,cells);
      });
      if(opItems.length>1){
        [C_A,C_PN,C_NAME,C_NOTE].forEach(c=>addMerge(pStart,c,pStart+opItems.length-1,c));
      }
    });

    // NON-OPERATION
    const nStart=rowIdx;
    nonOpItems.forEach((item,ii)=>{
      const ls=ii===0?S.NONOP_LBL:S.NONOP_ITEM;
      const cells=[strCell(C_A,'',ls),strCell(C_PN,'',ls),strCell(C_NAME,'',ls),
        ii===0?strCell(C_NOTE,'Non\nOperation',ls):strCell(C_NOTE,'',ls),
        strCell(C_NO,'',ls),strCell(C_ITEM,item,S.NONOP_ITEM)];
      let rt=0;
      for(let d=1;d<=td;d++){const v=nonOpD[item]?.[d]||0;rt+=v;cells.push(numCell(C_D1+d-1,v,isWkd(d)?S.NONOP_DATA_WKD:S.NONOP_DATA));}
      cells.push(numCell(C_TOTAL,rt,S.NONOP_ITEM));cells.push(strCell(C_LNOTE,'',S.NOTE));
      addRow(16,cells);
    });
    if(nonOpItems.length>1)[C_A,C_PN,C_NAME,C_NOTE].forEach(c=>addMerge(nStart,c,nStart+nonOpItems.length-1,c));

    // NWT ROW
    {
      const cells=[strCell(C_A,'',S.NWT_LBL),strCell(C_PN,'',S.NWT_LBL),strCell(C_NAME,'Normal Working Time',S.NWT_LBL),
        strCell(C_NOTE,'',S.NWT_LBL),strCell(C_NO,'',S.NWT_LBL),{c:C_ITEM,v:db.nwt||480,t:'n',s:S.NWT_VAL},
        strCell(C_D1,'Tanggal Input Laporan Harian',S.NWT_LBL)];
      addMerge(rowIdx,C_NAME,rowIdx,C_NO);addMerge(rowIdx,C_D1,rowIdx,C_D1+4);
      for(let d=2;d<=td;d++)cells.push(strCell(C_D1+d-1,'',S.NWT_LBL));
      cells.push(strCell(C_TOTAL,'',S.NWT_LBL),strCell(C_LNOTE,'',S.NOTE));
      addRow(18,cells);
    }
    // PARAF ROWS
    [`Paraf Leader (${mData.parafLeader||'___'})`,`Paraf Foreman (${mData.parafForeman||'___'})`].forEach(lbl=>{
      const cells=[strCell(C_A,'',S.DEFAULT),strCell(C_PN,'',S.DEFAULT),strCell(C_NAME,'',S.DEFAULT),
        strCell(C_NOTE,'',S.DEFAULT),strCell(C_NO,'',S.DEFAULT),strCell(C_ITEM,lbl,S.PARAF)];
      addMerge(rowIdx,C_ITEM,rowIdx,C_ITEM+3);
      for(let d=1;d<=td;d++)cells.push(strCell(C_D1+d-1,'',S.DEFAULT));
      cells.push(strCell(C_TOTAL,'',S.DEFAULT),strCell(C_LNOTE,'',S.DEFAULT));
      addRow(16,cells);
    });
    // DAY TOTALS
    const dOp={},dNon={};
    for(let d=1;d<=td;d++){
      const day=mData.days[d];
      dOp[d]=day?(day.operations||[]).reduce((s,p)=>s+Object.values(p.items||{}).reduce((a,b)=>a+(Number(b)||0),0),0):0;
      dNon[d]=day?Object.values(day.nonOperations||{}).reduce((a,b)=>a+(Number(b)||0),0):0;
    }
    const totOp=Object.values(dOp).reduce((a,b)=>a+b,0);
    const totNon=Object.values(dNon).reduce((a,b)=>a+b,0);
    const totAll=totOp+totNon;
    const sumRows=[
      {lbl:'Total Operational',ls:S.TOT_LBL,vs:S.TOT_VAL,fn:(d)=>dOp[d]||'',tot:totOp,tls:S.TOT_LBL,tvs:S.TOT_VAL},
      {lbl:'Total Non Operational',ls:S.TOT_LBL,vs:S.TOT_VAL,fn:(d)=>dNon[d]||'',tot:totNon,tls:S.TOT_LBL,tvs:S.TOT_VAL},
      {lbl:'Total Jam Kerja',ls:S.TOTALL_LBL,vs:S.TOTALL_VAL,fn:(d)=>(dOp[d]||0)+(dNon[d]||0)||'',tot:totAll,tls:S.TOTALL_LBL,tvs:S.TOTALL_VAL},
      {lbl:'Operation Ratio',ls:S.RATIO_LBL,vs:S.RATIO_VAL,fn:(d)=>{const op=dOp[d]||0,t=(dOp[d]||0)+(dNon[d]||0);return t>0?+(op/t).toFixed(4):'';},tot:totAll>0?+(totOp/totAll).toFixed(4):'',tls:S.RATIO_LBL,tvs:S.RATIO_VAL},
      {lbl:'Overtime',ls:S.OT_LBL,vs:S.OT_VAL,fn:(d)=>{const t=(dOp[d]||0)+(dNon[d]||0);const tgt=mData.days[d]?(Number(mData.days[d].target)||db.nwt||480):db.nwt||480;return t>0?t-tgt:'';},tot:'',tls:S.OT_LBL,tvs:S.OT_VAL},
      {lbl:'Cuti/Sakit/Flexible Day',ls:S.CUTI_LBL,vs:S.DEFAULT,fn:()=>'',tot:'',tls:S.CUTI_LBL,tvs:S.DEFAULT},
    ];
    sumRows.forEach(sr=>{
      const cells=[strCell(C_A,'',sr.ls),strCell(C_PN,'',sr.ls),strCell(C_NAME,'',sr.ls),
        strCell(C_NOTE,'',sr.ls),strCell(C_NO,'',sr.ls),strCell(C_ITEM,sr.lbl,sr.ls)];
      addMerge(rowIdx,C_NAME,rowIdx,C_NO);
      for(let d=1;d<=td;d++){const v=sr.fn(d);cells.push(v!==''&&typeof v==='number'?{c:C_D1+d-1,v,t:'n',s:sr.vs}:strCell(C_D1+d-1,v===''?'':String(v),sr.vs));}
      cells.push(sr.tot!==''&&typeof sr.tot==='number'?{c:C_TOTAL,v:sr.tot,t:'n',s:sr.tvs}:strCell(C_TOTAL,'',sr.tvs));
      cells.push(strCell(C_LNOTE,'',S.DEFAULT));
      addRow(16,cells);
    });

    // Serialize XML
    let xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`+
      `<sheetFormatPr defaultRowHeight="16" customHeight="1"/>`+
      `<cols>`+
      `<col min="1" max="1" width="3" customWidth="1"/>`+
      `<col min="2" max="2" width="12" customWidth="1"/>`+
      `<col min="3" max="3" width="22" customWidth="1"/>`+
      `<col min="4" max="4" width="10" customWidth="1"/>`+
      `<col min="5" max="5" width="4" customWidth="1"/>`+
      `<col min="6" max="6" width="26" customWidth="1"/>`+
      `<col min="7" max="${6+td}" width="5" customWidth="1"/>`+
      `<col min="${7+td}" max="${7+td}" width="7" customWidth="1"/>`+
      `<col min="${8+td}" max="${8+td}" width="15" customWidth="1"/>`+
      `</cols><sheetData>`;
    rows.forEach((row,ri)=>{
      if(!row.cells.length){xml+=`<row r="${ri+1}" ht="${row.ht}" customHeight="1"/>`;return;}
      xml+=`<row r="${ri+1}" ht="${row.ht}" customHeight="1">`;
      row.cells.forEach(cell=>{
        const ref=cr(ri,cell.c),s=cell.s??0;
        if(cell.v===''||cell.v==null){xml+=`<c r="${ref}" s="${s}"/>`;return;}
        if(cell.t==='n'){xml+=`<c r="${ref}" t="n" s="${s}"><v>${cell.v}</v></c>`;}
        else{const idx=rSS(String(cell.v));if(idx<0){xml+=`<c r="${ref}" s="${s}"/>`;return;}xml+=`<c r="${ref}" t="s" s="${s}"><v>${idx}</v></c>`;}
      });
      xml+=`</row>`;
    });
    xml+=`</sheetData>`;
    if(merges.length){xml+=`<mergeCells count="${merges.length}">`+merges.map(m=>`<mergeCell ref="${cr(m.r1,m.c1)}:${cr(m.r2,m.c2)}"/>`).join('')+`</mergeCells>`;}
    xml+=`<pageSetup orientation="landscape" paperSize="9" fitToPage="1" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    const ssXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ssi}" uniqueCount="${ssi}">${[...allSS.entries()].sort((a,b)=>a[1]-b[1]).map(([s])=>`<si><t xml:space="preserve">${xe(s)}</t></si>`).join('')}</sst>`;
    return{sheetXml:xml,ssXml};
  }

  function buildLaporan(db,period){
    const{sheetXml:ws1,ssXml}=buildManHourSheet(db,period);
    const dbData=[["period","day","type","project_number","project_name","item","minutes","target","note"]];
    Object.entries(db.months||{}).forEach(([p,mm])=>Object.entries(mm.days||{}).forEach(([d,day])=>{
      const tg=day.target||'';
      (day.operations||[]).forEach(pr=>Object.entries(pr.items||{}).forEach(([item,min])=>{if(Number(min)>0)dbData.push([p,+d,'OP',pr.projectNumber||'',pr.projectName,item,+min,tg,day.note||'']);}));
      Object.entries(day.nonOperations||{}).forEach(([item,min])=>{if(Number(min)>0)dbData.push([p,+d,'NONOP','','',item,+min,tg,day.note||'']);});
    }));
    // Merge shared strings: ws1 has its own ssXml, database sheet needs additional strings
    // Parse ssXml strings
    const existSS=new Map();let ei=0;
    [...ssXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].forEach(m=>{
      const s=m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
      existSS.set(s,ei++);
    });
    // Add db strings
    dbData.forEach(row=>row.forEach(cell=>{if(cell!=null&&typeof cell==='string'&&cell!==''&&!existSS.has(cell))existSS.set(cell,ei++);}));
    const uniSS=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ei}" uniqueCount="${ei}">${[...existSS.entries()].sort((a,b)=>a[1]-b[1]).map(([s])=>`<si><t xml:space="preserve">${xe(s)}</t></si>`).join('')}</sst>`;
    // Build ws2 using unified SS
    function cr2(r,c){const col=c<26?String.fromCharCode(65+c):(String.fromCharCode(64+Math.floor(c/26))+String.fromCharCode(65+c%26));return col+(r+1);}
    let ws2=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`;
    dbData.forEach((row,ri)=>{
      const cells=row.map((cell,ci)=>{if(cell==null||cell==='')return'';const ref=cr2(ri,ci);if(typeof cell==='number')return`<c r="${ref}" t="n"><v>${cell}</v></c>`;const idx=existSS.get(String(cell));if(idx==null)return'';return`<c r="${ref}" t="s"><v>${idx}</v></c>`;}).join('');
      if(cells)ws2+=`<row r="${ri+1}">${cells}</row>`;
    });
    ws2+=`</sheetData></worksheet>`;
    const wbXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Man Hour" sheetId="1" r:id="rId2"/><sheet name="Database" sheetId="2" r:id="rId3"/></sheets></workbook>`;
    const wbRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    return zipFiles({'[Content_Types].xml':ct,'_rels/.rels':rootRels,'xl/workbook.xml':wbXml,'xl/_rels/workbook.xml.rels':wbRels,'xl/sharedStrings.xml':uniSS,'xl/styles.xml':buildStyles(),'xl/worksheets/sheet1.xml':ws1,'xl/worksheets/sheet2.xml':ws2});
  }

  // Backward compat
  function writeSheets(sheets){
    const ss=new Map();let si=0;
    sheets.forEach(sh=>sh.data.forEach(row=>row&&row.forEach(cell=>{if(cell!=null&&typeof cell==='string'&&cell!==''&&!ss.has(cell))ss.set(cell,si++);})));
    function cr2(r,c){const col=c<26?String.fromCharCode(65+c):(String.fromCharCode(64+Math.floor(c/26))+String.fromCharCode(65+c%26));return col+(r+1);}
    function aoaXml(aoa){let xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`;aoa.forEach((row,ri)=>{if(!row||!row.length)return;const cells=row.map((cell,ci)=>{if(cell==null||cell==='')return'';const ref=cr2(ri,ci);if(typeof cell==='number')return`<c r="${ref}" t="n"><v>${cell}</v></c>`;const idx=ss.get(String(cell));if(idx==null)return'';return`<c r="${ref}" t="s"><v>${idx}</v></c>`;}).join('');if(cells)xml+=`<row r="${ri+1}">${cells}</row>`;});return xml+'</sheetData></worksheet>';}
    const sXmls=sheets.map(sh=>aoaXml(sh.data));
    const ssXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${si}" uniqueCount="${si}">${[...ss.entries()].sort((a,b)=>a[1]-b[1]).map(([s])=>`<si><t xml:space="preserve">${xe(s)}</t></si>`).join('')}</sst>`;
    const wbXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xe(s.name)}" sheetId="${i+1}" r:id="rId${i+2}"/>`).join('')}</sheets></workbook>`;
    const wbRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>${sheets.map((s,i)=>`<Relationship Id="rId${i+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`;
    const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const fm={'[Content_Types].xml':ct,'_rels/.rels':rootRels,'xl/workbook.xml':wbXml,'xl/_rels/workbook.xml.rels':wbRels,'xl/sharedStrings.xml':ssXml};
    sXmls.forEach((xml,i)=>{fm[`xl/worksheets/sheet${i+1}.xml`]=xml;});
    return zipFiles(fm);
  }
  return{buildLaporan,writeSheets};
})();
