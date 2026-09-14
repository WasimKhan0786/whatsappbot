/**
 * ============================================================================
 * 🛡️ CUSTOM ABUSE WARNING & RETALIATION CONFIGURATION
 * ============================================================================
 * 
 * 📌 Kaam kaise karta hai:
 * 1. Strike 1 (First abuse): Bot user ko WARNING_MESSAGE bhejega.
 * 2. Strike 2+ (Next abuse): Bot CUSTOM_RETALIATION_REPLIES me se randomly ek
 *    reply pick karke user ko bhejega.
 * 
 * 👉 AAPKO SIRF YE FILE FILL KARNI HAI!
 * Niche diye gaye array me apne custom replies add kar lijiye.
 */

// ⚠️ Strike 1: Jab user pehli baar galat bhasha use kare
const WARNING_MESSAGE = "⚠️ *Aakhri Chetwani (Last Warning):* Kripya ashabhya ya galat bhasha ka istemal na karein. Yeh aakhri warning hai!";

// 💥 Strike 2 aur uske baad: User dobara trigger kare toh bot inme se koi ek message bhejega
const CUSTOM_RETALIATION_REPLIES = [
  // 👇 Yahan quotes (" ") ke andar apne custom replies / retaliation messages daalein:
  "sun na tu mera beta aa land chushle mera",
  "tera baap madarchod",
  "teri maa ki chuchdi",
  "madarchod",
  "bhenchod",
  "bhosdike",
  "chod na bc",
  "teri behen ki chut",
  "mc",
  "madarjaat",
  "randi ka aulaad",
  "harami kutte",
  "chutiye",
  "kutte",
  "kutte ke pille",
  "Maa ki chu chu chu chu",
  "bhosdiki randi ka aulaad madarchod chutiye ke pille bhenchod",
  "bhosdi ke bacchi baccho ko randi bana rhi hai maa behen ek karuga",
  "bhenchod bhenchod bhenchod bhenchod bhenchod bhenchod",
  "Maa chudaye madarchod",
  "bhenchod bhenchod bhenchod bhenchod bhenchod bhenchod",
  "kutte ke pille",
  "kutte ke aulaad",
  "haramkhor ",
  "chutiya",
  "teri ma ka bur  ",
  "madarchod bhenchod kutte ke aulaad randi ke aulaad",
  "randi ke bacche",
  "saali chutiye",
  "BC",
  "tera bhi gand marenge aur teri ma ke bhi",
  "teri gaand marenge aur teri ma ke bhi",
  "BC BC BC BC BC BC BC BC BC BC BC BC",
  "bc bc bc bc bc bc",
  "tera bhi gaand marenge aur teri ma ke bhi",
  "randi ka aulaad madarchod bhenchod kutte ke aulaad randi ke aulaad",
  "randi ke bacche",
  "saali chutiye",
  "BC",
  "tera bhi gand marenge aur teri ma ke bhi",
  "teri gaand marenge aur teri ma ke bhi",
  "BC BC BC BC BC BC BC BC BC BC BC BC",
  "bc bc bc bc bc bc",
  "tere ko pilange sath meri ma ko bhi",
  "tu mera jhat ka baal aaja kya karlega",
  "tere ko pilange sath meri ma ko bhi",
  "tu mera jhat ka baal aaja kya karlega",
  
  
  
  
  
  
  
  
];

// 🔍 Extra Keywords: Agar koi naya word add karna chahein jo pehle se list me na ho
const ADDITIONAL_TRIGGER_WORDS = [
 "gaand",
 "maa chudaye",
  'fuck',
  'fucking',
  'fucker',
  'f\\*ck',
  'motherfucker',
  'bitch',
  'bitches',
  'b!tch',
  'asshole',
  'ass\\s*hole',
  'bastard',
  'bastards',
  'dickhead',
  'dick',
  'pussy',
  'cunt',
  'c\\*nt',
  'slut',
  'whore',
  'retard',
  'retarded',
  'nigger',
  'nigga',
  'faggot',
  'shut\\s*up',
  'get\\s*lost',
  'idiot',
  'stupid',
  'moron',
  'dumbass',
  'scumbag',
  'bullshit',
];

module.exports = {
  WARNING_MESSAGE,
  CUSTOM_RETALIATION_REPLIES,
  ADDITIONAL_TRIGGER_WORDS,
};
