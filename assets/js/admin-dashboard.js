import { state, beginRequest, isLatestRequest } from './app-state.js';
import { displayDate, formatMonthLabel } from './date-helpers.js';
import { $, esc } from './ui-helpers.js';
import { NON_SEN, reportingPopulation, reportingPopulationLabel } from './reporting-population.js';

let sb;
let schoolId;
let openStatisticsForClass;

export function initAdminDashboard(client,helpers){
  sb=client;
  schoolId=helpers.schoolId;
  openStatisticsForClass=helpers.openStatisticsForClass;
}

function setDashboardBanner(text,type='info'){const el=$('dashboardBanner');el.textContent=text;el.className='banner '+type;}
export async function loadAdminDashboard(){
  const sid=schoolId(),month=$('dashboardMonth').value,population=reportingPopulation('dashboardPopulation');if(!sid||!month)return;
  const serial=beginRequest('adminDashboard'),selectionKey=sid+'|'+month+'|'+population;
  $('refreshDashboardBtn').disabled=true;setDashboardBanner('Loading '+reportingPopulationLabel(population)+' school dashboard…','info');
  const rpcName=population===NON_SEN?'attendance_admin_school_dashboard_v2':'attendance_admin_school_dashboard';
  const args={p_school_id:sid,p_month:month+'-01'};
  if(population===NON_SEN)args.p_population=population;
  const {data,error}=await sb.rpc(rpcName,args);
  if(!isLatestRequest('adminDashboard',serial)||(schoolId()+'|'+$('dashboardMonth').value+'|'+reportingPopulation('dashboardPopulation'))!==selectionKey)return;
  $('refreshDashboardBtn').disabled=false;
  if(error){state.adminDashboard=null;setDashboardBanner(error.message,'warn');renderAdminDashboard();return;}
  state.adminDashboard=data?{...data,population:data.population||population}:data;renderAdminDashboard();
}
function renderAdminDashboard(){
  const data=state.adminDashboard,s=data?.summary||{},latest=data?.latest_school_day||{};
  $('dashboardMonthLabel').textContent=data?formatMonthLabel(data.month):'';
  $('dashboardCumulative').textContent=data?s.cumulative_total:'—';
  $('dashboardAverage').textContent=data&&s.average_attendance!=null?Number(s.average_attendance).toFixed(4):'—';
  $('dashboardPercent').textContent=data&&s.attendance_percentage!=null?Number(s.attendance_percentage).toFixed(2)+'%':'—';
  $('dashboardRegisters').textContent=data?(s.registers_completed+'/'+(s.registers_completed+s.registers_missing)):'—';
  $('dashboardLatestDate').textContent=latest.date?displayDate(latest.date):'No school day';
  $('dashboardLatestCompleted').textContent=data?latest.classes_completed:'—';
  $('dashboardLatestMissing').textContent=data?latest.classes_missing:'—';
  $('dashboardClassCount').textContent=data?s.class_count:'—';
  $('dashboardGenderIncomplete').textContent=data?s.gender_incomplete_classes:'—';
  if(data){
    const populationText=reportingPopulationLabel(data.population)+' · ';
    if(s.registers_missing>0)setDashboardBanner(populationText+'Provisional: '+s.registers_missing+' elapsed class register'+(s.registers_missing===1?' is':'s are')+' missing. School average and percentage use completed registers only. A missing register means no saved register was found — not zero attendance.','warn');
    else if(s.provisional)setDashboardBanner(populationText+'Provisional month-to-date school summary through '+displayDate(data.as_of_date)+'.','info');
    else setDashboardBanner(populationText+'Complete school summary for '+formatMonthLabel(data.month)+'.','ok');
  }
  const lb=$('dashboardLatestBody');
  const latestRows=latest.classes||[];
  if(!latestRows.length)lb.innerHTML='<tr><td colspan="4" class="empty-cell">No school-day status is available for this month.</td></tr>';
  else lb.innerHTML=latestRows.map(r=>'<tr class="'+(r.register_exists?'':'missing-row')+'"><td>'+esc(r.class_code)+'</td><td><span class="dashboard-status '+(r.register_exists?'saved':'missing')+'">'+(r.register_exists?'Saved':'Missing')+'</span></td><td>'+(r.register_exists?r.attendance:'—')+'</td><td>'+r.eligible_students+'</td></tr>').join('');

  const cb=$('dashboardClassBody'),rows=data?.classes||[];
  if(!rows.length){cb.innerHTML='<tr><td colspan="7" class="empty-cell">No class summaries are available.</td></tr>';return;}
  cb.innerHTML=rows.map(r=>{
    const totalRegs=r.registers_completed+r.registers_missing;
    return '<tr class="'+(r.registers_missing?'missing-row':'')+'"><td>'+esc(r.class_code)+'</td><td>'+r.pupils+'</td><td>'+r.registers_completed+'/'+totalRegs+'</td><td>'+r.cumulative_total+'</td><td>'+(r.average_attendance==null?'—':Number(r.average_attendance).toFixed(4))+'</td><td>'+(r.attendance_percentage==null?'—':Number(r.attendance_percentage).toFixed(2)+'%')+'</td><td><button class="btn btn-light dashboard-view" data-class="'+esc(r.class_id)+'">View</button></td></tr>';
  }).join('');
  cb.querySelectorAll('.dashboard-view').forEach(b=>b.addEventListener('click',()=>{
    openStatisticsForClass(b.dataset.class,data.month,data.population||'whole_class');
  }));
}
