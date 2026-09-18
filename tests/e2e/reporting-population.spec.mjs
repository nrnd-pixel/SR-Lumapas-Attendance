import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { openAuthorized, syntheticClass } from './harness.mjs';

const classes=[
  syntheticClass(),
  syntheticClass({id:'class-3b',class_code:'3B',class_name:'Year 3B'})
];

function wholeFebruary(){
  return {
    month:'2026-02',as_of_date:'2026-02-28',
    summary:{cumulative_total:398,average_attendance:0.9365,attendance_percentage:93.65,school_days:17,scheduled_school_days:17,cumulative_male:214,cumulative_female:184,possible_attendance:425,registers_missing:0,registers_completed:17,provisional:false},
    roster:{pupils_seen_in_month:25,male_pupils:14,female_pupils:11,gender_complete:true,gender_unknown_pupils:0},
    daily:[{date:'2026-02-02',register_exists:true,male_attendance:12,female_attendance:11,total_attendance:23,cumulative_male:12,cumulative_female:11,cumulative_total:23}]
  };
}

function nonSenFebruary(){
  return {
    ...wholeFebruary(),population:'non_sen',
    summary:{...wholeFebruary().summary,cumulative_total:392,average_attendance:0.9608,attendance_percentage:96.08,cumulative_male:208,cumulative_female:184,possible_attendance:408},
    roster:{pupils_seen_in_month:24,male_pupils:13,female_pupils:11,gender_complete:true,gender_unknown_pupils:0}
  };
}

function nonSenMissingFebruary(){
  return {
    population:'non_sen',month:'2026-02',as_of_date:'2026-02-05',
    summary:{cumulative_total:86,average_attendance:0.9149,attendance_percentage:91.49,school_days:4,scheduled_school_days:5,cumulative_male:42,cumulative_female:44,possible_attendance:94,registers_missing:1,registers_completed:4,provisional:true},
    roster:{pupils_seen_in_month:24,male_pupils:13,female_pupils:11,gender_complete:true,gender_unknown_pupils:0},
    daily:[
      {date:'2026-02-04',register_exists:true,male_attendance:10,female_attendance:10,total_attendance:20,cumulative_male:42,cumulative_female:44,cumulative_total:86},
      {date:'2026-02-05',register_exists:false,male_attendance:null,female_attendance:null,total_attendance:null,cumulative_male:42,cumulative_female:44,cumulative_total:86}
    ]
  };
}

function dashboard(population='whole_class'){
  const nonSen=population==='non_sen';
  return {
    ...(nonSen?{population:'non_sen'}:{}),month:'2026-02',as_of_date:'2026-02-28',
    summary:{cumulative_total:nonSen?740:760,average_attendance:nonSen?0.95:0.93,attendance_percentage:nonSen?95:93,registers_completed:34,registers_missing:0,class_count:15,gender_incomplete_classes:0,provisional:false},
    latest_school_day:{date:'2026-02-03',classes_completed:15,classes_missing:0,classes:[{class_id:'class-3a',class_code:'3A',register_exists:true,attendance:nonSen?22:24,eligible_students:nonSen?24:25}]},
    classes:[{class_id:'class-3a',class_code:'3A',pupils:nonSen?24:25,registers_completed:17,registers_missing:0,cumulative_total:nonSen?392:398,average_attendance:nonSen?0.9608:0.9365,attendance_percentage:nonSen?96.08:93.65}]
  };
}

function reportOptions(){
  return {class:{id:'class-3a',class_code:'3A',class_name:'Year 3A',year_no:2026},terms:[{id:'term-1',term_name:'Term 1',start_date:'2026-01-03',end_date:'2026-03-12'}]};
}

function wholeTerm(){
  return {
    class:{id:'class-3a',class_code:'3A',class_name:'Year 3A',year_no:2026},
    period:{type:'term',label:'Term 1',start_date:'2026-01-03',end_date:'2026-03-12',as_of_date:'2026-03-12'},
    summary:{cumulative_total:1051,possible_attendance:1125,average_attendance:0.9342,attendance_percentage:93.42,cumulative_male:567,cumulative_female:484,registers_completed:45,registers_missing:0,school_days:45,scheduled_school_days:45,provisional:false},
    roster:{pupils_seen:25,male_pupils:14,female_pupils:11,gender_complete:true,gender_unknown_pupils:0},
    months:[{month:'2026-02',registers_completed:17,registers_missing:0,scheduled_school_days:17,cumulative_total:398,possible_attendance:425,average_attendance:0.9365,attendance_percentage:93.65}],
    daily:[{date:'2026-02-02',register_exists:true,eligible_students:25,male_attendance:12,female_attendance:11,unknown_gender_attendance:0,total_attendance:23,cumulative_male:12,cumulative_female:11,cumulative_total:23}]
  };
}

