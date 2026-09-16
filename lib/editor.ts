import { useRef } from "react";
import type { TplEl } from "./store";

/** Always-available system faces (need no network). */
export const SYSTEM_FONTS = [
  "Georgia", "Courier New", "Times New Roman", "Arial", "Verdana", "Trebuchet MS",
  "Palatino Linotype", "Garamond", "Tahoma", "Impact", "Lucida Sans", "Brush Script MT",
];

/** ~500 Google font families offered in both editors. Loaded only when used. */
export const GOOGLE_FONTS = [
  "Unbounded","Manrope","Bebas Neue","Caveat","Inter","Roboto","Open Sans","Lato","Montserrat","Poppins",
  "Oswald","Raleway","Nunito","Merriweather","Playfair Display","Rubik","Work Sans","Quicksand","Mulish","Karla",
  "Barlow","Josefin Sans","Fira Sans","Cabin","Dosis","Titillium Web","Inconsolata","Anton","Lobster","Pacifico",
  "Dancing Script","Shadows Into Light","Indie Flower","Amatic SC","Permanent Marker","Satisfy","Great Vibes","Sacramento","Courgette","Cookie",
  "Abril Fatface","Alfa Slab One","Archivo","Archivo Black","Asap","Assistant","Bitter","Cardo","Catamaran","Chivo",
  "Comfortaa","Cormorant","Cormorant Garamond","Crimson Text","Domine","EB Garamond","Exo","Exo 2","Figtree","Fjalla One",
  "Frank Ruhl Libre","Heebo","Hind","IBM Plex Sans","IBM Plex Serif","IBM Plex Mono","Jost","Kanit","Lexend","Libre Baskerville",
  "Libre Franklin","Lora","Maven Pro","Mukta","Noto Sans","Noto Serif","Nunito Sans","Overpass","Oxygen","PT Sans",
  "PT Serif","Prompt","Public Sans","Questrial","Roboto Condensed","Roboto Mono","Roboto Slab","Rokkitt","Source Sans 3","Source Serif 4",
  "Space Grotesk","Space Mono","Spectral","Teko","Ubuntu","Varela Round","Vollkorn","Yanone Kaffeesatz","Zilla Slab","Acme",
  "Advent Pro","Aldrich","Alegreya","Alegreya Sans","Alex Brush","Allan","Allerta","Allura","Almarai","Almendra",
  "Amaranth","Amiri","Andada Pro","Antic","Antic Slab","Anonymous Pro","Arapey","Arbutus Slab","Architects Daughter","Archivo Narrow",
  "Aref Ruqaa","Arima","Arimo","Arsenal","Artifika","Arvo","Asar","Athiti","Atkinson Hyperlegible","Audiowide",
  "Autour One","Average","Averia Serif Libre","Bad Script","Bahiana","Bai Jamjuree","Baloo 2","Balsamiq Sans","Bangers","Barlow Condensed",
  "Barlow Semi Condensed","Basic","Baskervville","Battambang","Baumans","Belgrano","Bellefair","Belleza","BenchNine","Berkshire Swash",
  "Besley","Big Shoulders Display","Bigelow Rules","Bilbo","BioRhyme","Biryani","Bevan","Black Ops One","Blinker","Bodoni Moda",
  "Bokor","Boogaloo","Borel","Bowlby One","Brawler","Bree Serif","Bruno Ace","Bubblegum Sans","Buenard","Bungee",
  "Bungee Shade","Butcherman","Butterfly Kids","Cabin Condensed","Cabin Sketch","Caladea","Calistoga","Cambay","Candal","Cantarell",
  "Cantata One","Capriola","Carattere","Carme","Carrois Gothic","Carter One","Castoro","Caudex","Cedarville Cursive","Ceviche One",
  "Chakra Petch","Changa","Changa One","Charm","Charmonman","Chau Philomene One","Chelsea Market","Cherry Swash","Chewy","Chicle",
  "Chonburi","Cinzel","Cinzel Decorative","Clicker Script","Coda","Codystar","Coiny","Combo","Coming Soon","Commissioner",
  "Concert One","Condiment","Content","Contrail One","Convergence","Copse","Corben","Corinthia","Cousine","Coustard",
  "Covered By Your Grace","Crafty Girls","Creepster","Crete Round","Crimson Pro","Croissant One","Crushed","Cuprum","Cute Font","Cutive",
  "Cutive Mono","DM Sans","DM Serif Display","DM Serif Text","DM Mono","Damion","Darker Grotesque","David Libre","Dawning of a New Day","Days One",
  "Dekko","Del Gothic One","Delius","Denk One","Devonshire","Dhurjati","Didact Gothic","Diplomata","Do Hyeon","Dokdo",
  "Domine","Donegal One","Dongle","Doppio One","Dorsa","Duru Sans","DynaPuff","Eagle Lake","East Sea Dokdo","Eater",
  "Economica","Eczar","Edu SA Beginner","El Messiri","Electrolize","Elsie","Emblema One","Emilys Candy","Encode Sans","Engagement",
  "Englebert","Enriqueta","Epilogue","Erica One","Esteban","Euphoria Script","Ewert","Expletus Sans","Fahkwang","Familjen Grotesk",
  "Fanwood Text","Farro","Farsan","Fascinate","Faster One","Fauna One","Faustina","Federo","Felipa","Fenix",
  "Festive","Finger Paint","Finlandica","Fira Code","Fira Mono","Fira Sans Condensed","Fjord One","Flamenco","Flavors","Fleur De Leah",
  "Flow Circular","Fondamento","Fontdiner Swanky","Forum","Fragment Mono","Francois One","Frederic ka the Great","Fredoka","Freehand","Fresca",
  "Frijole","Fruktur","Fugaz One","Fuggles","Fustat","Gabarito","Gabriela","Gaegu","Gafata","Galada",
  "Galdeano","Galindo","Gantari","Gasoek One","Gayathri","Gelasio","Gemunu Libre","Genos","Gentium Book Plus","Geo",
  "Geologica","Georama","Geostar","Germania One","Gideon Roman","Gidugu","Gilda Display","Girassol","Give You Glory","Glass Antiqua",
  "Glegoo","Gloock","Gloria Hallelujah","Glory","Gluten","Goblin One","Gochi Hand","Goldman","Golos Text","Gorditas",
  "Gothic A1","Gotu","Goudy Bookletter 1911","Gowun Batang","Gowun Dodum","Graduate","Grand Hotel","Grandiflora One","Grandstander","Grape Nuts",
  "Gravitas One","Great Vibes","Grechen Fuemen","Grenze","Grey Qo","Griffy","Gruppo","Gudea","Gugi","Gulzar",
  "Gupter","Gurajada","Gwendolyn","Habibi","Hachi Maru Pop","Hahmlet","Halant","Hammersmith One","Hanalei","Handlee",
  "Hanken Grotesk","Hanuman","Happy Monkey","Harmattan","Headland One","Hedvig Letters Serif","Henny Penny","Hepta Slab","Herr Von Muellerhoff","Hi Melody",
  "Hina Mincho","Hind Madurai","Hind Siliguri","Hind Vadodara","Holtwood One SC","Homemade Apple","Homenaje","Hubballi","Hurricane","Iceberg",
  "Iceland","Imbue","Imperial Script","Imprima","Inclusive Sans","Inder","Instrument Sans","Instrument Serif","Inria Sans","Inria Serif",
  "Irish Grover","Island Moments","Istok Web","Italiana","Italianno","Itim","Jacques Francois","Jaldi","JetBrains Mono","Jim Nightshade",
  "Joan","Jockey One","Jolly Lodger","Jomhuria","Jomolhari","Joti One","Jua","Judson","Julee","Julius Sans One",
  "Junge","Jura","Just Another Hand","Just Me Again Down Here","K2D","Kablammo","Kadwa","Kaisei Decol","Kalam","Kameron",
  "Kanit","Kantumruy Pro","Karantina","Karma","Katibeh","Kaushan Script","Kavivanar","Kavoon","Keania One","Kelly Slab",
  "Kenia","Khand","Khula","Kings","Kirang Haerang","Kite One","Kiwi Maru","Klee One","Knewave","KoHo",
  "Kodchasan","Koh Santepheap","Kolker Brush","Konkhmer Sleokchher","Kosugi","Kotta One","Koulen","Kranky","Kreon","Kristi",
  "Krona One","Krub","Kufam","Kulim Park","Kumar One","Kumbh Sans","Kurale","La Belle Aurore","Labrada","Lacquer",
  "Laila","Lakki Reddy","Lalezar","Lancelot","Langar","Lateef","Lavishly Yours","League Gothic","League Script","League Spartan",
  "Leckerli One","Ledger","Lekton","Lemon","Lemonada","Lexend Deca","Lexend Exa","Libre Barcode 39","Libre Bodoni","Libre Caslon Display",
  "Life Savers","Lilita One","Lily Script One","Limelight","Linden Hill","Linefont","Lisu Bosa","Literata","Liu Jian Mao Cao","Livvic",
  "Lobster Two","Londrina Outline","Londrina Solid","Long Cang","Love Light","Love Ya Like A Sister","Loved by the King","Lovers Quarrel","Luckiest Guy","Lusitana",
  "Lustria","Luxurious Roman","Luxurious Script","M PLUS 1","M PLUS Rounded 1c","Ma Shan Zheng","Macondo","Mada","Magra","Maiden Orange",
  "Maitree","Major Mono Display","Mako","Malayalam Sangam MN","Mali","Mallanna","Mandali","Manjari","Manrope","Mansalva",
  "Manuale","Marcellus","Marcellus SC","Marck Script","Margarine","Marhey","Markazi Text","Marko One","Marmelad","Martel",
  "Martel Sans","Martian Mono","Marvel","Mate","Mate SC","Maven Pro","McLaren","Mea Culpa","Meddon","MedievalSharp",
  "Medula One","Meera Inimai","Megrim","Meie Script","Meow Script","Merienda","Merriweather Sans","Metal","Metal Mania","Metamorphous",
  "Metrophobic","Michroma","Milonga","Miltonian","Mina","Mingzat","Miniver","Miriam Libre","Mirza","Miss Fajardose",
  "Mitr","Mochiy Pop One","Modak","Modern Antiqua","Mogra","Mohave","Moirai One","Molengo","Molle","Mona Sans",
  "Monda","Monofett","Monomaniac One","Monoton","Monsieur La Doulaise","Montaga","Montagu Slab","MonteCarlo","Montez","Montserrat Alternates",
  "Moo Lah Lah","Mooli","Moon Dance","Moul","Moulpali","Mountains of Christmas","Mouse Memoirs","Mr Bedfort","Mr Dafoe","Mr De Haviland",
  "Mrs Saint Delafield","Mrs Sheppards","Ms Madi","Mukta Mahee","Mukta Malar","Mukta Vaani","Mulish","Murecho","MuseoModerno","My Soul",
  "Mynerve","Mystery Quest","NTR","Nabla","Nanum Brush Script","Nanum Gothic","Nanum Myeongjo","Nanum Pen Script","Narnoor","Neonderthaw",
  "Nerko One","Neucha","Neuton","New Rocker","New Tegomin","News Cycle","Newsreader","Niconne","Niramit","Nixie One",
  "Nobile","Nokora","Norican","Nosifer","Notable","Nothing You Could Do","Noticia Text","Noto Sans Display","Noto Sans Mono","Noto Serif Display",
  "Nova Cut","Nova Flat","Nova Mono","Nova Oval","Nova Round","Nova Script","Nova Slim","Nova Square","Numans","Nuosu SIL",
  "Odibee Sans","Odor Mean Chey","Offside","Oi","Old Standard TT","Oldenburg","Ole","Oleo Script","Onest","Oooh Baby",
  "Open Sans Condensed","Oranienbaum","Orbit","Orbitron","Oregano","Orelega One","Orienta","Original Surfer","Outfit","Over the Rainbow",
  "Overlock","Overpass Mono","Ovo","Oxanium","Oxygen Mono","PT Mono","PT Sans Caption","PT Sans Narrow","Pacifico","Padauk",
  "Padyakke Expanded One","Palanquin","Palanquin Dark","Palette Mosaic","Pangolin","Paprika","Parisienne","Passero One","Passion One","Passions Conflict",
  "Pathway Extreme","Pathway Gothic One","Patrick Hand","Pattaya","Patua One","Pavanam","Paytone One","Peddana","Peralta","Petemoss",
  "Petit Formal Script","Petrona","Philosopher","Phudu","Piazzolla","Piedra","Pinyon Script","Pirata One","Pixelify Sans","Plaster",
  "Platypi","Play","Playball","Playfair","Playfair Display SC","Playpen Sans","Playwrite AR","Plus Jakarta Sans","Podkova","Poetsen One",
  "Poiret One","Poller One","Poltawski Nowy","Poly","Pompiere","Ponnala","Pontano Sans","Poor Story","Port Lligat Sans","Port Lligat Slab",
  "Potta One","Pragati Narrow","Praise","Prata","Preahvihear","Press Start 2P","Pridi","Princess Sofia","Prociono","Prosto One",
  "Protest Riot","Proza Libre","Puppies Play","Puritan","Purple Purse","Qahiri","Quando","Quantico","Quattrocento","Quattrocento Sans",
  "Quicksand","Quintessential","Qwigley","Qwitcher Grypen","REM","Racing Sans One","Radio Canada","Radley","Rajdhani","Rakkas",
  "Raleway Dots","Ramabhadra","Ramaraja","Rambla","Rammetto One","Rampart One","Ranchers","Rancho","Ranga","Rasa",
  "Rationale","Ravi Prakash","Readex Pro","Recursive","Red Hat Display","Red Hat Mono","Red Hat Text","Red Rose","Redacted","Redressed",
  "Reem Kufi","Reenie Beanie","Reggae One","Rethink Sans","Revalia","Rhodium Libre","Ribeye","Ribeye Marrow","Righteous","Risque",
  "Road Rage","Rochester","Rock Salt","RocknRoll One","Rokkitt","Romanesco","Ropa Sans","Rosario","Rosarivo","Rouge Script",
  "Rowdies","Rozha One","Rubik Bubbles","Rubik Dirt","Rubik Glitch","Rubik Iso","Rubik Marker Hatch","Rubik Mono One","Rubik Moonrocks","Rubik Puddles",
  "Ruda","Rufina","Ruge Boogie","Ruluko","Rum Raisin","Ruslan Display","Russo One","Ruthie","Rye","STIX Two Text",
  "Sacramento","Sahitya","Sail","Saira","Saira Condensed","Saira Stencil One","Salsa","Sanchez","Sancreek","Sansita",
  "Sansita Swashed","Sarabun","Sarala","Sarina","Sarpanch","Sassy Frass","Satisfy","Sawarabi Gothic","Sawarabi Mincho","Scada",
  "Scheherazade New","Schibsted Grotesk","Schoolbell","Scope One","Seaweed Script","Secular One","Sedgwick Ave","Sedgwick Ave Display","Sen","Send Flowers",
  "Sevillana","Seymour One","Shadows Into Light Two","Shalimar","Shantell Sans","Shanti","Share","Share Tech","Shippori Mincho","Shizuru",
  "Shojumaru","Short Stack","Shrikhand","Siemreap","Sigmar","Sigmar One","Signika","Signika Negative","Silkscreen","Simonetta",
  "Single Day","Sintony","Sirin Stencil","Six Caps","Sixtyfour","Skranji","Slabo 27px","Slackey","Smokum","Smooch",
  "Smythe","Sniglet","Snippet","Snowburst One","Sofadi One","Sofia","Sofia Sans","Solitreo","Solway","Sombra",
  "Sono","Sonsie One","Sora","Sorts Mill Goudy","Source Code Pro","Space Quest","Special Elite","Spicy Rice","Spinnaker","Spirax",
  "Splash","Spline Sans","Squada One","Square Peg","Sree Krushnadevaraya","Sriracha","Srisakdi","Staatliches","Stalemate","Stalinist One",
  "Stardos Stencil","Stick","Stick No Bills","Stint Ultra Condensed","Stint Ultra Expanded","Stoke","Strait","Style Script","Stylish","Sue Ellen Francisco",
  "Suez One","Sulphur Point","Sumana","Sunflower","Sunshiney","Supermercado One","Sura","Suranna","Suravaram","Suwannaphum",
  "Swanky and Moo Moo","Syncopate","Syne","Syne Mono","Syne Tactile","Tac One","Tai Heritage Pro","Tajawal","Tangerine","Tapestry",
  "Taprom","Tauri","Taviraj","Telex","Tenali Ramakrishna","Tenor Sans","Text Me One","Texturina","Thasadith","The Girl Next Door",
  "The Nautigal","Tienne","Tillana","Tilt Neon","Tilt Prism","Tilt Warp","Timmana","Tinos","Tiny5","Tiro Devanagari Hindi",
  "Titan One","Tomorrow","Tourney","Trade Winds","Train One","Trirong","Trispace","Trocchi","Trochut","Truculenta",
  "Trykker","Tsukimi Rounded","Tulpen One","Turret Road","Twinkle Star","Ubuntu Condensed","Ubuntu Mono","Uchen","Ultra","Unica One",
  "UnifrakturMaguntia","Unkempt","Unlock","Unna","Updock","Urbanist","VT323","Vampiro One","Varela","Varta",
  "Vast Shadow","Vazirmatn","Vesper Libre","Viaoda Libre","Vibes","Vibur","Victor Mono","Vidaloka","Viga","Vina Sans",
  "Voces","Volkhov","Voltaire","Vujahday Script","Waiting for the Sunrise","Wallpoet","Walter Turncoat","Warnes","Water Brush","Waterfall",
  "Wellfleet","Wendy One","Whisper","WindSong","Wire One","Wittgenstein","Wix Madefor Display","Wix Madefor Text","Workbench","Xanh Mono",
  "Yaldevi","Yanone Kaffeesatz","Yantramanav","Yatra One","Yellowtail","Yeon Sung","Yeseva One","Yesteryear","Yomogi","Young Serif",
  "Yrsa","Ysabeau","Yuji Boku","Yuji Mai","Yuji Syuku","Yusei Magic","ZCOOL KuaiLe","ZCOOL QingKe HuangYou","ZCOOL XiaoWei","Zain",
  "Zen Antique","Zen Dots","Zen Kaku Gothic New","Zen Loop","Zen Maru Gothic","Zen Old Mincho","Zen Tokyo Zoo","Zeyada","Zhi Mang Xing","Zilla Slab Highlight",
];

