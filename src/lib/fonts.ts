// Font families available in both design studios. Each is loaded from Google Fonts
// only when it is actually used on a canvas, so the list stays cheap.
export const SYSTEM_FONTS = ["Arial", "Helvetica", "Verdana", "Tahoma", "Trebuchet MS", "Georgia", "Times New Roman", "Courier New", "Garamond", "Palatino Linotype", "Impact", "Comic Sans MS"];

export const GOOGLE_FONTS = [
  "Roboto", "Open Sans", "Noto Sans", "Lato", "Montserrat", "Poppins", "Inter", "Inter Tight", "Source Sans 3", "Source Serif 4",
  "Oswald", "Raleway", "Nunito", "Nunito Sans", "Ubuntu", "Ubuntu Condensed", "Ubuntu Mono", "Roboto Condensed", "Roboto Mono", "Roboto Slab",
  "Roboto Flex", "Roboto Serif", "Work Sans", "Rubik", "Rubik Mono One", "Mulish", "Karla", "Barlow", "Barlow Condensed", "Barlow Semi Condensed",
  "Heebo", "Manrope", "DM Sans", "DM Serif Display", "DM Serif Text", "DM Mono", "Figtree", "Outfit", "Plus Jakarta Sans", "Public Sans",
  "Red Hat Display", "Red Hat Text", "Red Hat Mono", "Archivo", "Archivo Narrow", "Archivo Black", "Asap", "Asap Condensed", "Assistant", "Cabin",
  "Cabin Condensed", "Catamaran", "Chivo", "Chivo Mono", "Commissioner", "Epilogue", "Exo", "Exo 2", "Fira Sans", "Fira Sans Condensed",
  "Fira Sans Extra Condensed", "Fira Code", "Fira Mono", "Hind", "Hind Siliguri", "Hind Madurai", "Hind Guntur", "Hind Vadodara", "IBM Plex Sans", "IBM Plex Sans Condensed",
  "IBM Plex Serif", "IBM Plex Mono", "Jost", "Kanit", "Lexend", "Lexend Deca", "Lexend Exa", "Lexend Giga", "Lexend Mega", "Lexend Tera",
  "Lexend Zetta", "Libre Franklin", "Libre Baskerville", "Libre Caslon Text", "Libre Caslon Display", "Libre Bodoni", "Maven Pro", "Montserrat Alternates", "Montserrat Subrayada", "Mukta",
  "Mukta Malar", "Mukta Vaani", "Noto Sans Display", "Noto Sans Mono", "Noto Serif", "Noto Serif Display", "Onest", "Overpass", "Overpass Mono", "Oxygen",
  "Oxygen Mono", "PT Sans", "PT Sans Caption", "PT Sans Narrow", "PT Serif", "PT Serif Caption", "PT Mono", "Prompt", "Quicksand", "Rajdhani",
  "Readex Pro", "Saira", "Saira Condensed", "Saira Semi Condensed", "Saira Extra Condensed", "Sarabun", "Signika", "Signika Negative", "Sora", "Space Grotesk",
  "Space Mono", "Spline Sans", "Spline Sans Mono", "Titillium Web", "Tomorrow", "Urbanist", "Varela Round", "Be Vietnam Pro", "Albert Sans", "Alexandria",
  "Anybody", "Bai Jamjuree", "Familjen Grotesk", "Gabarito", "Golos Text", "Hanken Grotesk", "Instrument Sans", "Instrument Serif", "Kumbh Sans", "League Spartan",
  "M PLUS 1p", "M PLUS Rounded 1c", "Michroma", "Schibsted Grotesk", "Sen", "Smooch Sans", "Syne", "Tajawal", "Teko", "Tektur",
  "Unbounded", "Wix Madefor Display", "Wix Madefor Text", "Yantramanav", "Abel", "Acme", "Actor", "Advent Pro", "Aldrich", "Alef",
  "Allerta", "Allerta Stencil", "Almarai", "Amaranth", "Antonio", "Anton", "Arimo", "Armata", "Arsenal", "Asul",
  "Athiti", "Audiowide", "Average Sans", "Baloo Bhai 2", "Baloo Da 2", "Baloo Thambi 2", "Baloo 2", "Basic", "Bebas Neue", "Belleza",
  "BenchNine", "Big Shoulders Display", "Big Shoulders Text", "Bricolage Grotesque", "Cairo", "Candal", "Cantarell", "Capriola", "Carme", "Carrois Gothic",
  "Changa", "Chakra Petch", "Cousine", "Cuprum", "Darker Grotesque", "Dosis", "Economica", "El Messiri", "Electrolize", "Encode Sans",
  "Encode Sans Condensed", "Encode Sans Expanded", "Fahkwang", "Fjalla One", "Francois One", "Geologica", "Gothic A1", "Gudea", "Hammersmith One", "Harmattan",
  "Homenaje", "Inclusive Sans", "Istok Web", "Jaldi", "Julius Sans One", "Khand", "Khula", "Kodchasan", "Kufam", "Lekton",
  "Lemonada", "Livvic", "Magra", "Mada", "Mandali", "Marmelad", "Martel Sans", "Marvel", "Merriweather", "Merriweather Sans",
  "Metrophobic", "Mitr", "Molengo", "Nobile", "Numans", "Orbitron", "Oxanium", "Padauk", "Paytone One", "Philosopher",
  "Play", "Pontano Sans", "Port Lligat Sans", "Pragati Narrow", "Puritan", "Quantico", "Questrial", "Quattrocento", "Quattrocento Sans", "Rambla",
  "Rationale", "Rethink Sans", "Rhodium Libre", "Rosario", "Ruda", "Ruluko", "Rum Raisin", "Russo One", "Sansita", "Sarala",
  "Sarpanch", "Scada", "Secular One", "Shanti", "Share", "Share Tech", "Share Tech Mono", "Sintony", "Six Caps", "Sofia Sans",
  "Sofia Sans Condensed", "Strait", "Syncopate", "Tenali Ramakrishna", "Tenor Sans", "Text Me One", "Timmana", "Trispace", "Tuffy", "Unica One",
  "Varta", "Viga", "Voltaire", "Yaldevi", "Yanone Kaffeesatz", "Zen Kaku Gothic New", "Zen Maru Gothic", "Zen Old Mincho", "Playfair Display", "Playfair Display SC",
  "Playfair", "Lora", "Cormorant", "Cormorant Garamond", "Cormorant Infant", "Cormorant SC", "Cormorant Unicase", "EB Garamond", "Crimson Text", "Crimson Pro",
  "Bitter", "Arvo", "Rokkitt", "Zilla Slab", "Vollkorn", "Vollkorn SC", "Alegreya", "Alegreya SC", "Alegreya Sans", "Alegreya Sans SC",
  "Cardo", "Neuton", "Old Standard TT", "Gelasio", "Gentium Book Plus", "Gentium Plus", "Domine", "Faustina", "Frank Ruhl Libre", "Literata",
  "Newsreader", "Petrona", "Piazzolla", "Fraunces", "Bodoni Moda", "Abhaya Libre", "Amiri", "Andada Pro", "Antic Didone", "Antic Slab",
  "Average", "Baskervville", "Bellefair", "BhuTuka Expanded One", "Brawler", "Bree Serif", "Caladea", "Cambo", "Coustard", "Copse",
  "Cutive", "Cutive Mono", "Eczar", "Enriqueta", "Esteban", "Fanwood Text", "Fenix", "Gilda Display", "Glegoo", "Halant",
  "Headland One", "Hepta Slab", "Inknut Antiqua", "Ibarra Real Nova", "Italiana", "Judson", "Kadwa", "Karma", "Kreon", "Kurale",
  "Ledger", "Lustria", "Maitree", "Manuale", "Marcellus", "Marcellus SC", "Martel", "Mate", "Mate SC", "Noticia Text",
  "Ovo", "Peddana", "Poly", "Prata", "Prociono", "Pridi", "Radley", "Rasa", "Roboto Serif", "Rufina",
  "Sahitya", "Scheherazade New", "Sedan", "Sedan SC", "Solway", "Sorts Mill Goudy", "Spectral", "Spectral SC", "Sree Krushnadevaraya", "Stoke",
  "Sumana", "Suranna", "Suravaram", "Tinos", "Trirong", "Trocchi", "Trykker", "Unna", "Vesper Libre", "Vidaloka",
  "Volkhov", "Yrsa", "Zilla Slab Highlight", "Abril Fatface", "Alfa Slab One", "Bowlby One", "Bowlby One SC", "Bungee", "Bungee Inline", "Bungee Shade",
  "Bungee Outline", "Carter One", "Chango", "Cherry Bomb One", "Chewy", "Coiny", "Concert One", "Contrail One", "Creepster", "Faster One",
  "Fascinate", "Fascinate Inline", "Fredoka", "Freckle Face", "Fugaz One", "Galada", "Gorditas", "Graduate", "Hanalei", "Hanalei Fill",
  "Holtwood One SC", "Jockey One", "Kalnia", "Kavoon", "Keania One", "Knewave", "Lemon", "Lilita One", "Limelight", "Lobster",
  "Lobster Two", "Luckiest Guy", "Macondo", "Monoton", "Mogra", "Nabla", "Nosifer", "Oi", "Pattaya", "Passion One",
  "Peralta", "Permanent Marker", "Pirata One", "Poller One", "Rakkas", "Rampart One", "Ribeye", "Ribeye Marrow", "Righteous", "Rock Salt",
  "Rowdies", "Rubik Bubbles", "Rubik Burned", "Rubik Dirt", "Rubik Distressed", "Rubik Glitch", "Rubik Iso", "Rubik Marker Hatch", "Rubik Moonrocks", "Rubik Puddles",
  "Rubik Spray Paint", "Rubik Vinyl", "Rubik Wet Paint", "Ruslan Display", "Rye", "Sancreek", "Shojumaru", "Shrikhand", "Sigmar One", "Silkscreen",
  "Sixtyfour", "Skranji", "Slackey", "Sniglet", "Sonsie One", "Spicy Rice", "Squada One", "Staatliches", "Stalinist One", "Titan One",
  "Train One", "Trade Winds", "Ultra", "Vampiro One", "Viaoda Libre", "Wallpoet", "Warnes", "Workbench", "Zen Dots", "Zen Tokyo Zoo",
  "Dancing Script", "Pacifico", "Great Vibes", "Satisfy", "Sacramento", "Allura", "Alex Brush", "Parisienne", "Tangerine", "Yellowtail",
  "Kaushan Script", "Courgette", "Cookie", "Niconne", "Marck Script", "Italianno", "Pinyon Script", "Petit Formal Script", "Mrs Saint Delafield", "Mr Dafoe",
  "Mr De Haviland", "Herr Von Muellerhoff", "Rouge Script", "Lovers Quarrel", "League Script", "Meddon", "Monsieur La Doulaise", "Arizonia", "Bilbo", "Bilbo Swash Caps",
  "Calligraffitti", "Caveat", "Caveat Brush", "Cedarville Cursive", "Clicker Script", "Damion", "Dawning of a New Day", "Dr Sugiyama", "Engagement", "Felipa",
  "Fuggles", "Grand Hotel", "Handlee", "Homemade Apple", "Indie Flower", "Inspiration", "Jim Nightshade", "Julee", "Just Another Hand", "Kalam",
  "Kristi", "La Belle Aurore", "Lavishly Yours", "Leckerli One", "Loved by the King", "Mea Culpa", "Merienda", "Molle", "Montez", "Mrs Sheppards",
  "Neonderthaw", "Norican", "Nothing You Could Do", "Over the Rainbow", "Patrick Hand", "Playball", "Princess Sofia", "Qwigley", "Reenie Beanie", "Redressed",
  "Ruthie", "Sedgwick Ave", "Shadows Into Light", "Shadows Into Light Two", "Sofia", "Square Peg", "Stalemate", "Style Script", "Sue Ellen Francisco", "Swanky and Moo Moo",
  "The Girl Next Door", "Updock", "Vibur", "Waiting for the Sunrise", "Walter Turncoat", "Whisper", "Yesteryear", "Zeyada", "Architects Daughter", "Amatic SC",
  "Annie Use Your Telescope", "Bad Script", "Chilanka", "Coming Soon", "Covered By Your Grace", "Delius", "Delius Swash Caps", "Gaegu", "Gloria Hallelujah", "Gochi Hand",
  "Henny Penny", "Itim", "Klee One", "Long Cang", "Mansalva", "Mynerve", "Nanum Pen Script", "Oooh Baby", "Pangolin", "Rock 3D",
  "Schoolbell", "Short Stack", "Single Day", "Sriracha", "Yomogi", "Zhi Mang Xing", "Anonymous Pro", "Azeret Mono", "B612 Mono", "Courier Prime",
  "Inconsolata", "JetBrains Mono", "Major Mono Display", "Martian Mono", "Nanum Gothic Coding", "Nova Mono", "Reddit Mono", "Red Hat Mono", "Sometype Mono", "Source Code Pro",
  "Syne Mono", "Ubuntu Sans Mono", "VT323", "Xanh Mono", "Josefin Sans", "Josefin Slab", "Abyssinica SIL", "Agdasima", "Akatab", "Aleo",
  "Alumni Sans", "Amethysta", "Anaheim", "Andika", "Antonio", "Arapey", "Arbutus Slab", "Aref Ruqaa", "Asar", "Atkinson Hyperlegible",
  "Atma", "Autour One", "Bakbak One", "Basic", "Battambang", "Baumans", "Bellota", "Bellota Text", "Biryani", "Blinker",
  "Bonbon", "Boogaloo", "Buenard", "Bungee Spice", "Cambay", "Candal", "Cantata One", "Cantora One", "Carrois Gothic SC", "Castoro",
  "Caudex", "Chau Philomene One", "Chela One", "Chonburi", "Cinzel", "Cinzel Decorative", "Coda", "Comfortaa", "Comme", "Corben",
  "Cormorant Upright", "Croissant One", "Cuprum", "David Libre", "Days One", "Dekko", "Della Respira", "Denk One", "Devonshire", "Didact Gothic",
  "Diplomata", "Diplomata SC", "Donegal One", "Dorsa", "Duru Sans", "Dynalight", "Eagle Lake", "Eater", "Eczar", "Ek Mukta",
  "Elsie", "Elsie Swash Caps", "Emblema One", "Emilys Candy", "Encode Sans Semi Condensed", "Engagement", "Englebert", "Erica One", "Euphoria Script", "Ewert",
  "Expletus Sans", "Fjord One", "Flamenco", "Flavors", "Fondamento", "Fontdiner Swanky", "Forum", "Francois One", "Fresca", "Frijole",
  "Fruktur", "Gafata", "Galdeano", "Galindo", "Gentium Book Basic", "Geo", "Geostar", "Geostar Fill", "Germania One", "Gideon Roman",
  "Give You Glory", "Glass Antiqua", "Goblin One", "Goudy Bookletter 1911", "Gravitas One", "Griffy", "Gruppo", "Gurajada", "Habibi", "Hanuman",
  "Happy Monkey", "Hi Melody", "Hind Jalandhar", "Holtwood One SC", "Iceberg", "Iceland", "IM Fell DW Pica", "IM Fell English", "Imprima", "Inder",
  "Irish Grover", "Jacques Francois", "Jacques Francois Shadow", "Jaldi", "Jolly Lodger", "Joti One", "Jua", "Junge", "Kameron", "Kantumruy Pro",
  "Katibeh", "Kelly Slab", "Kenia", "Khmer", "Kite One", "Kotta One", "Koulen", "Kranky", "Kumar One", "Kumar One Outline",
  "Lacquer", "Lakki Reddy", "Lancelot", "Lateef", "League Gothic", "Lexend Peta", "Libre Barcode 39", "Life Savers", "Lilita One", "Linden Hill",
  "Lugrasimo", "Lumanosimo", "Lunasima", "Maiden Orange", "Mako", "Mallanna", "Marhey", "Markazi Text", "Marko One", "Mate",
  "Maven Pro", "McLaren", "Medula One", "MedievalSharp", "Megrim", "Meie Script", "Merriweather", "Metal", "Metal Mania", "Metamorphous",
  "Miltonian", "Miniver", "Miriam Libre", "Miss Fajardose", "Modak", "Modern Antiqua", "Mohave", "Montaga", "Moul", "Mountains of Christmas",
  "Mouse Memoirs", "Mukta Mahee", "Nerko One", "New Rocker", "News Cycle", "Niramit", "Nixie One", "Nokora", "Nova Cut", "Nova Flat",
  "Nova Round", "Nova Script", "Nova Slim", "Nova Square", "Numans", "Odibee Sans", "Odor Mean Chey", "Offside", "Oldenburg", "Oleo Script",
  "Oleo Script Swash Caps", "Orienta", "Original Surfer", "Overlock", "Overlock SC", "Palanquin", "Palanquin Dark", "Parisienne", "Passero One", "Pathway Gothic One",
  "Patua One", "Pavanam", "Paprika", "Petrona", "Piedra", "Pirata One", "Plaster", "Podkova", "Poiret One", "Pompiere",
  "Poor Story", "Port Lligat Slab", "Potta One", "Prociono", "Prosto One", "Purple Purse", "Quando", "Quintessential", "Qwitcher Grypen", "Racing Sans One",
  "Radio Canada", "Raleway Dots", "Rancho", "Ranga", "Rasa", "Recursive", "Reem Kufi", "Revalia", "Ribeye", "Risque",
  "Roboto Condensed", "Rochester", "Rock 3D", "Rokkitt", "Romanesco", "Ropa Sans", "Rosarivo", "Rozha One", "Rubik One", "Ruge Boogie",
  "Rugli", "Ruluko", "Rusty Attack", "Sail", "Salsa", "Sanchez", "Sansita Swashed", "Sarina", "Sawarabi Gothic", "Sawarabi Mincho",
  "Scope One", "Seaweed Script", "Sevillana", "Seymour One", "Shalimar", "Shanti", "Sirin Stencil", "Slabo 27px", "Smokum", "Smythe",
  "Snowburst One", "Sofadi One", "Song Myung", "Source Serif Pro", "Space Grotesk", "Special Elite", "Spirax", "Stardos Stencil", "Stint Ultra Condensed", "Stint Ultra Expanded",
  "Stylish", "Sunflower", "Sunshiney", "Supermercado One", "Suwannaphum", "Swanky and Moo Moo", "Tauri", "Taviraj", "Telex", "Tillana",
  "Tiro Devanagari Hindi", "Trochut", "Trocchi", "Tulpen One", "Turret Road", "Ubuntu Sans", "Underdog", "Unifraktur Maguntia", "Unkempt", "Unlock",
  "Uncial Antiqua", "Vampiro One", "Varela", "Vast Shadow", "Vazirmatn", "Vibes", "Vidaloka", "Viga", "Voces", "Vollkorn",
  "Wellfleet", "Wendy One", "Wire One", "Yeon Sung", "Yeseva One", "Yusei Magic", "Zen Antique", "Zen Antique Soft", "Zen Loop", "Zilla Slab",
];