function nonSenTerm(){
  const data=wholeTerm();
  return {
    ...data,population:'non_sen',
    summary:{...data.summary,cumulative_total:1036,possible_attendance:1080,average_attendance:0.9593,attendance_percentage:95.93,cumulative_male:552,cumulative_female:484},
    roster:{pupils_seen:24,male_pupils:13,female_pupils:11,gender_complete:true,gender_unknown_pupils:0},
    months:[{...data.months[0],cumulative_total:392,possible_attendance:408,average_attendance:0.9608,attendance_percentage:96.08}],
    daily:[{...data.daily[0],eligible_students:24,total_attendance:22,male_attendance:11,cumulative_male:11,cumulative_total:22}]
  };
}

test('reporting population selectors exist and default to Whole Class',async({page})=>{
  const harness=await openAuthorized(page,{admin:true,classes});
  await expect(page.locator('#dashboardPopulation')).toHaveValue('whole_class');
  await expect(page.locator('#statsPopulation')).toHaveValue('whole_class');
  await expect(page.locator('#reportPopulation')).toHaveValue('whole_class');
  await expect(page.locator('#statsPopulation option')).toHaveText(['Whole Class (including SEN)','Non-SEN pupils only']);
  await harness.expectNoProductionRequests();
});

test('3A February Non-SEN statistics use v2 and preserve 392 over 408 at 96.08 percent',async({page})=>{
  const harness=await openAuthorized(page,{admin:true,classes,extraRpc:{
    attendance_monthly_class_stats:wholeFebruary(),
    attendance_monthly_class_stats_v2:nonSenFebruary()
  }});
  await page.locator('#statisticsTabBtn').click();
  await expect(page.locator('#statsCumulative')).toHaveText('398');
  await page.locator('#statsPopulation').selectOption('non_sen');
  await expect(page.locator('#statsCumulative')).toHaveText('392');
  await expect(page.locator('#statsPossible')).toHaveText('408');
  await expect(page.locator('#statsAverage')).toHaveText('0.9608');
  await expect(page.locator('#statsPercent')).toHaveText('96.08%');
  await expect(page.locator('#statsRoster')).toHaveText('24 pupils · 13 male · 11 female');
  await expect(page.locator('#statsBanner')).toContainText('Non-SEN pupils only');
  const calls=await harness.calls();
  const v2=calls.rpc.find(call=>call.name==='attendance_monthly_class_stats_v2');
  expect(v2.args).toEqual({p_class_id:'class-3a',p_month:'2026-02-01',p_population:'non_sen'});
  await harness.expectNoProductionRequests();
});

test('population is part of monthly stale-response protection',async({page})=>{
  const harness=await openAuthorized(page,{admin:true,classes,extraRpc:{
    attendance_monthly_class_stats:{__defer:'whole-old',response:wholeFebruary()},
    attendance_monthly_class_stats_v2:nonSenFebruary()
  }});
  await page.locator('#statisticsTabBtn').click();
  await expect.poll(()=>harness.pendingRpcLabels()).toContain('whole-old');
  await page.locator('#statsPopulation').selectOption('non_sen');
  await expect(page.locator('#statsCumulative')).toHaveText('392');
  await harness.releaseRpc('whole-old');
  await expect(page.locator('#statsPopulation')).toHaveValue('non_sen');
  await expect(page.locator('#statsCumulative')).toHaveText('392');
  await expect(page.locator('#statsPossible')).toHaveText('408');
  await harness.expectNoProductionRequests();
});

test('Non-SEN monthly statistics preserve missing-register safeguards',async({page})=>{
  const harness=await openAuthorized(page,{admin:true,classes,extraRpc:{
    attendance_monthly_class_stats:wholeFebruary(),
    attendance_monthly_class_stats_v2:nonSenMissingFebruary()
  }});
  await page.locator('#statisticsTabBtn').click();
  await page.locator('#statsPopulation').selectOption('non_sen');
  await expect(page.locator('#statsBanner')).toContainText('1 register is missing');
  await expect(page.locator('#statsBanner')).toContainText('completed registers only');
  const missing=page.locator('#statsDailyBody tr.missing-row');
  await expect(missing).toContainText('Missing');
  await expect(missing.locator('td').nth(3)).toHaveText('—');
  await expect(missing.locator('td').nth(6)).toHaveText('86');
  await harness.expectNoProductionRequests();
});

