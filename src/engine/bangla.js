// Bangla (বাংলা) support. Reports written in Bangla are normalised into the engine's
// English vocabulary before detection, so they join the same signals as English reports.
// The stored and displayed text stays in Bangla. Pure and unit-tested.

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Convert Bangla digits to ASCII so dates, wards and numbers are understood. */
export const normaliseDigits = (text) =>
  String(text || '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

export const hasBangla = (text) => /[ঀ-৿]/.test(String(text || ''));

// Bangla negation follows the verb: "ক্লান্ত ছিলেন না" = "was not tired".
// These terms become "not <english>" when negated, so the English negation rules apply.
const NEGATABLE = [
  ['ক্লান্ত', 'tired'],
  ['মনোযোগ বিঘ্নিত', 'distracted'],
  ['বাধা পেয়েছিলাম', 'interrupted'],
  ['বাধাগ্রস্ত', 'interrupted'],
  ['ডাবল চেক করা', 'double-checked'],
];
const NEG_AFTER = '\\s*(?:হয়েছিল|হয়েছিল|ছিলেন|ছিল|ছিলাম|পাননি|লাগেনি|করা)?\\s*(?:না|নি|হয়নি|হয়নি|নেই)(?![\\u0980-\\u09FF])';

// Phrase map, longest phrases first so "রক্তের নমুনা" wins over "নমুনা".
const PHRASES = [
  // outcome
  ['কোনো ক্ষতি হয়নি', 'no harm'], ['কোনো ক্ষতি হয়নি', 'no harm'], ['ক্ষতি হয়নি', 'no harm'], ['ক্ষতি হয়নি', 'no harm'],
  ['নিকট-দুর্ঘটনা', 'near miss'], ['নিয়ার মিস', 'near miss'], ['নিয়ার মিস', 'near miss'],
  ['আঘাত পাননি', 'no injury'], ['আঘাত লাগেনি', 'no injury'],
  ['দেওয়ার আগেই', 'before it was given'], ['দেওয়ার আগে', 'before it was given'],
  // locations
  ['জরুরি বিভাগ', 'emergency department'], ['জরুরী বিভাগ', 'emergency department'],
  ['অপারেশন থিয়েটার', 'theatre'], ['আইসিইউ', 'ICU'], ['এনআইসিইউ', 'NICU'], ['প্রসূতি', 'maternity'],
  ['ওয়ার্ড', 'ward'], ['ওয়ার্ড', 'ward'],
  // shift
  ['রাতের শিফট', 'night shift'], ['রাতের শিফটে', 'night shift'], ['রাতে', 'at night'], ['দিনের শিফট', 'day shift'],
  // infusion
  ['সিরিঞ্জ ড্রাইভার', 'syringe driver'], ['ইনফিউশন পাম্প', 'infusion pump'], ['ইনফিউশন', 'infusion'], ['পাম্প', 'pump'],
  ['মিলি/ঘণ্টা', 'ml/hr'], ['মিলি প্রতি ঘণ্টা', 'ml/hr'], ['রেট', 'rate'], ['কিপ্যাড', 'keypad'], ['কি-প্যাড', 'keypad'],
  ['দশমিক বিন্দু', 'decimal point'], ['দশমিক', 'decimal point'], ['১০ গুণ', '10x'], ['10 গুণ', '10x'], ['দশ গুণ', '10x'],
  ['ভুল রেট', 'wrong rate'],
  // medication
  ['ভুল ডোজ', 'wrong dose'], ['ভুল রোগী', 'wrong patient'], ['অন্য রোগীর', "another patient's"],
  ['ওষুধ', 'medication'], ['ঔষধ', 'medication'], ['ডোজ', 'dose'], ['ভায়াল', 'vial'], ['ভায়াল', 'vial'],
  ['অ্যাম্পুল', 'ampoule'], ['এম্পুল', 'ampoule'], ['প্রেসক্রিপশন', 'prescription'],
  ['পটাশিয়াম ক্লোরাইড', 'potassium chloride'], ['পটাসিয়াম ক্লোরাইড', 'potassium chloride'],
  ['পটাশিয়াম', 'potassium'], ['পটাসিয়াম', 'potassium'], ['ইনসুলিন', 'insulin'], ['হেপারিন', 'heparin'],
  ['মরফিন', 'morphine'], ['প্যারাসিটামল', 'paracetamol'], ['জেন্টামাইসিন', 'gentamicin'],
  ['নোরঅ্যাড্রেনালিন', 'noradrenaline'], ['অ্যাড্রেনালিন', 'adrenaline'], ['ওয়ারফারিন', 'warfarin'],
  // specimen
  ['রক্তের নমুনা', 'blood sample'], ['ভুল লেবেল', 'wrong label'], ['নমুনা', 'sample'], ['লেবেল', 'label'], ['ল্যাব', 'lab'],
  ['একসাথে প্রিন্ট', 'printed all'], ['আগে থেকে প্রিন্ট', 'pre-printed'],
  // falls
  ['মেঝেতে পাওয়া যায়', 'patient found on floor'], ['মেঝেতে পাওয়া গেছে', 'patient found on floor'],
  // "পড়ে যায়" alone also means "got dropped/skipped", so only person-forms count as a fall.
  ['বাদ পড়ে যায়', 'got missed'], ['বাদ পড়ে যায়', 'got missed'], ['বাদ পড়ে', 'omitted'],
  ['পড়ে যান', 'fell'], ['পড়ে যান', 'fell'], ['পড়ে গেছেন', 'fell'], ['পড়ে গেছেন', 'fell'],
  ['বেড অ্যালার্ম বন্ধ', 'bed alarm was off'], ['বেড অ্যালার্ম', 'bed alarm'], ['কল বেল', 'call bell'],
  // contributing factors
  ['লোকবল কম', 'short staffed'], ['কর্মী সংকট', 'short staffed'], ['প্রশিক্ষণ নেই', 'no training'], ['প্রশিক্ষণ পাইনি', 'not trained'],
  ['হ্যান্ডওভারে বাদ পড়ে', 'missed at handover'], ['হ্যান্ডওভার', 'handover'],
  ['দেখতে একই রকম', 'look-alike'], ['দেখতে প্রায় একই', 'look-alike'], ['একই ড্রয়ারে', 'stored in the same drawer'],
  ['বিভ্রান্তিকর স্ক্রিন', 'confusing screen'], ['ফোন বেজে ওঠে', 'phone rang'],
  // defences
  ['দ্বিতীয় নার্স ধরে ফেলেন', 'second nurse caught'], ['দ্বিতীয় নার্স', 'second nurse'], ['ডাবল চেক', 'double check'],
  ['পাম্পের অ্যালার্ম বাজে', 'pump alarmed'], ['পাম্প অ্যালার্ম', 'pump alarmed'], ['বারকোড', 'barcode'],
  ['ফার্মাসিস্ট প্রশ্ন তোলেন', 'pharmacist queried'], ['ফার্মাসিস্ট', 'pharmacist'],
  ['ল্যাব নমুনা ফেরত দেয়', 'lab rejected'], ['ভুলটি ধরে ফেলি', 'noticed the error'], ['ভুলটি ধরা পড়ে', 'noticed the error'],
  ['ধরে ফেলেন', 'caught it'], ['ধরা পড়ে', 'caught it'],
  // affirmative forms (negated forms were already rewritten above)
  ['ক্লান্ত', 'tired'], ['মনোযোগ বিঘ্নিত', 'distracted'], ['বাধাগ্রস্ত', 'interrupted'], ['বাধা পেয়েছিলাম', 'interrupted'],
  ['আঘাত', 'injury'], ['রক্তপাত', 'bleeding'], ['কালশিটে', 'bruise'],
  ['ডিফিব্রিলেটর', 'defibrillator'], ['ব্যাটারি ফ্ল্যাট', 'flat battery'], ['ফ্ল্যাট ব্যাটারি', 'flat battery'], ['নষ্ট', 'faulty'],
  ['গ্লুকোমিটার', 'glucometer'], ['অক্সিজেন সিলিন্ডার', 'oxygen cylinder'],
  ['রোগী', 'patient'], ['নার্স', 'nurse'],
].sort((a, b) => b[0].length - a[0].length);

/**
 * Rewrite a Bangla (or mixed) report into the engine's vocabulary. English text passes
 * through unchanged. Unmapped Bangla words are left as they are (they score nothing).
 */
export function translateBangla(text) {
  let t = normaliseDigits(text);
  if (!hasBangla(t)) return t;
  for (const [bn, en] of NEGATABLE) {
    t = t.replace(new RegExp(`${bn}${NEG_AFTER}`, 'g'), ` not ${en} `);
  }
  for (const [bn, en] of PHRASES) t = t.split(bn).join(` ${en} `);
  return t.replace(/[ \t]+/g, ' ');
}
