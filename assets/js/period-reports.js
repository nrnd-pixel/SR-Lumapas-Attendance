import { state, requestSerial, beginRequest, isLatestRequest } from './app-state.js';
import { bruneiToday, displayDate, formatMonthLabel, shortDay } from './date-helpers.js';
import { $, esc } from './ui-helpers.js';

let sb;

export function initPeriodReports(client){sb=client;}

function periodReportSelectionKey(){
  const type=$('reportType').value;
  return [
    $('reportClassSelect').value,
    type,
    type==='term'?$('reportTermSelect').value:'',
    type==='ytd'?$('reportAsOf').value:''
  ].join('|');
}
export function invalidatePeriodReport(){
  requestSerial.periodReport+=1;
  state.periodReport=null;
  renderPeriodReport();
  $('loadReportBtn').disabled=false;
  $('exportReportBtn').disabled=true;
}

function setReportBanner(text,type='info'){const el=$('reportBanner');el.textContent=text;el.className='banner '+type;}
export function syncReportTypeUI(){
  const term=$('reportType').value==='term';
  $('reportTermField').classList.toggle('hidden',!term);
  $('reportAsOfField').classList.toggle('hidden',term);
}
export async function loadReportOptions(){
  const classId=$('reportClassSelect').value;if(!classId)return false;
  const serial=beginRequest('reportOptions');
  state.reportOptions=null;
  $('reportTermSelect').innerHTML='';
  invalidatePeriodReport();
  setReportBanner('Loading reporting periods…','info');
  const {data,error}=await sb.rpc('attendance_class_report_options',{p_class_id:classId});
  if(!isLatestRequest('reportOptions',serial)||$('reportClassSelect').value!==classId)return false;
  if(error){state.reportOptions=null;setReportBanner(error.message,'warn');return false;}
  state.reportOptions=data;
  const terms=data?.terms||[],sel=$('reportTermSelect');
  sel.innerHTML=terms.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.term_name)+' · '+displayDate(t.start_date)+'–'+displayDate(t.end_date)+'</option>').join('');
  const today=bruneiToday(),current=terms.find(t=>today>=t.start_date&&today<=t.end_date)||terms[terms.length-1];
  if(current)sel.value=current.id;
  syncReportTypeUI();setReportBanner('Choose Term or YTD, then load the report.','info');
  return true;
}
export async function loadPeriodReport(){
  const classId=$('reportClassSelect').value,type=$('reportType').value;
  if(!classId)return;
  if(!state.reportOptions||state.reportOptions.class?.id!==classId){
    const optionsReady=await loadReportOptions();
    if(!optionsReady||$('reportClassSelect').value!==classId||$('reportType').value!==type)return;
  }
  const termId=type==='term'?$('reportTermSelect').value:null;
  const asOfDate=type==='ytd'?$('reportAsOf').value:null;
  if(type==='term'&&!termId){setReportBanner('Choose a term.','warn');return;}
  const selectionKey=[classId,type,termId||'',asOfDate||''].join('|');
  const serial=beginRequest('periodReport');
  $('loadReportBtn').disabled=true;$('exportReportBtn').disabled=true;setReportBanner('Loading report…','info');
  const args={p_class_id:classId,p_period_type:type,p_term_id:termId||null,p_as_of_date:asOfDate};
  const {data,error}=await sb.rpc('attendance_class_period_report',args);
  if(!isLatestRequest('periodReport',serial))return;
  if(periodReportSelectionKey()!==selectionKey){$('loadReportBtn').disabled=false;$('exportReportBtn').disabled=true;return;}
  $('loadReportBtn').disabled=false;
  if(error){state.periodReport=null;setReportBanner(error.message,'warn');renderPeriodReport();return;}
  state.periodReport=data;renderPeriodReport();$('exportReportBtn').disabled=false;
}
function renderPeriodReport(){
  const data=state.periodReport,s=data?.summary||{},r=data?.roster||{},p=data?.period||{};
  $('reportPeriodLabel').textContent=data?p.label:'';
  $('reportCumulative').textContent=data?s.cumulative_total:'—';
  $('reportAverage').textContent=data&&s.average_attendance!=null?Number(s.average_attendance).toFixed(4):'—';
  $('reportPercent').textContent=data&&s.attendance_percentage!=null?Number(s.attendance_percentage).toFixed(2)+'%':'—';
  $('reportRegisters').textContent=data?(s.registers_completed+'/'+(s.registers_completed+s.registers_missing)):'—';
  $('reportMale').textContent=data?s.cumulative_male:'—';$('reportFemale').textContent=data?s.cumulative_female:'—';
  $('reportPossible').textContent=data?s.possible_attendance:'—';$('reportSchoolDays').textContent=data?(s.school_days+'/'+s.scheduled_school_days):'—';
  $('reportRoster').textContent=data?(r.pupils_seen+' pupils seen · '+r.male_pupils+' male · '+r.female_pupils+' female'):'';
  const gb=$('reportGenderBanner');gb.classList.add('hidden');
  if(data&&!r.gender_complete){gb.textContent='Gender is missing for '+r.gender_unknown_pupils+' pupil'+(r.gender_unknown_pupils===1?'':'s')+'. Total attendance remains complete; male/female figures include known genders only.';gb.className='banner warn';gb.classList.remove('hidden');}
  if(data){
    if(s.registers_missing>0)setReportBanner('Provisional: '+s.registers_missing+' elapsed register'+(s.registers_missing===1?' is':'s are')+' missing. Average and percentage use completed registers only.','warn');
    else if(s.provisional)setReportBanner('Provisional report through '+displayDate(p.as_of_date)+'.','info');
    else setReportBanner('Complete '+p.label+' report · '+s.school_days+' school days · '+s.possible_attendance+' possible pupil-attendances.','ok');
  }
  const mb=$('reportMonthlyBody'),months=data?.months||[];
  mb.innerHTML=months.length?months.map(m=>'<tr class="'+(m.registers_missing?'missing-row':'')+'"><td>'+esc(formatMonthLabel(m.month))+'</td><td>'+m.registers_completed+'/'+(m.registers_completed+m.registers_missing)+'</td><td>'+m.cumulative_total+'</td><td>'+(m.average_attendance==null?'—':Number(m.average_attendance).toFixed(4))+'</td><td>'+(m.attendance_percentage==null?'—':Number(m.attendance_percentage).toFixed(2)+'%')+'</td></tr>').join(''):'<tr><td colspan="5" class="empty-cell">Load a report to view monthly figures.</td></tr>';
  const db=$('reportDailyBody'),days=data?.daily||[];
  db.innerHTML=days.length?days.map(d=>'<tr class="'+(d.register_exists?'':'missing-row')+'"><td>'+esc(shortDay(d.date))+'</td><td><span class="dashboard-status '+(d.register_exists?'saved':'missing')+'">'+(d.register_exists?'Saved':'Missing')+'</span></td><td>'+(d.register_exists?d.male_attendance:'—')+'</td><td>'+(d.register_exists?d.female_attendance:'—')+'</td><td>'+(d.register_exists?d.total_attendance:'—')+'</td><td>'+d.cumulative_total+'</td></tr>').join(''):'<tr><td colspan="6" class="empty-cell">Load a report to view daily figures.</td></tr>';
}
function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
export function exportPeriodReport(){
  const d=state.periodReport;if(!d)return;
  const s=d.summary||{},p=d.period||{},c=d.class||{},r=d.roster||{};
  const rows=[
    ['SR Lumapas Main Attendance Report'],
    ['Class',c.class_code,c.class_name],
    ['Academic Year',c.year_no],
    ['Period',p.label],
    ['Start Date',p.start_date],['End Date',p.end_date],['As Of',p.as_of_date],
    ['Cumulative Attendance',s.cumulative_total],['Possible Attendance',s.possible_attendance],
    ['Average Attendance Ratio',s.average_attendance],['Attendance Percentage',s.attendance_percentage],
    ['Male Cumulative',s.cumulative_male],['Female Cumulative',s.cumulative_female],
    ['Completed Registers',s.registers_completed],['Missing Registers',s.registers_missing],
    ['Pupils Seen',r.pupils_seen],['Gender Missing',r.gender_unknown_pupils],
    [],
    ['MONTHLY BREAKDOWN'],
    ['Month','Completed Registers','Scheduled/Elapsed Registers','Cumulative Attendance','Possible Attendance','Average Attendance','Attendance %'],
    ...(d.months||[]).map(m=>[m.month,m.registers_completed,m.scheduled_school_days,m.cumulative_total,m.possible_attendance,m.average_attendance,m.attendance_percentage]),
    [],
    ['DAILY BREAKDOWN'],
    ['Date','Register Status','Eligible Pupils','Male Attendance','Female Attendance','Unknown Gender Attendance','Total Attendance','Cumulative Male','Cumulative Female','Cumulative Total'],
    ...(d.daily||[]).map(x=>[x.date,x.register_exists?'Saved':'Missing',x.eligible_students,x.register_exists?x.male_attendance:'',x.register_exists?x.female_attendance:'',x.register_exists?x.unknown_gender_attendance:'',x.register_exists?x.total_attendance:'',x.cumulative_male,x.cumulative_female,x.cumulative_total])
  ];
  const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  const safe=(c.class_code+'_'+p.label).replace(/[^A-Za-z0-9_-]+/g,'_');
  a.href=url;a.download='SRL_Attendance_'+safe+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