/** Everything offered in the font pickers. */
export const FONTS = [...GOOGLE_FONTS, ...SYSTEM_FONTS];

const googleSet = new Set(GOOGLE_FONTS);
const requested = new Set<string>();

/** Inject a stylesheet for one Google family the first time it is used. */
export function requestFont(family: string) {
  if (!family || requested.has(family) || !googleSet.has(family)) return;
  requested.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;700;800&display=swap`;
  document.head.appendChild(link);
}

/** Make sure the given families are downloaded and ready before painting a canvas. */
export async function ensureFonts(families?: string[]) {
  const list = (families && families.length ? families : ["Unbounded", "Manrope", "Bebas Neue", "Caveat"])
    .filter((f, i, a) => f && a.indexOf(f) === i);
  list.forEach(requestFont);
  try {
    const f = (document as unknown as { fonts: FontFaceSet }).fonts;
    await Promise.all(
      list.flatMap((n) => [
        f.load(`500 20px "${n}"`).catch(() => []),
        f.load(`800 20px "${n}"`).catch(() => []),
      ]),
    );
    await f.ready;
  } catch { /* fonts optional */ }
}

/** Families used by a set of elements — pass to ensureFonts before painting. */
export const fontsOf = (els: { font?: string }[]) => {
  const list = els.map((e) => e.font || "Manrope").filter((f, i, a) => a.indexOf(f) === i);
  // start downloading immediately so on-screen previews swap in as soon as possible
  list.forEach(requestFont);
  return list;
};

export function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/**
 * Read an image file and downscale it so synced fest data stays small.
 * Keeps aspect ratio, caps the longest side at maxDim, outputs JPEG.
 * Falls back to the raw data URL when anything goes wrong.
 */
export async function fileToSizedDataURL(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  const raw = await fileToDataURL(file);
  try {
    const img = await loadImg(raw);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return raw;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    if (scale >= 1 && file.size <= 350 * 1024) return raw;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext("2d");
    if (!ctx) return raw;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } catch {
    return raw;
  }
}

/* -------- text measuring -------- */
let mCanvas: HTMLCanvasElement | null = null;
export function measureText(text: string, font: string, size: number, bold?: boolean): number {
  if (!mCanvas) mCanvas = document.createElement("canvas");
  const ctx = mCanvas.getContext("2d")!;
  ctx.font = `${bold ? 800 : 500} ${size}px "${font}"`;
  return ctx.measureText(text || " ").width;
}
/**
 * Width of an element's layout box. For text this is the same box the editor draws and
 * the exporter aligns inside, so passing the same `text` to both keeps them pixel-identical.
 */
export const elWidth = (el: TplEl, text?: string) =>
  el.kind === "text"
    ? Math.max(el.w, measureText(text ?? el.text ?? "", el.font || "Manrope", el.size || 20, el.bold) + 10)
    : el.w;

/* -------- pointer drag hook -------- */
export function useDrag(onDelta: (dx: number, dy: number) => void, onEnd?: () => void) {
  const ref = useRef<{ x: number; y: number } | null>(null);
  return (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    ref.current = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      if (!ref.current) return;
      onDelta(ev.clientX - ref.current.x, ev.clientY - ref.current.y);
      ref.current = { x: ev.clientX, y: ev.clientY };
    };
    const up = () => {
      ref.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEnd?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
}

/* -------- canvas painting -------- */
function shapePath(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  if (shape === "circle") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (shape === "heart") {
    // identical geometry to the editor's SVG path "M50 92 C 8 62, 10 22, 50 34 C 90 22, 92 62, 50 92 Z"
    // expressed on a 100x100 viewBox and scaled into the element box
    const px = (n: number) => x + (n / 100) * w;
    const py = (n: number) => y + (n / 100) * h;
    ctx.moveTo(px(50), py(92));
    ctx.bezierCurveTo(px(8), py(62), px(10), py(22), px(50), py(34));
    ctx.bezierCurveTo(px(90), py(22), px(92), py(62), px(50), py(92));
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.closePath();
}

/** Vertical centre of a text element — matches the editor's line-height of 1.15. */
const TEXT_LINE_H = 1.15;

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, zoom = 1) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export interface PaintTpl { w: number; h: number; bg: string; bgImage?: string; }

export async function paintTemplate(
  canvas: HTMLCanvasElement, tpl: PaintTpl, els: TplEl[],
  map: Record<string, { text?: string; src?: string }>, scale = 1,
  opts?: { fixedTextBox?: boolean }
) {
  canvas.width = Math.round(tpl.w * scale);
  canvas.height = Math.round(tpl.h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = tpl.bg;
  ctx.fillRect(0, 0, tpl.w, tpl.h);
  if (tpl.bgImage) {
    try {
      const img = await loadImg(tpl.bgImage);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, tpl.w, tpl.h); ctx.clip();
      drawCover(ctx, img, 0, 0, tpl.w, tpl.h);
      ctx.restore();
    } catch { /* skip */ }
  }
  for (const el of els) {
    const r = map[el.id] || {};
    if (el.kind === "shape") {
      ctx.save();
      shapePath(ctx, el.shape || "rect", el.x, el.y, el.w, el.h);
      ctx.fillStyle = el.color || "#888";
      ctx.fill();
      ctx.restore();
    } else if (el.kind === "image" || el.kind === "qrcode" || el.bind === "qrcode") {
      const src = el.bind ? r.src : el.src;
      ctx.save();
      shapePath(ctx, el.shape || "rect", el.x, el.y, el.w, el.h);
      if (src) {
        try {
          const img = await loadImg(src);
          ctx.clip();
          drawCover(ctx, img, el.x, el.y, el.w, el.h, el.zoom || 1);
          ctx.restore();
          continue;
        } catch { /* fallback below */ }
      }
      ctx.fillStyle = "#c4c9bd";
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = "#5c665a";
      ctx.font = `700 ${Math.min(el.w, el.h) * 0.4}px "Manrope"`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((r.text || "?").slice(0, 1).toUpperCase(), el.x + el.w / 2, el.y + el.h / 2);
      ctx.restore();
    } else {
      const text = el.bind ? (r.text ?? el.text ?? "") : (el.text ?? "");
      const size = el.size || 20;
      ctx.save();
      ctx.font = `${el.bold ? 800 : 500} ${size}px "${el.font || "Manrope"}"`;
      ctx.fillStyle = el.color || "#222";
      const align = el.align || "center";
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      // The editor lays text out inside a box that starts at el.x. With fixedTextBox
      // (posters) both editor and export align inside el.w, so the layout is identical
      // no matter what text fills it. Otherwise the box auto-expands to the text.
      const boxW = opts?.fixedTextBox ? el.w : elWidth(el, text);
      let tx = el.x;
      if (align === "center") tx = el.x + boxW / 2;
      if (align === "right") tx = el.x + boxW;
      ctx.fillText(text, tx, el.y + (size * TEXT_LINE_H) / 2);
      ctx.restore();
    }
  }
}

export function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((b) => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }, "image/png");
}
