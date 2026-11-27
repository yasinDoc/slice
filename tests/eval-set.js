// Held-out evaluation set: realistic near-miss reports written independently of the demo
// data and the lexicon, with the labels a patient-safety reviewer would assign.
// Used by tests/eval.test.js to measure extraction accuracy. Synthetic; no real patients.
//
// Fields checked: category, location, outcome, and must-have / must-not-have factors and
// defences. `null` means "no specific value expected".
export default [
  {
    text: 'Pt on ward 9 nearly got IV gentamicin meant for the pt in the next bay. Wristbands not checked. Pharmacist queried before admin. No harm.',
    // A drug given to the wrong patient is a medication incident (standard taxonomy).
    category: 'medication', location: 'ward-9', outcome: 'near-miss', factors: ['wrong-patient'], defences: ['pharmacist'],
  },
  {
    text: 'Syringe driver for end-of-life morphine set to 24 ml/hr instead of 2.4 ml/hr on Ward 12. I was called away halfway through programming. Colleague double-checked and noticed.',
    category: 'infusion', location: 'ward-12', outcome: 'near-miss', factors: ['interruption'], defences: ['double-check'],
  },
  {
    text: 'Insulin given twice: day staff gave the dose but it was not documented, night nurse nearly repeated it. Handover was rushed. Caught when the patient said they had already had it.',
    category: 'medication', location: null, outcome: 'near-miss', factors: ['handover-gap'], defences: ['patient-family'],
  },
  {
    text: 'Elderly lady found on the floor of the bathroom on Ward 3 at 04:00. Call bell was out of reach and the bed alarm was off. Small bruise to her hip.',
    category: 'falls', location: 'ward-3', outcome: 'harm', factors: ['alarm-off'], defences: [],
  },
  {
    text: 'Blood culture bottles labelled at the nurses station after collection rather than at the bedside, two pts mixed up. Lab rejected the samples.',
    category: 'specimen', location: null, outcome: 'near-miss', factors: [], defences: ['lab'],
  },
  {
    text: 'In theatre 3 the swab count was one short at closing. WHO checklist sign out caught the discrepancy and the swab was found in the drapes.',
    category: 'procedure', location: 'theatre', outcome: 'near-miss', factors: [], defences: ['checklist'],
  },
  {
    text: 'ICU: noradrenaline and adrenaline syringes have look-alike labels and were stored side by side in the same drawer. Picked the wrong one but barcode scanning flagged it.',
    category: 'medication', location: 'icu', outcome: 'near-miss', factors: ['look-alike', 'storage-design'], defences: ['barcode'],
  },
  {
    text: 'Critical potassium result of 6.8 not reviewed for 9 hours on Ward 8 because there is no clear process for results out of hours. Registrar picked it up on ward round.',
    category: 'diagnostic', location: 'ward-8', outcome: 'near-miss', factors: ['protocol-gap'], defences: [],
  },
  {
    text: 'Defibrillator on the resus trolley in ED had a flat battery at the morning check. Replaced. No patient involved.',
    category: 'equipment', location: 'ed', outcome: 'near-miss', factors: ['equipment-fault'], defences: [],
  },
  {
    text: 'NICU: heparin flush 1000 units/ml picked instead of 10 units/ml, vials look very similar. Second check by a colleague caught it before it was given.',
    category: 'medication', location: 'nicu', outcome: 'near-miss', factors: ['look-alike'], defences: ['double-check'],
  },
  {
    text: 'Maternity: oxytocin infusion rate entered at 60 ml/hr instead of 6 ml/hr. The pump alarmed at the drug library hard limit. I was not tired and there were no interruptions.',
    category: 'infusion', location: 'maternity', outcome: 'near-miss', factors: ['wrong-rate'], defences: ['smart-pump'],
    notFactors: ['fatigue', 'interruption'],
  },
  {
    text: 'No double check was done on the chemotherapy infusion because the second nurse was on break. Rate was correct but the check is mandatory. Ward 5.',
    category: 'infusion', location: 'ward-5', outcome: 'near-miss', factors: ['no-double-check'], defences: [],
    notDefences: ['double-check'],
  },
  {
    text: 'Patient with a penicillin allergy was prescribed co-amoxiclav. The allergy was not documented on the drug chart. Patient queried it before the first dose.',
    category: 'medication', location: null, outcome: 'near-miss', factors: [], defences: ['patient-family'],
  },
  {
    text: 'Hoist sling used on Ward 7 was the wrong size; the patient felt unsafe and the transfer was stopped. Staff said they had never been shown the new slings.',
    category: 'equipment', location: 'ward-7', outcome: 'near-miss', factors: ['training-gap'], defences: [],
  },
  {
    text: 'Agency nurse covering 12 patients on nights gave the 22:00 enoxaparin to the wrong patient. Patient developed minor bleeding at the injection site.',
    category: 'medication', location: null, outcome: 'harm', factors: ['staffing', 'wrong-patient'], defences: [],
  },
  {
    text: 'CT head result showing a bleed was not communicated to the team for 4 hours. Picked up when the consultant reviewed the scan.',
    category: 'diagnostic', location: null, outcome: 'near-miss', factors: [], defences: [],
  },
  {
    text: 'Glucometer on Ward 2 gave readings 3 mmol/L lower than the lab sample. Device taken out of service.',
    category: 'equipment', location: 'ward-2', outcome: 'near-miss', factors: ['equipment-fault'], defences: [],
  },
  {
    text: 'Verbal order for 2 g magnesium was heard as 4 g during a busy resus in the emergency department. Read-back caught the error.',
    category: 'handover', location: 'ed', outcome: 'near-miss', factors: [], defences: [],
  },
  {
    text: 'PCA pump programmed with the wrong concentration after the drug library was updated. Confusing screen. Spotted by the recovery nurse before starting.',
    category: 'infusion', location: 'theatre', outcome: 'near-miss', factors: ['device-ux'], defences: [],
  },
  {
    text: 'Two patients with the same surname on Ward 4; bloods were taken from the wrong patient because the wristband was not scanned. Lab queried the mismatch.',
    category: 'identification', location: 'ward-4', outcome: 'near-miss', factors: ['wrong-patient'], defences: ['lab'],
  },
  {
    text: 'Night shift, exhausted after a double shift, I nearly gave IV paracetamol 4 hours early. Noticed the error myself when checking the chart. No harm.',
    category: 'medication', location: null, outcome: 'near-miss', factors: ['fatigue'], defences: ['vigilance'],
  },
  {
    text: 'Oxygen cylinder ran empty during transfer from ICU to radiology. Porter noticed before it became an issue and a spare was used.',
    category: 'equipment', location: 'icu', outcome: 'near-miss', factors: [], defences: [],
  },
  {
    text: 'Specimen pots pre-printed with labels for the whole bay; one urine sample went with the wrong label. Lab rejected it.',
    category: 'specimen', location: null, outcome: 'near-miss', factors: ['batching', 'mislabel'], defences: ['lab'],
  },
  {
    text: 'Methotrexate prescribed daily instead of weekly on discharge. Pharmacist flagged it during the discharge check.',
    category: 'medication', location: null, outcome: 'near-miss', factors: [], defences: ['pharmacist'],
  },
  // Outcome edge cases: findings are not harm; "nearly" did not reach the patient.
  {
    text: 'Patient on Ward 6 fell while walking to the toilet at night. No injury. Bed alarm was not switched on.',
    category: 'falls', location: 'ward-6', outcome: 'no-harm', factors: ['alarm-off'], defences: [],
  },
  {
    text: 'IV paracetamol was given 2 hours late on Ward 2 because the round was interrupted. No harm.',
    category: 'medication', location: 'ward-2', outcome: 'no-harm', factors: ['interruption'], defences: [],
  },
  {
    text: 'X-ray showing a fracture was not reviewed for two days. Picked up at follow-up. No harm, patient recalled.',
    category: 'diagnostic', location: null, outcome: 'near-miss', factors: [], defences: [],
  },
  {
    text: 'Enoxaparin was nearly given to the wrong patient on Ward 10; the barcode scanner flagged the mismatch.',
    category: 'medication', location: 'ward-10', outcome: 'near-miss', factors: ['wrong-patient'], defences: ['barcode'],
  },
  {
    text: 'Patient received the wrong dose of morphine (10 mg instead of 1 mg) in recovery and became drowsy, needing naloxone. Developed respiratory depression.',
    category: 'medication', location: 'theatre', outcome: 'harm', factors: ['wrong-dose'], defences: [],
  },
  // Regression: an infused drug named alongside pump programming is still an infusion incident.
  {
    text: 'VitaFlow 300 heparin rate entered wrong again. Ward 6, night shift 03:00. Heparin rate entered 10x too high on the VitaFlow 300 keypad, was interrupted. Second nurse double-checked and caught it.',
    category: 'infusion', location: 'ward-6', outcome: 'near-miss', factors: ['interruption', 'device-ux'], defences: ['double-check'],
  },
  // Bangla (বাংলা) reports: same labels, written as staff in Bangladesh might write them.
  {
    lang: 'bn',
    text: 'ওয়ার্ড ৩-এ রাত ২টায় এক বয়স্ক রোগী বাথরুমে পড়ে যান। বেড অ্যালার্ম বন্ধ ছিল এবং কল বেল নাগালের বাইরে ছিল। হাতে সামান্য কালশিটে পড়েছে।',
    category: 'falls', location: 'ward-3', outcome: 'harm', factors: ['alarm-off'], defences: [],
  },
  {
    lang: 'bn',
    text: 'আইসিইউ-তে পটাশিয়াম ক্লোরাইডের ১০ ও ২০ মিলিমোল অ্যাম্পুল দেখতে একই রকম এবং একই ড্রয়ারে রাখা। ভুল অ্যাম্পুল নেওয়া হয়েছিল, কিন্তু ফার্মাসিস্ট প্রশ্ন তোলেন, দেওয়ার আগেই।',
    category: 'medication', location: 'icu', outcome: 'near-miss', factors: ['look-alike', 'storage-design'], defences: ['pharmacist'],
  },
  {
    lang: 'bn',
    text: 'জরুরি বিভাগে কয়েকজন রোগীর লেবেল আগে থেকে প্রিন্ট করা ছিল; একটি রক্তের নমুনায় ভুল লেবেল লাগানো হয়। ল্যাব নমুনা ফেরত দেয়।',
    category: 'specimen', location: 'ed', outcome: 'near-miss', factors: ['batching', 'mislabel'], defences: ['lab'],
  },
  {
    lang: 'bn',
    text: 'ওয়ার্ড ৫-এ ইনসুলিনের ভুল ডোজ প্রায় দেওয়া হচ্ছিল। আমি ক্লান্ত ছিলাম না এবং মনোযোগ বিঘ্নিত হয়নি; প্রেসক্রিপশন অস্পষ্ট ছিল। দ্বিতীয় নার্স ধরে ফেলেন।',
    category: 'medication', location: 'ward-5', outcome: 'near-miss', factors: ['wrong-dose'], defences: ['double-check'],
    notFactors: ['fatigue', 'interruption'],
  },
  {
    lang: 'bn',
    text: 'ওয়ার্ড ৯-এ জেন্টামাইসিন ভুল রোগী-কে প্রায় দেওয়া হচ্ছিল; বারকোড স্ক্যানে মিল পাওয়া যায়নি।',
    category: 'medication', location: 'ward-9', outcome: 'near-miss', factors: ['wrong-patient'], defences: ['barcode'],
  },
  {
    lang: 'bn',
    text: 'জরুরি বিভাগে সকালের চেকে রিসাস ট্রলির ডিফিব্রিলেটরের ব্যাটারি ফ্ল্যাট পাওয়া যায়। বদলে দেওয়া হয়েছে।',
    category: 'equipment', location: 'ed', outcome: 'near-miss', factors: ['equipment-fault'], defences: [],
  },
];
