// Domain vocabulary for patient-safety near-miss reports.
// Kept deliberately readable: safety teams should be able to review and extend it.

/** Reason's Swiss cheese layers, outermost (latent) to innermost (active). */
export const LAYERS = [
  { id: 'organisation', label: 'Organisational influences', short: 'Organisation' },
  { id: 'supervision', label: 'Supervision & teamwork', short: 'Supervision' },
  { id: 'preconditions', label: 'Preconditions (environment, equipment, fatigue)', short: 'Preconditions' },
  { id: 'acts', label: 'Unsafe acts (slips, lapses, mistakes)', short: 'Unsafe acts' },
];

/** Incident categories. Highest keyword score wins. */
export const CATEGORIES = [
  {
    id: 'infusion',
    label: 'Infusion / IV pump',
    keywords: ['infusion', 'pump', 'syringe driver', 'ml/hr', 'ml/h', 'rate', 'iv line', 'drip', 'pca', 'bolus'],
  },
  {
    id: 'medication',
    label: 'Medication',
    keywords: ['dose', 'drug', 'medication', 'medicine', 'tablet', 'vial', 'ampoule', 'prescription', 'prescribed', 'mar chart', 'pharmacy', 'administered', 'insulin', 'heparin', 'potassium', 'morphine', 'antibiotic'],
  },
  {
    id: 'specimen',
    label: 'Specimen / lab labelling',
    keywords: ['specimen', 'sample', 'blood sample', 'label', 'labelled', 'mislabelled', 'unlabelled', 'tube', 'lab', 'laboratory', 'sticker'],
  },
  {
    id: 'identification',
    label: 'Patient identification',
    keywords: ['wristband', 'wrong patient', 'identity', 'identification', 'same name', 'similar name', 'id band'],
  },
  {
    id: 'falls',
    label: 'Falls',
    keywords: ['fall', 'fell', 'slipped', 'found on floor', 'bed rail', 'bed alarm', 'unsteady', 'mobilising', 'call bell'],
  },
  {
    id: 'handover',
    label: 'Communication / handover',
    keywords: ['handover', 'hand-over', 'not handed over', 'communication', 'miscommunication', 'verbal order', 'not documented', 'missed'],
  },
  {
    id: 'equipment',
    label: 'Equipment / device',
    keywords: ['monitor', 'ventilator', 'defibrillator', 'device', 'equipment', 'malfunction', 'faulty', 'battery', 'oxygen', 'suction', 'hoist'],
  },
  {
    id: 'procedure',
    label: 'Surgical / procedure',
    keywords: ['theatre', 'surgery', 'surgical', 'procedure', 'consent', 'site marking', 'swab count', 'instrument count', 'checklist'],
  },
  {
    id: 'diagnostic',
    label: 'Diagnostic / results',
    keywords: ['result', 'results', 'x-ray', 'scan', 'ct', 'critical value', 'not reviewed', 'delayed diagnosis', 'report not seen'],
  },
];

export const LOCATIONS = [
  { id: 'icu', label: 'ICU', re: /\b(?:icu|itu|intensive care|critical care)\b/i },
  { id: 'nicu', label: 'NICU', re: /\b(?:nicu|neonatal)\b/i },
  { id: 'ed', label: 'Emergency Dept', re: /\b(?:ed|a&e|a & e|emergency(?: department| dept| room)?|er)\b/i },
  { id: 'theatre', label: 'Theatres', re: /\b(?:theatre|operating room|or \d+|recovery)\b/i },
  { id: 'maternity', label: 'Maternity', re: /\b(?:maternity|labour ward|labor ward|obstetric)\b/i },
  { id: 'pharmacy', label: 'Pharmacy', re: /\bpharmacy\b/i },
  { id: 'radiology', label: 'Radiology', re: /\b(?:radiology|imaging)\b/i },
];

export const DEVICES = [
  'infusion pump',
  'syringe driver',
  'pca pump',
  'pump',
  'glucometer',
  'ventilator',
  'monitor',
  'defibrillator',
  'bed alarm',
  'bed rail',
  'hoist',
  'label printer',
  'barcode scanner',
  'oxygen cylinder',
  'suction',
];

/** High-alert medications and other commonly involved drugs. */
export const DRUGS = [
  'insulin', 'heparin', 'enoxaparin', 'potassium chloride', 'potassium', 'morphine', 'oxycodone',
  'fentanyl', 'midazolam', 'warfarin', 'methotrexate', 'paracetamol', 'gentamicin', 'vancomycin',
  'noradrenaline', 'adrenaline', 'magnesium', 'digoxin', 'amiodarone', 'propofol',
];