test('Non-SEN dashboard uses v2, keeps 15-class scope, and carries population into Statistics',async({page})=>{
  const harness=await openAuthorized(page,{admin:true,classes,extraRpc:{
    attendance_admin_school_dashboard:dashboard('whole_class'),
    attendance_admin_school_dashboard_v2:dashboard('non_sen'),
    attendance_monthly_class_stats_v2:nonSenFebruary()
  }});
  await page.locator('#dashboardTabBtn').click();
  await page.locator('#dashboardPopulation').selectOption('non_sen');
  await expect(page.locator('#dashboardClassCount')).toHaveText('15');
  await expect(page.locator('#dashboardBanner')).toContainText('Non-SEN pupils only');
  await page.locator('#dashboardClassBody .dashboard-view').click();
  await expect(page.locator('#statisticsPanel')).toBeVisible();
  await expect(page.locator('#statsPopulation')).toHaveValue('non_sen');
  await expect(page.locator('#statsClassSelect')).toHaveValue('class-3a');
  await expect(page.locator('#statsCumulative')).toHaveText('392');
  const calls=await harness.calls();
  const dashV2=calls.rpc.find(call=>call.name==='attendance_admin_school_dashboard_v2');
  expect(dashV2.args).toEqual({p_school_id:'school-test',p_month:'2026-02-01',p_population:'non_sen'});
  await harness.expectNoProductionRequests();
});

test('3A Term 1 Non-SEN report uses v2 and CSV records the selected population',async({page})=>{
  const harness=await openAuthorized(page,{admin:true,classes,extraRpc:{
    attendance_class_report_options:reportOptions(),
    attendance_class_period_report_v2:nonSenTerm()
  }});
  await page.locator('#reportsTabBtn').click();
  await expect(page.locator('#reportTermSelect')).toHaveValue('term-1');
  await page.locator('#reportPopulation').selectOption('non_sen');
  await expect(page.locator('#exportReportBtn')).toBeDisabled();
  await page.locator('#loadReportBtn').click();
  await expect(page.locator('#reportCumulative')).toHaveText('1036');
  await expect(page.locator('#reportPossible')).toHaveText('1080');
  await expect(page.locator('#reportAverage')).toHaveText('0.9593');
  await expect(page.locator('#reportPercent')).toHaveText('95.93%');
  await expect(page.locator('#reportRoster')).toContainText('24 pupils seen');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportReportBtn').click()]);
  expect(download.suggestedFilename()).toBe('SRL_Attendance_3A_Term_1_non_sen.csv');
  const path=await download.path();
  expect(path).not.toBeNull();
  const csv=await readFile(path,'utf8');
  expect(csv).toContain('Reporting Population,Non-SEN pupils only');
  expect(csv).toContain('Population Key,non_sen');
  expect(csv).toContain('Cumulative Attendance,1036');
  expect(csv).toContain('Possible Attendance,1080');
  const calls=await harness.calls();
  const v2=calls.rpc.find(call=>call.name==='attendance_class_period_report_v2');
  expect(v2.args).toEqual({p_class_id:'class-3a',p_period_type:'term',p_term_id:'term-1',p_as_of_date:null,p_population:'non_sen'});
  await harness.expectNoProductionRequests();
});

test('changing reporting population invalidates a loaded report and disables CSV until reload',async({page})=>{
  const harness=await openAuthorized(page,{admin:true,classes,extraRpc:{
    attendance_class_report_options:reportOptions(),
    attendance_class_period_report:wholeTerm()
  }});
  await page.locator('#reportsTabBtn').click();
  await page.locator('#loadReportBtn').click();
  await expect(page.locator('#reportCumulative')).toHaveText('1051');
  await expect(page.locator('#exportReportBtn')).toBeEnabled();
  await page.locator('#reportPopulation').selectOption('non_sen');
  await expect(page.locator('#reportPeriodLabel')).toHaveText('');
  await expect(page.locator('#reportCumulative')).toHaveText('—');
  await expect(page.locator('#reportPossible')).toHaveText('—');
  await expect(page.locator('#loadReportBtn')).toBeEnabled();
  await expect(page.locator('#exportReportBtn')).toBeDisabled();
  await harness.expectNoProductionRequests();
});
