export function bruneiToday(){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Brunei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const o={}; parts.forEach(p=>o[p.type]=p.value); return o.year+'-'+o.month+'-'+o.day;
}
export function displayDate(s){
  if(!s)return'';
  const [y,m,d]=s.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})
    .format(new Date(Date.UTC(y,m-1,d)));
}
export function formatMonthLabel(v){if(!v)return'';const [y,m]=v.split('-').map(Number);return new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1)));}
export function shortDay(v){if(!v)return'';const [y,m,d]=v.split('-').map(Number);return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));}