/** Contributing factors, each mapped to a Swiss cheese layer. */
export const FACTORS = [
  // Organisation
  { id: 'staffing', layer: 'organisation', label: 'Short staffing / high workload', re: /\b(?:short[- ]staffed|understaffed|staff shortage|one nurse (?:for|covering)|high workload|too many patients|no cover|agency staff|bank staff)\b/i },
  { id: 'protocol-gap', layer: 'organisation', label: 'Unclear or missing protocol', re: /\b(?:no (?:clear )?(?:protocol|policy|guideline|sop)|protocol (?:unclear|out of date|outdated)|unclear (?:protocol|policy|process)|not sure (?:of|about) the (?:process|protocol))\b/i },
  { id: 'training-gap', layer: 'organisation', label: 'No training on device / process', re: /\b(?:not trained|no training|untrained|never been shown|first time using|unfamiliar with)\b/i },
  { id: 'storage-design', layer: 'organisation', label: 'Storage / layout design', re: /\b(?:stored (?:together|next to|in the same)|same (?:drawer|shelf|bin|cupboard)|next to each other on the shelf|(?:are|were) next to each other|on the same shelf)\b/i },
  // Supervision
  { id: 'no-double-check', layer: 'supervision', label: 'Independent double check not done', re: /\b(?:no (?:second|double|independent) check|not double[- ]checked|without (?:a )?(?:second|double) check|second checker (?:unavailable|not available)|checked alone)\b/i },
  { id: 'handover-gap', layer: 'supervision', label: 'Handover gap', re: /\b(?:not handed over|missed (?:at|in) handover|handover (?:was )?(?:rushed|incomplete|missed)|no handover|during handover)\b/i },
  { id: 'no-senior', layer: 'supervision', label: 'No senior support available', re: /\b(?:no senior|senior (?:not available|unavailable)|unable to (?:reach|contact) (?:the )?(?:doctor|registrar|consultant)|no doctor available)\b/i },
  // Preconditions
  { id: 'fatigue', layer: 'preconditions', label: 'Fatigue / end of long shift', re: /\b(?:tired|fatigued?|exhausted|end of (?:a )?(?:long|12[- ]hour|night) shift|long shift|double shift)\b/i },
  { id: 'interruption', layer: 'preconditions', label: 'Interruption / distraction', re: /\b(?:interrupted|interruption|distracted|distraction|called away|phone rang|bleep(?:ed)?|while answering)\b/i },
  { id: 'look-alike', layer: 'preconditions', label: 'Look-alike / sound-alike', re: /\b(?:look[- ]alike|sound[- ]alike|similar (?:packaging|labels?|names?|looking)|look(?:ed)? (?:very )?similar|same colou?r)\b/i },
  { id: 'device-ux', layer: 'preconditions', label: 'Confusing device interface', re: /\b(?:confusing (?:screen|display|interface|menu)|units? (?:confus|mix)|(?:shows?|displayed) [^.]{0,30} side by side|wrong unit field|ml(?:\/hr?)? (?:vs|instead of|versus) ml|decimal point|default (?:rate|setting)|keypad|scrolled past)\b/i },
  { id: 'equipment-fault', layer: 'preconditions', label: 'Equipment fault', re: /\b(?:faulty|malfunction(?:ed|ing)?|broken|jammed|not working|battery (?:died|flat|low)|alarm (?:did not|didn'?t) (?:sound|go off)|out of service)\b/i },
  { id: 'alarm-off', layer: 'preconditions', label: 'Alarm off / not set', re: /\b(?:alarm (?:was )?(?:off|not (?:on|set|activated)|silenced|disabled)|not switched on)\b/i },
  { id: 'environment', layer: 'preconditions', label: 'Environment (lighting, noise, space)', re: /\b(?:poor lighting|dark|lights (?:off|dimmed)|noisy|cluttered|crowded|no space)\b/i },
  { id: 'batching', layer: 'preconditions', label: 'Batch processing', re: /\b(?:in (?:a )?batch|batched|printed (?:several|multiple|all)|labelled later|labels printed in advance|pre-?printed)\b/i },
  // Unsafe acts
  { id: 'wrong-rate', layer: 'acts', label: 'Wrong rate programmed', re: /\b(?:wrong rate|rate (?:was )?(?:set|programmed|entered) (?:at|to|as)|programmed (?:at|as) \d+|10 ?x|ten times)\b/i },
  { id: 'wrong-dose', layer: 'acts', label: 'Wrong dose / strength', re: /\b(?:wrong (?:dose|strength|concentration)|double (?:the )?dose|overdose|underdose|\d+ ?(?:mg|mmol|units?) instead of)\b/i },
  { id: 'wrong-patient', layer: 'acts', label: 'Wrong patient', re: /\b(?:wrong patient|another patient'?s?|different patient|other patient'?s?)\b/i },
  { id: 'omission', layer: 'acts', label: 'Omitted / missed step', re: /\b(?:omitted|not given|missed (?:dose|step)|forgot(?:ten)?|was not (?:done|checked|given)|skipped)\b/i },
  { id: 'mislabel', layer: 'acts', label: 'Mislabelling', re: /\b(?:mislabell?ed|wrong label|labell?ed with (?:the )?(?:wrong|another)|unlabell?ed)\b/i },
];

/** The slice that held: defences that caught the error. */
export const DEFENCES = [
  { id: 'double-check', label: 'Independent double check', re: /\b(?:double[- ]check(?:ed)?|second (?:nurse|check(?:er)?) (?:noticed|spotted|caught|queried)|independent check)\b/i },
  { id: 'barcode', label: 'Barcode / scan check', re: /\b(?:barcode|scan(?:ner|ned)? (?:flagged|rejected|alerted|mismatch)|scanning)\b/i },
  { id: 'smart-pump', label: 'Smart-pump dose limit', re: /\b(?:dose limit|soft limit|hard limit|drug library|pump alarm(?:ed)?|pump (?:alerted|flagged|warned))\b/i },
  { id: 'pharmacist', label: 'Pharmacist review', re: /\bpharmacist (?:queried|noticed|spotted|caught|flagged|reviewed)\b/i },
  { id: 'lab', label: 'Lab rejected sample', re: /\b(?:lab(?:oratory)? (?:rejected|queried|flagged|noticed)|sample rejected)\b/i },
  { id: 'patient-family', label: 'Patient / family spoke up', re: /\b(?:patient (?:queried|questioned|said|asked|noticed)|(?:family|relative|daughter|son|wife|husband) (?:queried|questioned|noticed|asked))\b/i },
  { id: 'checklist', label: 'Checklist / time-out', re: /\b(?:checklist|time[- ]out|sign[- ]in|sign[- ]out) (?:caught|identified|picked up|flagged)\b/i },
  { id: 'vigilance', label: 'Staff vigilance', re: /\b(?:noticed|spotted|caught|realised|realized|picked up) (?:the )?(?:error|mistake|discrepancy|before)\b/i },
];

/** Suggested system fixes per factor, tagged with action-hierarchy strength. */
export const FIXES = {
  'staffing': [{ strength: 'intermediate', text: 'Use acuity-based staffing triggers and escalate when the nurse-to-patient ratio exceeds the threshold' }],
  'protocol-gap': [{ strength: 'intermediate', text: 'Write or update a one-page standard protocol and put it at the point of care' }],
  'training-gap': [{ strength: 'weak', text: 'Require a device competency sign-off before first unsupervised use' }],
  'storage-design': [
    { strength: 'strong', text: 'Physically separate look-alike stock (different drawers or locations); remove high-strength stock from ward areas' },
  ],
  'no-double-check': [{ strength: 'intermediate', text: 'Make an independent double check a required step for high-alert infusions, recorded in the eMAR' }],
  'handover-gap': [{ strength: 'intermediate', text: 'Use a structured handover tool (e.g. SBAR) with a mandatory field for time-critical medicines' }],
  'no-senior': [{ strength: 'intermediate', text: 'Publish a clear out-of-hours escalation rota with a guaranteed response time' }],
  'fatigue': [{ strength: 'intermediate', text: 'Avoid scheduling high-risk tasks in the last hour of night shifts; protect break times' }],
  'interruption': [{ strength: 'intermediate', text: 'Introduce protected "do not disturb" time (tabard or zone) during medication rounds and pump programming' }],
  'look-alike': [
    { strength: 'strong', text: 'Change supplier or packaging to remove the look-alike; use tall-man lettering on labels and shelves' },
  ],
  'device-ux': [
    { strength: 'strong', text: 'Configure smart-pump drug libraries with hard limits so implausible rates cannot be programmed' },
    { strength: 'intermediate', text: 'Standardise on a single pump model and default unit per ward' },
  ],
  'equipment-fault': [{ strength: 'intermediate', text: 'Tag and withdraw the faulty unit; review the maintenance log for the device model' }],
  'alarm-off': [{ strength: 'strong', text: 'Configure alarms to default on, with no silent-off option without a reason code' }],
  'environment': [{ strength: 'intermediate', text: 'Improve task lighting and clear the preparation area; audit the space' }],
  'batching': [{ strength: 'strong', text: 'Print labels only at the bedside, one patient at a time, after a wristband scan' }],
  'wrong-rate': [{ strength: 'strong', text: 'Enforce smart-pump hard limits for this drug and concentration' }],
  'wrong-dose': [{ strength: 'strong', text: 'Remove the error-prone strength from ward stock or use pre-filled standard concentrations' }],
  'wrong-patient': [{ strength: 'intermediate', text: 'Require positive patient ID with a wristband scan before administration or sampling' }],
  'omission': [{ strength: 'intermediate', text: 'Add an eMAR overdue alert for time-critical medicines' }],
  'mislabel': [{ strength: 'strong', text: 'Use bedside label printing linked to the wristband scan' }],
};
