import { $ } from './ui-helpers.js';

export const WHOLE_CLASS='whole_class';
export const NON_SEN='non_sen';

const LABELS={
  [WHOLE_CLASS]:'Whole Class (including SEN)',
  [NON_SEN]:'Non-SEN pupils only'
};

function createPopulationField(selectId){
  const field=document.createElement('div');
  field.className='field';
  const label=document.createElement('label');
  label.htmlFor=selectId;
  label.textContent='Population';
  const select=document.createElement('select');
  select.id=selectId;
  select.innerHTML='<option value="whole_class">Whole Class (including SEN)</option><option value="non_sen">Non-SEN pupils only</option>';
  field.append(label,select);
  return field;
}

export function initReportingPopulationSelectors(){
  const dashboardControls=$('dashboardMonth').closest('.controls');
  const statsControls=$('statsMonth').closest('.controls');
  const reportControls=$('reportType').closest('.controls');
  if(!$('dashboardPopulation'))dashboardControls.appendChild(createPopulationField('dashboardPopulation'));
  if(!$('statsPopulation'))statsControls.appendChild(createPopulationField('statsPopulation'));
  if(!$('reportPopulation'))reportControls.appendChild(createPopulationField('reportPopulation'));
}

export function reportingPopulation(selectId){
  return $(selectId)?.value===NON_SEN?NON_SEN:WHOLE_CLASS;
}

export function reportingPopulationLabel(population){
  return LABELS[population]||LABELS[WHOLE_CLASS];
}
