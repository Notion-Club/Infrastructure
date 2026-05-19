// Country data for the phone field's country picker.
// `flag` is built from two regional-indicator Unicode codepoints, rendered as
// an iOS-style emoji flag in any system font that supports them.

export type Country = {
  // ISO 3166-1 alpha-2
  code: string;
  // Display name (FR)
  name: string;
  // Phone dial code with leading '+'
  dial: string;
  // Emoji flag (regional indicator pair)
  flag: string;
};

function flagFromCode(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function c(code: string, name: string, dial: string): Country {
  return { code, name, dial, flag: flagFromCode(code) };
}

// Ordered list — priority countries first (FR, BE, CH, RE, GP, CA),
// then the rest alphabetically. Consumed as-is by the picker which inserts
// a visual divider after PRIORITY_COUNT.
export const PRIORITY_COUNT = 6;

export const COUNTRIES: Country[] = [
  // Priority block
  c("FR", "France", "+33"),
  c("BE", "Belgique", "+32"),
  c("CH", "Suisse", "+41"),
  c("RE", "Réunion", "+262"),
  c("GP", "Guadeloupe", "+590"),
  c("CA", "Canada", "+1"),

  // Alphabetical rest
  c("AF", "Afghanistan", "+93"),
  c("ZA", "Afrique du Sud", "+27"),
  c("AL", "Albanie", "+355"),
  c("DZ", "Algérie", "+213"),
  c("DE", "Allemagne", "+49"),
  c("AD", "Andorre", "+376"),
  c("AO", "Angola", "+244"),
  c("AI", "Anguilla", "+1264"),
  c("AQ", "Antarctique", "+672"),
  c("AG", "Antigua-et-Barbuda", "+1268"),
  c("SA", "Arabie saoudite", "+966"),
  c("AR", "Argentine", "+54"),
  c("AM", "Arménie", "+374"),
  c("AW", "Aruba", "+297"),
  c("AU", "Australie", "+61"),
  c("AT", "Autriche", "+43"),
  c("AZ", "Azerbaïdjan", "+994"),
  c("BS", "Bahamas", "+1242"),
  c("BH", "Bahreïn", "+973"),
  c("BD", "Bangladesh", "+880"),
  c("BB", "Barbade", "+1246"),
  c("BZ", "Belize", "+501"),
  c("BJ", "Bénin", "+229"),
  c("BM", "Bermudes", "+1441"),
  c("BT", "Bhoutan", "+975"),
  c("BY", "Biélorussie", "+375"),
  c("BO", "Bolivie", "+591"),
  c("BA", "Bosnie-Herzégovine", "+387"),
  c("BW", "Botswana", "+267"),
  c("BR", "Brésil", "+55"),
  c("BN", "Brunei", "+673"),
  c("BG", "Bulgarie", "+359"),
  c("BF", "Burkina Faso", "+226"),
  c("BI", "Burundi", "+257"),
  c("KH", "Cambodge", "+855"),
  c("CM", "Cameroun", "+237"),
  c("CV", "Cap-Vert", "+238"),
  c("CL", "Chili", "+56"),
  c("CN", "Chine", "+86"),
  c("CY", "Chypre", "+357"),
  c("CO", "Colombie", "+57"),
  c("KM", "Comores", "+269"),
  c("CG", "Congo", "+242"),
  c("CD", "Congo (RDC)", "+243"),
  c("KP", "Corée du Nord", "+850"),
  c("KR", "Corée du Sud", "+82"),
  c("CR", "Costa Rica", "+506"),
  c("CI", "Côte d'Ivoire", "+225"),
  c("HR", "Croatie", "+385"),
  c("CU", "Cuba", "+53"),
  c("CW", "Curaçao", "+599"),
  c("DK", "Danemark", "+45"),
  c("DJ", "Djibouti", "+253"),
  c("DM", "Dominique", "+1767"),
  c("EG", "Égypte", "+20"),
  c("SV", "El Salvador", "+503"),
  c("AE", "Émirats arabes unis", "+971"),
  c("EC", "Équateur", "+593"),
  c("ER", "Érythrée", "+291"),
  c("ES", "Espagne", "+34"),
  c("EE", "Estonie", "+372"),
  c("US", "États-Unis", "+1"),
  c("ET", "Éthiopie", "+251"),
  c("FJ", "Fidji", "+679"),
  c("FI", "Finlande", "+358"),
  c("GA", "Gabon", "+241"),
  c("GM", "Gambie", "+220"),
  c("GE", "Géorgie", "+995"),
  c("GH", "Ghana", "+233"),
  c("GI", "Gibraltar", "+350"),
  c("GR", "Grèce", "+30"),
  c("GD", "Grenade", "+1473"),
  c("GL", "Groenland", "+299"),
  c("GU", "Guam", "+1671"),
  c("GT", "Guatemala", "+502"),
  c("GG", "Guernesey", "+44"),
  c("GN", "Guinée", "+224"),
  c("GW", "Guinée-Bissau", "+245"),
  c("GQ", "Guinée équatoriale", "+240"),
  c("GY", "Guyana", "+592"),
  c("GF", "Guyane", "+594"),
  c("HT", "Haïti", "+509"),
  c("HN", "Honduras", "+504"),
  c("HK", "Hong Kong", "+852"),
  c("HU", "Hongrie", "+36"),
  c("IM", "Île de Man", "+44"),
  c("CX", "Île Christmas", "+61"),
  c("NF", "Île Norfolk", "+672"),
  c("KY", "Îles Caïmans", "+1345"),
  c("CK", "Îles Cook", "+682"),
  c("FK", "Îles Malouines", "+500"),
  c("MP", "Îles Mariannes du Nord", "+1670"),
  c("MH", "Îles Marshall", "+692"),
  c("FO", "Îles Féroé", "+298"),
  c("SB", "Îles Salomon", "+677"),
  c("TC", "Îles Turques-et-Caïques", "+1649"),
  c("VG", "Îles Vierges britanniques", "+1284"),
  c("VI", "Îles Vierges des États-Unis", "+1340"),
  c("IN", "Inde", "+91"),
  c("ID", "Indonésie", "+62"),
  c("IQ", "Irak", "+964"),
  c("IR", "Iran", "+98"),
  c("IE", "Irlande", "+353"),
  c("IS", "Islande", "+354"),
  c("IL", "Israël", "+972"),
  c("IT", "Italie", "+39"),
  c("JM", "Jamaïque", "+1876"),
  c("JP", "Japon", "+81"),
  c("JE", "Jersey", "+44"),
  c("JO", "Jordanie", "+962"),
  c("KZ", "Kazakhstan", "+7"),
  c("KE", "Kenya", "+254"),
  c("KG", "Kirghizistan", "+996"),
  c("KI", "Kiribati", "+686"),
  c("XK", "Kosovo", "+383"),
  c("KW", "Koweït", "+965"),
  c("LA", "Laos", "+856"),
  c("LS", "Lesotho", "+266"),
  c("LV", "Lettonie", "+371"),
  c("LB", "Liban", "+961"),
  c("LR", "Libéria", "+231"),
  c("LY", "Libye", "+218"),
  c("LI", "Liechtenstein", "+423"),
  c("LT", "Lituanie", "+370"),
  c("LU", "Luxembourg", "+352"),
  c("MO", "Macao", "+853"),
  c("MK", "Macédoine du Nord", "+389"),
  c("MG", "Madagascar", "+261"),
  c("MY", "Malaisie", "+60"),
  c("MW", "Malawi", "+265"),
  c("MV", "Maldives", "+960"),
  c("ML", "Mali", "+223"),
  c("MT", "Malte", "+356"),
  c("MA", "Maroc", "+212"),
  c("MQ", "Martinique", "+596"),
  c("MU", "Maurice", "+230"),
  c("MR", "Mauritanie", "+222"),
  c("YT", "Mayotte", "+262"),
  c("MX", "Mexique", "+52"),
  c("FM", "Micronésie", "+691"),
  c("MD", "Moldavie", "+373"),
  c("MC", "Monaco", "+377"),
  c("MN", "Mongolie", "+976"),
  c("ME", "Monténégro", "+382"),
  c("MS", "Montserrat", "+1664"),
  c("MZ", "Mozambique", "+258"),
  c("MM", "Myanmar", "+95"),
  c("NA", "Namibie", "+264"),
  c("NR", "Nauru", "+674"),
  c("NP", "Népal", "+977"),
  c("NI", "Nicaragua", "+505"),
  c("NE", "Niger", "+227"),
  c("NG", "Nigéria", "+234"),
  c("NU", "Niue", "+683"),
  c("NO", "Norvège", "+47"),
  c("NC", "Nouvelle-Calédonie", "+687"),
  c("NZ", "Nouvelle-Zélande", "+64"),
  c("OM", "Oman", "+968"),
  c("UG", "Ouganda", "+256"),
  c("UZ", "Ouzbékistan", "+998"),
  c("PK", "Pakistan", "+92"),
  c("PW", "Palaos", "+680"),
  c("PA", "Panama", "+507"),
  c("PG", "Papouasie-Nouvelle-Guinée", "+675"),
  c("PY", "Paraguay", "+595"),
  c("NL", "Pays-Bas", "+31"),
  c("PE", "Pérou", "+51"),
  c("PH", "Philippines", "+63"),
  c("PL", "Pologne", "+48"),
  c("PF", "Polynésie française", "+689"),
  c("PR", "Porto Rico", "+1787"),
  c("PT", "Portugal", "+351"),
  c("QA", "Qatar", "+974"),
  c("CF", "République centrafricaine", "+236"),
  c("DO", "République dominicaine", "+1809"),
  c("CZ", "République tchèque", "+420"),
  c("RO", "Roumanie", "+40"),
  c("GB", "Royaume-Uni", "+44"),
  c("RU", "Russie", "+7"),
  c("RW", "Rwanda", "+250"),
  c("EH", "Sahara occidental", "+212"),
  c("KN", "Saint-Kitts-et-Nevis", "+1869"),
  c("SM", "Saint-Marin", "+378"),
  c("VC", "Saint-Vincent-et-les-Grenadines", "+1784"),
  c("SH", "Sainte-Hélène", "+290"),
  c("LC", "Sainte-Lucie", "+1758"),
  c("BL", "Saint-Barthélemy", "+590"),
  c("MF", "Saint-Martin", "+590"),
  c("PM", "Saint-Pierre-et-Miquelon", "+508"),
  c("WS", "Samoa", "+685"),
  c("AS", "Samoa américaines", "+1684"),
  c("ST", "Sao Tomé-et-Principe", "+239"),
  c("SN", "Sénégal", "+221"),
  c("RS", "Serbie", "+381"),
  c("SC", "Seychelles", "+248"),
  c("SL", "Sierra Leone", "+232"),
  c("SG", "Singapour", "+65"),
  c("SK", "Slovaquie", "+421"),
  c("SI", "Slovénie", "+386"),
  c("SO", "Somalie", "+252"),
  c("SD", "Soudan", "+249"),
  c("SS", "Soudan du Sud", "+211"),
  c("LK", "Sri Lanka", "+94"),
  c("SE", "Suède", "+46"),
  c("SR", "Suriname", "+597"),
  c("SY", "Syrie", "+963"),
  c("TJ", "Tadjikistan", "+992"),
  c("TW", "Taïwan", "+886"),
  c("TZ", "Tanzanie", "+255"),
  c("TD", "Tchad", "+235"),
  c("TH", "Thaïlande", "+66"),
  c("TL", "Timor oriental", "+670"),
  c("TG", "Togo", "+228"),
  c("TK", "Tokelau", "+690"),
  c("TO", "Tonga", "+676"),
  c("TT", "Trinité-et-Tobago", "+1868"),
  c("TN", "Tunisie", "+216"),
  c("TM", "Turkménistan", "+993"),
  c("TR", "Turquie", "+90"),
  c("TV", "Tuvalu", "+688"),
  c("UA", "Ukraine", "+380"),
  c("UY", "Uruguay", "+598"),
  c("VU", "Vanuatu", "+678"),
  c("VA", "Vatican", "+379"),
  c("VE", "Venezuela", "+58"),
  c("VN", "Viêt Nam", "+84"),
  c("WF", "Wallis-et-Futuna", "+681"),
  c("YE", "Yémen", "+967"),
  c("ZM", "Zambie", "+260"),
  c("ZW", "Zimbabwe", "+263"),
];

const NORMALIZE_REGEX = /[̀-ͯ]/g;

export function normalizeText(input: string): string {
  return input.normalize("NFD").replace(NORMALIZE_REGEX, "").toLowerCase();
}

export function findCountryByCode(code: string | null): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((country) => country.code === code);
}

export function findCountryByDial(dial: string): Country | undefined {
  // Longest-prefix match: +1242 (Bahamas) beats +1 (Canada) for "+1242…".
  const candidates = COUNTRIES.filter((country) => dial.startsWith(country.dial));
  if (!candidates.length) return undefined;
  return candidates.sort((a, b) => b.dial.length - a.dial.length)[0];
}

export function matchCountry(query: string, country: Country): boolean {
  if (!query) return true;
  const q = normalizeText(query.trim());
  if (!q) return true;
  if (normalizeText(country.name).includes(q)) return true;
  if (normalizeText(country.code).startsWith(q)) return true;
  // Digit-only search: match against the dial code (without '+').
  const digits = q.replace(/\D/g, "");
  if (digits && country.dial.replace(/\D/g, "").startsWith(digits)) return true;
  return false;
}
