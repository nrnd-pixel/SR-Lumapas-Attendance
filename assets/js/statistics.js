import { state, beginRequest, isLatestRequest } from './app-state.js';
import { displayDate, formatMonthLabel, shortDay } from './date-helpers.js';
import { $, esc } from './ui-helpers.js';
import { NON_SEN, reportingPopulation, reportingPopulationLabel } from './reporting-population.js';

let sb;

export function initStatistics(client){sb=client;}

function setStatsBanner(text,type='info'){const el=$('statsBanner');el.textContent=text;el.className='banner '+type;}
export async function loadMonthlyStats(){
  const classId=$('statsClassSelect').value,month=$('statsMonth').value,population=reportingPopulation('statsPopulation');if(!classId||!month)return;
  const serial=beginRequest('monthlyStats'),selectionKey=classId+'|'+month+'|'+population;
  $('refreshStatsBtn').disabled=true;setStatsBanner('Loading '+reportingPopulationLabel(population)+' statistics…','info');
  const rpcName=population===NON_SEN?'attendance_monthly_class_stats_v2':'attendance_monthly_class_stats';
  const args={p_class_id:classId,p_month:month+'-01'};
  if(population===NON_SEN)args.p_population=population;
  const {data,error}=await sb.rpc(rpcName,args);
  if(!isLatestRequest('monthlyStats',serial)||($('statsClassSelect').value+'|'+$('statsMonth').value+'|'+reportingPopulation('statsPopulation'))!==selectionKey)return;
  $('refreshStatsBtn').disabled=false;
  if(error){state.monthlyStats=null;setStatsBanner(error.message,'warn');renderMonthlyStats();return;}
  state.monthlyStats=data?{...data,population:data.population||population}:data;renderMonthlyStats();
}
function renderMonthlyStats(){
  const data=state.monthlyStats,s=data?.summary||{},r=data?.roster||{};
  $('statsMonthLabel').textContent=data?formatMonthLabel(data.month):'';
  $('statsCumulative').textContent=data?s.cumulative_total:'—';
  $('statsAverage').textContent=data&&s.average_attendance!=null?Number(s.average_attendance).toFixed(4):'—';
  $('statsPercent').textContent=data&&s.attendance_percentage!=null?Number(s.attendance_percentage).toFixed(2)+'%':'—';
  $('statsSchoolDays').textContent=data?(s.school_days+'/'+s.scheduled_school_days):'—';
  $('statsMale').textContent=data?s.cumulative_male:'—';$('statsFemale').textContent=data?s.cumulative_female:'—';$('statsAll').textContent=data?s.cumulative_total:'—';$('statsPossible').textContent=data?s.possible_attendance:'—';
  $('statsRoster').textContent=data?(r.pupils_seen_in_month+' pupils · '+r.male_pupils+' male · '+r.female_pupils+' female'):'';
  const gb=$('genderStatsBanner');gb.classList.add('hidden');
  if(data&&!r.gender_complete){gb.textContent='Gender is not recorded for '+r.gender_unknown_pupils+' pupil'+(r.gender_unknown_pupils===1?'':'s')+'. Male/female figures include known genders only; Total remains complete.';gb.className='banner warn';gb.classList.remove('hidden');}
  if(data){
    const populationText=reportingPopulationLabel(data.population)+' · ';
    if(s.registers_missing>0)setStatsBanner(populationText+'Provisional: '+s.registers_completed+' of '+s.scheduled_school_days+' elapsed school-day registers are complete. '+s.registers_missing+' register'+(s.registers_missing===1?' is':'s are')+' missing. Average and percentage use completed registers only.','warn');
    else if(s.provisional)setStatsBanner(populationText+'Provisional month-to-date statistics through '+displayDate(data.as_of_date)+'.','info');
    else setStatsBanner(populationText+'Complete monthly statistics · '+s.school_days+' school days · '+s.possible_attendance+' possible pupil-attendances.','ok');
  }
  const body=$('statsDailyBody');
  if(!data){body.innerHTML='<tr><td colspan="7" class="empty-cell">Load statistics to view daily figures.</td></tr>';return;}
  const rows=data.daily||[];if(!rows.length){body.innerHTML='<tr><td colspan="7" class="empty-cell">No school days are available for this month.</td></tr>';return;}
  body.innerHTML=rows.map(d=>'<tr class="'+(d.register_exists?'':'missing-row')+'"><td>'+esc(shortDay(d.date))+(d.register_exists?'':' · Missing')+'</td><td>'+(d.register_exists?d.male_attendance:'—')+'</td><td>'+(d.register_exists?d.female_attendance:'—')+'</td><td>'+(d.register_exists?d.total_attendance:'—')+'</td><td>'+d.cumulative_male+'</td><td>'+d.cumulative_female+'</td><td>'+d.cumulative_total+'</td></tr>').join('');
}