const genericFor = (name: string) => /Mono|Code|Courier|Typewriter/i.test(name) ? "monospace"
  : /Serif|Garamond|Playfair|Lora|Bodoni|Baskerv|Cormorant|Merriweather|Slab|Antiqua|Caslon|Georgia|Times/i.test(name) ? "serif"
  : /Script|Hand|Brush|Cursive|Vibes|Dancing|Caveat|Marker/i.test(name) ? "cursive" : "sans-serif";

export const ALL_FONTS = [...new Set([...SYSTEM_FONTS, ...GOOGLE_FONTS])].sort((a, b) => a.localeCompare(b));

export function fontStack(name: string) {
  return `${JSON.stringify(name)}, ${genericFor(name)}`;
}

const requested = new Set<string>();

/** Loads any Google font that is not already on the page. System fonts are skipped. */
export function loadFonts(names: string[]) {
  if (typeof document === "undefined") return;
  const pending = [...new Set(names)].filter(name => name && !SYSTEM_FONTS.includes(name) && !requested.has(name));
  if (!pending.length) return;
  pending.forEach(name => requested.add(name));
  // Chunked so one very long URL cannot fail the whole request.
  for (let index = 0; index < pending.length; index += 12) {
    const chunk = pending.slice(index, index + 12);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${chunk.map(name => `family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&")}&display=swap`;
    document.head.appendChild(link);
  }
}
