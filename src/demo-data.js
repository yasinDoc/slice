// Synthetic demo data (fictional devices, no real patients). Used by the in-app
// "Load demo data" button, scripts/seed.js, the offline demo and the tests.
export default {
  "_note": "Synthetic demo data. No real patients, staff or devices. 'VitaFlow 300' and 'LabelJet 2' are fictional products.",
  "reports": [
    {
      "summary": "Heparin infusion rate programmed 10x too high on VitaFlow 300",
      "date": "2026-09-02",
      "description": "Night shift, Ward 6, 03:10. Heparin infusion programmed at 180 ml/hr instead of 18 ml/hr. The VitaFlow 300 keypad had the decimal point next to the zero. I was interrupted by a bleep while programming. Second nurse noticed the error on a double check before the infusion was started. No harm. Patient Mrs Rahman, MRN 4471-2290, bed 12."
    },
    {
      "summary": "VitaFlow 300 rate entered as ml instead of ml/hr",
      "date": "2026-09-27",
      "description": "Ward 6 night shift around 02:00. Pump rate for a potassium infusion entered in the wrong unit field on the VitaFlow 300; the confusing screen shows ml and ml/hr side by side. Pump alarmed at the soft limit and I corrected it. Was covering 9 patients, short staffed. Near miss, no harm."
    },
    {
      "summary": "Insulin infusion near miss - wrong rate on pump",
      "date": "2026-10-14",
      "description": "Date of event: 2026-10-14. Ward 6, overnight. Insulin infusion programmed at 50 ml/hr instead of 5.0 ml/hr on VitaFlow 300. Decimal point missed. End of a 12-hour shift, tired. No second check because second checker unavailable. I realised the error before it was started. No harm."
    },
    {
      "summary": "Pump programming error during handover",
      "date": "2026-11-03",
      "description": "Ward 6, 07:20 during handover. Morphine PCA rate on VitaFlow 300 set at wrong rate after I was interrupted. Incoming nurse double-checked and spotted it. No harm. Never been shown the new drug library on this pump."
    },
    {
      "summary": "Wrong infusion rate on VitaFlow 300 - caught by pump limit",
      "date": "2026-11-19",
      "description": "Night shift Ward 6, 04:45. Noradrenaline rate entered 10x too high on VitaFlow 300; the decimal point is easy to skip on the keypad. Pump alarmed at hard limit. Short staffed, one nurse for 10 patients. No harm."
    },
    {
      "summary": "Potassium chloride 20 mmol picked instead of 10 mmol",
      "date": "2026-09-10",
      "description": "ICU. Potassium chloride 10 mmol and 20 mmol ampoules are stored in the same drawer and look very similar. Picked 20 mmol by mistake. Pharmacist queried the chart on review and it was not given. Near miss."
    },
    {
      "summary": "Look-alike potassium ampoules in ICU drug cupboard",
      "date": "2026-10-02",
      "description": "ICU, day shift. Similar packaging between potassium chloride strengths. Nearly drew up the wrong strength. Barcode scan flagged a mismatch before administration. No harm."
    },
    {
      "summary": "Wrong strength of potassium drawn up",
      "date": "2026-10-21",
      "description": "Critical care, evening. Drew up potassium chloride 20 mmol instead of 10 mmol. They are next to each other on the shelf. Double-checked with a colleague who caught it. Near miss."
    },
    {
      "summary": "Potassium concentrate selected in error",
      "date": "2026-11-12",
      "description": "ICU, 23:30. Look-alike potassium chloride ampoules, same colour label. Selected the wrong one while distracted by an alarm. Independent check caught it before it was given."
    },
    {
      "summary": "Blood sample labelled with another patient's details",
      "date": "2026-09-15",
      "description": "Emergency department, busy evening. Labels printed in a batch for several patients; a blood sample tube was labelled with another patient's sticker. Lab rejected the sample because the details did not match the request. Near miss. LabelJet 2 label printer had jammed earlier."
    },
    {
      "summary": "Mislabelled specimen in ED",
      "date": "2026-10-05",
      "description": "ED, 19:40. Pre-printed labels for two patients in adjacent cubicles; the specimen was mislabelled. Laboratory queried the mismatch. No harm, sample repeated."
    },
    {
      "summary": "Unlabelled blood tubes sent to lab",
      "date": "2026-10-29",
      "description": "Emergency dept. Blood tubes sent unlabelled because LabelJet 2 printer was not working, planned to label later. Lab rejected. Near miss."
    },
    {
      "summary": "Wrong patient label on urine sample",
      "date": "2026-11-16",
      "description": "ED, night. Printed labels in batch at the nurses station; wrong patient label on a urine sample. Patient's daughter noticed the name was wrong. No harm."
    },
    {
      "summary": "Patient found on floor beside bed",
      "date": "2026-09-20",
      "description": "Ward 3, 02:30. Elderly patient found on floor; bed alarm was off and call bell out of reach. Minor harm: graze to elbow. Night shift, short staffed."
    },
    {
      "summary": "Unwitnessed fall - bed alarm not activated",
      "date": "2026-10-18",
      "description": "Ward 3 overnight. Patient at high falls risk mobilising alone; bed alarm not switched on after the transfer. Fell, no injury. Lights dimmed, no space next to the bed."
    },
    {
      "summary": "Near fall while mobilising to toilet",
      "date": "2026-11-09",
      "description": "Ward 3, night. Unsteady patient got up alone; bed alarm was silenced. Caught by healthcare assistant before falling. No harm."
    },
    {
      "summary": "Insulin dose not handed over",
      "date": "2026-10-08",
      "description": "Ward 6, morning handover rushed. Evening insulin dose was not handed over and nearly omitted. Patient asked about their insulin; dose given on time. No harm."
    },
    {
      "summary": "Time-critical Parkinson's medication nearly missed",
      "date": "2026-10-25",
      "description": "Ward 6. Dose missed at handover; not documented on the board. Pharmacist noticed during ward round. Given 40 minutes late. No harm."
    },
    {
      "summary": "Antibiotic dose missed after handover",
      "date": "2026-11-14",
      "description": "Ward 6, handover was incomplete during a busy shift. Gentamicin dose missed; noticed by the night nurse who gave it 1 hour late. Near miss."
    },
    {
      "summary": "Wrong patient wristband",
      "date": "2026-09-05",
      "description": "Ward 2. Two patients with similar names in the same bay; wristband printed for the wrong patient. Noticed during the medication round. No harm."
    },
    {
      "summary": "Defibrillator battery flat on resus trolley check",
      "date": "2026-09-12",
      "description": "Ward 4 daily check found defibrillator battery flat. Replaced. No patient involvement."
    },
    {
      "summary": "Swab count discrepancy in theatre",
      "date": "2026-09-18",
      "description": "Theatre 2. Swab count discrepancy at closing; WHO checklist sign-out caught the discrepancy, swab found on the floor. No harm."
    },
    {
      "summary": "CT report not reviewed for 3 days",
      "date": "2026-09-24",
      "description": "Ward 8. Critical value on a CT scan report not reviewed for 3 days due to no clear process for results sign-off. Picked up by the consultant. No harm."
    },
    {
      "summary": "Oxygen cylinder empty during transfer",
      "date": "2026-10-01",
      "description": "Transfer from Ward 5 to radiology; oxygen cylinder was nearly empty. Porter noticed before leaving. Spare obtained."
    },
    {
      "summary": "Warfarin prescribed twice on chart",
      "date": "2026-10-10",
      "description": "Ward 9. Warfarin prescribed twice on the paper and electronic chart. Pharmacist queried before the dose was given. Near miss."
    },
    {
      "summary": "Ventilator alarm did not sound",
      "date": "2026-10-12",
      "description": "ICU. Ventilator alarm did not sound on disconnection during repositioning; noticed by the nurse at the bedside. Device taken out of service for testing."
    },
    {
      "summary": "Consent form missing before procedure",
      "date": "2026-10-16",
      "description": "Day surgery. Consent form missing at time-out; the checklist identified it and the procedure was delayed. No harm."
    },
    {
      "summary": "Hoist sling wrong size",
      "date": "2026-10-23",
      "description": "Ward 7. Wrong size hoist sling used; patient felt unsafe and the transfer was stopped. No harm. Not trained on the new slings."
    },
    {
      "summary": "Paracetamol given early",
      "date": "2026-10-27",
      "description": "Ward 2. Paracetamol nearly given 2 hours early because the previous dose was not documented. Patient said they had already had it. No harm."
    },
    {
      "summary": "Glucometer not calibrated",
      "date": "2026-11-01",
      "description": "Ward 9. Glucometer quality control overdue; readings checked against the lab sample. No patient harm."
    },
    {
      "summary": "Suction not working at bedside",
      "date": "2026-11-05",
      "description": "Ward 4. Bedside suction faulty during a routine check. Replaced before needed."
    },
    {
      "summary": "Delayed X-ray result communication",
      "date": "2026-11-07",
      "description": "ED. X-ray result showing fracture not communicated to the GP; noticed at follow-up review. No harm, patient recalled."
    },
    {
      "summary": "Verbal order misunderstood",
      "date": "2026-11-10",
      "description": "Ward 5. Verbal order for magnesium misheard as 'mag 4' instead of '2'. Read-back caught it. No harm."
    },
    {
      "summary": "Methotrexate weekly dose prescribed daily",
      "date": "2026-11-18",
      "description": "Ward 8. Methotrexate prescribed daily instead of weekly. Pharmacist queried before dispensing. Near miss."
    }
  ],
  "protocols": [
    {
      "title": "Infusion pump programming and independent double check",
      "label": "protocol",
      "body": "<p>Last reviewed: March 2022</p><p>Scope: all adult inpatient wards. Applies to infusion pump programming for high-alert medicines.</p><p>Two registered nurses must independently check the drug, dose, concentration and rate.</p>"
    },
    {
      "title": "Concentrated potassium storage and handling",
      "label": "protocol",
      "body": "<p>Last reviewed: January 2026</p><p>Concentrated potassium chloride must be stored in a separate locked cupboard in critical care areas only.</p>"
    },
    {
      "title": "Specimen labelling at the bedside",
      "label": "protocol",
      "body": "<p>Review date: 2021-11-01</p><p>Specimens must be labelled at the bedside immediately after collection. Do not pre-print labels.</p>"
    },
    {
      "title": "Falls prevention: bed and chair alarms",
      "label": "protocol",
      "body": "<p>Last reviewed: August 2025</p><p>Patients with a falls risk score above 3 need a bed alarm switched on, with the call bell within reach.</p>"
    }
  ]
};
