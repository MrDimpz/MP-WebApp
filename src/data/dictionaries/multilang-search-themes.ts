import {
  type DictionaryLanguageCode,
  stripDiacritics,
} from '../../lib/dictionary-languages';
import { getMultiLangPack } from './multilang-word-packs';

export interface MultiLangSearchTheme {
  title: string;
  category: string;
  pool: string[];
}

export interface MultiLangDeStackBank {
  wordBank: Array<{ word: string; hint: string }>;
  wordMasks: Uint32Array;
  wordFirstBits: Uint32Array;
  wordCharBits: Uint32Array;
  dict5Words: string[];
  dict5Masks: Uint32Array;
  dict5Chars: Uint8Array;
  dict5Buckets: number[][];
}

function normalizePool(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const clean = stripDiacritics(raw).toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.length >= 4 && clean.length <= 9 && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

export const MULTILANG_MPSEARCH_THEMES: Record<
  Exclude<DictionaryLanguageCode, 'en'>,
  MultiLangSearchTheme[]
> = {
  es: [
    {
      title: 'Cosecha de Otoño',
      category: 'Estaciones y Naturaleza',
      pool: normalizePool(['BELLOTA', 'ARCE', 'SIDRA', 'HUERTO', 'CALABAZA', 'COSECHA', 'AMBAR', 'TRIGO', 'HOJAS', 'BRISA', 'BOSQUE', 'NUEZ']),
    },
    {
      title: 'Observatorio Estelar',
      category: 'Astronomía',
      pool: normalizePool(['COMETA', 'NEBULOSA', 'ORBITA', 'ECLIPSE', 'GALAXIA', 'METEORO', 'COSMOS', 'SATURNO', 'PLANETA', 'ESTRELLA', 'LUNA', 'SOLAR']),
    },
    {
      title: 'Jardín Botánico',
      category: 'Flora y Jardines',
      pool: normalizePool(['ORQUIDEA', 'HELECHO', 'JAZMIN', 'PETALO', 'POLEN', 'NECTAR', 'TREBOL', 'SAUCE', 'TULIPAN', 'GIRASOL', 'ROSA', 'LIRIO']),
    },
    {
      title: 'Cafetería Artesanal',
      category: 'Gastronomía',
      pool: normalizePool(['AROMA', 'TUESTE', 'BARISTA', 'MOCA', 'CREMA', 'FILTRO', 'CARAMELO', 'VAPOR', 'CACAO', 'LECHE', 'AZUCAR', 'TAZA']),
    },
    {
      title: 'Travesía Oceánica',
      category: 'Náutica',
      pool: normalizePool(['ANCLA', 'BRUJULA', 'PUERTO', 'FARO', 'TRAVESIA', 'GALEON', 'MARINO', 'LAGUNA', 'CORAL', 'OLEAJE', 'VELERO', 'ISLA']),
    },
    {
      title: 'Sinfonía Clásica',
      category: 'Música y Arte',
      pool: normalizePool(['SONATA', 'VIOLIN', 'CORO', 'MAESTRO', 'OBOE', 'OCTAVA', 'MELODIA', 'PIANO', 'ARPA', 'FLAUTA', 'RITMO', 'OPERA']),
    },
    {
      title: 'Expedición Alpina',
      category: 'Geografía',
      pool: normalizePool(['CUMBRE', 'GLACIAR', 'CRESTA', 'GRANITO', 'VALLE', 'MESETA', 'ASCENSO', 'FIORDO', 'NIEVE', 'MONTE', 'SENDERO', 'ROCA']),
    },
    {
      title: 'Huerta Aromática',
      category: 'Cocina',
      pool: normalizePool(['TOMILLO', 'ALBAHACA', 'OREGANO', 'AZAFRAN', 'HINOJO', 'SALVIA', 'PEREJIL', 'MENTA', 'CANELA', 'CLAVO', 'LAUREL', 'ROMERO']),
    },
    {
      title: 'Fauna del Bosque',
      category: 'Animales',
      pool: normalizePool(['TEJON', 'HALCON', 'NUTRIA', 'GARZA', 'CASTOR', 'LINCE', 'GORRION', 'CIERVO', 'ZORRO', 'BUHO', 'LOBO', 'ARDILLA']),
    },
    {
      title: 'Librería Antigua',
      category: 'Literatura',
      pool: normalizePool(['FOLIO', 'SONETO', 'ARCHIVO', 'MEMORIA', 'CAPITULO', 'EDICION', 'INDICE', 'PROSA', 'ESTROFA', 'NOVELA', 'POEMA', 'CUENTO']),
    },
    {
      title: 'Gabinete Mineral',
      category: 'Geología',
      pool: normalizePool(['GRANATE', 'TOPACIO', 'AGATA', 'COBALTO', 'JASPE', 'CRISTAL', 'OPALO', 'MARMOL', 'PIZARRA', 'CUARZO', 'ZAFIRO', 'RUBI']),
    },
    {
      title: 'Estación del Clima',
      category: 'Meteorología',
      pool: normalizePool(['MONZON', 'TORMENTA', 'BRISA', 'CICLON', 'TRUENO', 'ESCARCHA', 'NIEBLA', 'LLUVIA', 'VIENTO', 'NUBE', 'GRANIZO', 'RAYO']),
    },
    {
      title: 'Panadería de Barrio',
      category: 'Horneado',
      pool: normalizePool(['CORTEZA', 'TRIGO', 'PASTEL', 'SESAMO', 'HARINA', 'MIGA', 'LEVADURA', 'BOLLO', 'HORNO', 'MASA', 'ROSCA', 'TARTA']),
    },
    {
      title: 'Arrecife de Coral',
      category: 'Vida Marina',
      pool: normalizePool(['DELFIN', 'PULPO', 'LANGOSTA', 'ESPONJA', 'PLANCTON', 'ARRECIFE', 'MAREA', 'TIBURON', 'BALLENA', 'TORTUGA', 'MEDUSA', 'CORAL']),
    },
    {
      title: 'Mercado de Frutas',
      category: 'Mercado',
      pool: normalizePool(['NARANJA', 'MANZANA', 'PLATANO', 'SANDIA', 'MELON', 'CEREZA', 'CIRUELA', 'DURAZNO', 'LIMON', 'MANGO', 'FRESA', 'PERA']),
    },
    {
      title: 'Castillo Medieval',
      category: 'Historia',
      pool: normalizePool(['CASTILLO', 'MURALLA', 'TORREON', 'ESCUDO', 'ESPADA', 'CORONA', 'CABALLO', 'PUENTE', 'ANTORCHA', 'TESORO', 'REINO', 'TRONO']),
    },
  ],
  fr: [
    {
      title: 'Récolte d’Automne',
      category: 'Saisons et Nature',
      pool: normalizePool(['GLAND', 'ERABLE', 'CIDRE', 'VERGER', 'CITROUILLE', 'RECOLTE', 'AMBRE', 'FEUILLE', 'BRUME', 'FORET', 'NOISETTE', 'CHAMPS']),
    },
    {
      title: 'Observatoire Céleste',
      category: 'Astronomie',
      pool: normalizePool(['COMETE', 'NEBULEUSE', 'ORBITE', 'ECLIPSE', 'GALAXIE', 'METEORE', 'COSMOS', 'SATURNE', 'PLANETE', 'ETOILE', 'LUNE', 'SOLEIL']),
    },
    {
      title: 'Jardin Botanique',
      category: 'Flore et Jardins',
      pool: normalizePool(['ORCHIDEE', 'FOUGERE', 'JASMIN', 'PIVOINE', 'PETALE', 'POLLEN', 'NECTAR', 'TREFLE', 'SAULE', 'TULIPE', 'FLEUR', 'LILAS']),
    },
    {
      title: 'Boulangerie Artisanale',
      category: 'Gastronomie',
      pool: normalizePool(['BRIOCHE', 'CROUTE', 'LEVAIN', 'FARINE', 'BAGUETTE', 'CROISSANT', 'TARTE', 'GATEAU', 'PAIN', 'BEURRE', 'MIEL', 'SUCRE']),
    },
    {
      title: 'Voyages Océaniques',
      category: 'Maritime',
      pool: normalizePool(['ANCRE', 'BOUSSOLE', 'PORT', 'PHARE', 'VOYAGE', 'GALION', 'MARIN', 'LAGON', 'CORAIL', 'VOILIER', 'NAVIRE', 'VAGUE']),
    },
    {
      title: 'Symphonie Classique',
      category: 'Musique et Arts',
      pool: normalizePool(['SONATE', 'VIOLON', 'CHOEUR', 'MAESTRO', 'HAUTBOIS', 'OCTAVE', 'MELODIE', 'PIANO', 'HARPE', 'FLUTE', 'RYTHME', 'OPERA']),
    },
    {
      title: 'Expédition Alpine',
      category: 'Géographie',
      pool: normalizePool(['SOMMET', 'GLACIER', 'CRETE', 'GRANIT', 'VALLEE', 'PLATEAU', 'CHALET', 'FJORD', 'NEIGE', 'SENTIER', 'ROCHER', 'MONTAGNE']),
    },
    {
      title: 'Jardin d’Herbes',
      category: 'Cuisine',
      pool: normalizePool(['THYM', 'BASILIC', 'ORIGAN', 'SAFRAN', 'FENOUIL', 'SAUGE', 'PERSIL', 'MENTHE', 'CANNELLE', 'LAURIER', 'ROMARIN', 'EPICE']),
    },
    {
      title: 'Faune Forestière',
      category: 'Animaux',
      pool: normalizePool(['BLAIREAU', 'FAUCON', 'LOUTRE', 'HERON', 'CASTOR', 'LYNX', 'MOINEAU', 'CERF', 'RENARD', 'HIBOU', 'LOUP', 'ECUREUIL']),
    },
    {
      title: 'Librairie Ancienne',
      category: 'Littérature',
      pool: normalizePool(['SONNET', 'ARCHIVE', 'MEMOIRE', 'CHAPITRE', 'EDITION', 'PROSE', 'ROMAN', 'POEME', 'CONTE', 'LIVRE', 'PAGE', 'PLUME']),
    },
    {
      title: 'Cabinet Minéral',
      category: 'Géologie',
      pool: normalizePool(['GRENAT', 'TOPAZE', 'AGATE', 'COBALT', 'JASPE', 'CRISTAL', 'OPALE', 'MARBRE', 'ARDOISE', 'QUARTZ', 'SAPHIR', 'RUBIS']),
    },
    {
      title: 'Station Météo',
      category: 'Météorologie',
      pool: normalizePool(['MOUSSON', 'TEMPETE', 'BRISE', 'CYCLONE', 'TONNERRE', 'GIVRE', 'BRUME', 'PLUIE', 'ORAGE', 'NUAGE', 'GRELE', 'ECLAIR']),
    },
    {
      title: 'Récif Corallien',
      category: 'Vie Marine',
      pool: normalizePool(['DAUPHIN', 'PIEUVRE', 'HOMARD', 'EPONGE', 'PLANCTON', 'RECIF', 'MAREE', 'REQUIN', 'BALEINE', 'TORTUE', 'MEDUSE', 'CRABE']),
    },
    {
      title: 'Marché Provençal',
      category: 'Marché',
      pool: normalizePool(['ORANGE', 'POMME', 'BANANE', 'MELON', 'CERISE', 'PRUNE', 'PECHE', 'CITRON', 'MANGUE', 'FRAISE', 'POIRE', 'RAISIN']),
    },
    {
      title: 'Château Médiéval',
      category: 'Histoire',
      pool: normalizePool(['CHATEAU', 'DONJON', 'BOUCLIER', 'EPEE', 'COURONNE', 'CHEVAL', 'PONT', 'TORCHE', 'TRESOR', 'ROYAUME', 'TRONE', 'ARMURE']),
    },
    {
      title: 'Atelier de Peintre',
      category: 'Beaux-Arts',
      pool: normalizePool(['PALETTE', 'TOILE', 'PINCEAU', 'ESQUISSE', 'PORTRAIT', 'PASTEL', 'MOSAIQUE', 'ATELIER', 'FRESQUE', 'COULEUR', 'OMBRE', 'CADRE']),
    },
  ],
  de: [
    {
      title: 'Herbsternte',
      category: 'Jahreszeiten & Natur',
      pool: normalizePool(['EICHEL', 'AHORN', 'APFEL', 'GARTEN', 'KURBIS', 'ERNTE', 'BERNSTEIN', 'WEIZEN', 'LAUB', 'BRISE', 'WALD', 'HERBST']),
    },
    {
      title: 'Sternwarte',
      category: 'Astronomie',
      pool: normalizePool(['KOMET', 'NEBEL', 'ORBIT', 'GALAXIE', 'METEOR', 'KOSMOS', 'SATURN', 'PLANET', 'STERN', 'MOND', 'SONNE', 'RAKETE']),
    },
    {
      title: 'Botanischer Garten',
      category: 'Flora & Pflanzen',
      pool: normalizePool(['ORCHIDEE', 'FARN', 'JASMIN', 'BLUTE', 'POLLEN', 'NEKTAR', 'KLEE', 'WEIDE', 'TULPE', 'BLUME', 'ROSE', 'LILIE']),
    },
    {
      title: 'Bäckerei & Café',
      category: 'Genuss',
      pool: normalizePool(['BREZEL', 'KRUSTE', 'WEIZEN', 'KUCHEN', 'SESAM', 'MEHL', 'HEFE', 'BROT', 'TORTE', 'KAFFEE', 'HONIG', 'ZUCKER']),
    },
    {
      title: 'Seefahrt & Ozean',
      category: 'Maritim',
      pool: normalizePool(['ANKER', 'KOMPASS', 'HAFEN', 'LEUCHTE', 'REISE', 'SEGLER', 'LAGUNE', 'KORALLE', 'SCHIFF', 'WELLE', 'INSEL', 'STRAND']),
    },
    {
      title: 'Klassische Sinfonie',
      category: 'Musik & Kunst',
      pool: normalizePool(['SONATE', 'GEIGE', 'CHOR', 'MAESTRO', 'OBOE', 'OKTAVE', 'MELODIE', 'KLAVIER', 'HARFE', 'FLOTE', 'TAKTE', 'OPER']),
    },
    {
      title: 'Alpen-Expedition',
      category: 'Geografie',
      pool: normalizePool(['GIPFEL', 'GLETSCHER', 'GRAT', 'GRANIT', 'TAL', 'PLATEAU', 'HUTTE', 'FJORD', 'SCHNEE', 'BERG', 'PFAD', 'FELSEN']),
    },
    {
      title: 'Kräutergarten',
      category: 'Küche',
      pool: normalizePool(['THYMIAN', 'BASILIK', 'OREGANO', 'SAFRAN', 'FENCHEL', 'SALBEI', 'MINZE', 'ZIMT', 'NELKE', 'LORBEER', 'KRAUT', 'PFEFFER']),
    },
    {
      title: 'Waldtiere',
      category: 'Tierwelt',
      pool: normalizePool(['DACHS', 'FALKE', 'OTTER', 'REIHER', 'BIBER', 'LUCHS', 'SPATZ', 'HIRSCH', 'FUCHS', 'EULE', 'WOLF', 'HASE']),
    },
    {
      title: 'Alte Buchhandlung',
      category: 'Literatur',
      pool: normalizePool(['SONETT', 'ARCHIV', 'KAPITEL', 'AUSGABE', 'PROSA', 'ROMAN', 'GEDICHT', 'BUCH', 'SEITE', 'FEDER', 'TINTE', 'LESEN']),
    },
    {
      title: 'Mineralienkabinett',
      category: 'Geologie',
      pool: normalizePool(['GRANAT', 'TOPAS', 'ACHAT', 'KOBALT', 'JASPIS', 'KRISTALL', 'OPAL', 'MARMOR', 'SCHIEFER', 'QUARZ', 'SAPHIR', 'RUBIN']),
    },
    {
      title: 'Wetterstation',
      category: 'Wetter',
      pool: normalizePool(['MONSUN', 'STURM', 'BRISE', 'ZYKLON', 'DONNER', 'FROST', 'NEBEL', 'REGEN', 'WIND', 'WOLKE', 'HAGEL', 'BLITZ']),
    },
    {
      title: 'Korallenriff',
      category: 'Meeresleben',
      pool: normalizePool(['DELFIN', 'KRAKE', 'HUMMER', 'SCHWAMM', 'PLANKTON', 'RIFF', 'FLUT', 'HAI', 'WAL', 'QUALLE', 'KRABBE', 'FISCH']),
    },
    {
      title: 'Obstmarkt',
      category: 'Markt',
      pool: normalizePool(['ORANGE', 'APFEL', 'BANANE', 'MELONE', 'KIRSCHE', 'PFLAUME', 'BIRNE', 'ZITRONE', 'MANGO', 'BEERE', 'TRAUBE', 'PFIRSICH']),
    },
    {
      title: 'Mittelalterburg',
      category: 'Geschichte',
      pool: normalizePool(['BURG', 'MAUER', 'TURM', 'SCHILD', 'SCHWERT', 'KRONE', 'PFERD', 'BRUCKE', 'FACKEL', 'SCHATZ', 'REICH', 'THRON']),
    },
    {
      title: 'Maleratelier',
      category: 'Kunst',
      pool: normalizePool(['PALETTE', 'LEINWAND', 'PINSEL', 'SKIZZE', 'PORTRAIT', 'PASTELL', 'MOSAIK', 'ATELIER', 'FRESKO', 'FARBE', 'RAHMEN', 'BILD']),
    },
  ],
  it: [
    {
      title: 'Raccolto d’Autunno',
      category: 'Stagioni e Natura',
      pool: normalizePool(['GHIANDA', 'ACERO', 'SIDRO', 'FRUTTETO', 'ZUCCA', 'RACCOLTO', 'AMBRA', 'GRANO', 'FOGLIA', 'BREZZA', 'BOSCO', 'NOCE']),
    },
    {
      title: 'Osservatorio Celeste',
      category: 'Astronomia',
      pool: normalizePool(['COMETA', 'NEBULOSA', 'ORBITA', 'ECLISSI', 'GALASSIA', 'METEORA', 'COSMO', 'SATURNO', 'PIANETA', 'STELLA', 'LUNA', 'SOLE']),
    },
    {
      title: 'Giardino Botanico',
      category: 'Flora e Giardini',
      pool: normalizePool(['ORCHIDEA', 'FELCE', 'PETALO', 'POLLINE', 'NETTARE', 'TRIFOGLIO', 'SALICE', 'TULIPANO', 'GIRASOLE', 'FIORE', 'ROSA', 'GIGLIO']),
    },
    {
      title: 'Torrefazione Artigiana',
      category: 'Gastronomia',
      pool: normalizePool(['AROMA', 'TOSTATO', 'BARISTA', 'MOKA', 'CREMA', 'FILTRO', 'CARAMELLO', 'VAPORE', 'CACAO', 'LATTE', 'CAFFE', 'TAZZA']),
    },
    {
      title: 'Viaggi Oceanici',
      category: 'Mare',
      pool: normalizePool(['ANCORA', 'BUSSOLA', 'PORTO', 'FARO', 'VIAGGIO', 'GALEONE', 'MARINAIO', 'LAGUNA', 'CORALLO', 'VELIERO', 'NAVE', 'ISOLA']),
    },
    {
      title: 'Sinfonia Classica',
      category: 'Musica e Arte',
      pool: normalizePool(['SONATA', 'VIOLINO', 'CORO', 'MAESTRO', 'OBOE', 'OTTAVA', 'MELODIA', 'PIANO', 'ARPA', 'FLAUTO', 'RITMO', 'OPERA']),
    },
    {
      title: 'Spedizione Alpina',
      category: 'Geografia',
      pool: normalizePool(['VETTA', 'GHIACCIO', 'CRESTA', 'GRANITO', 'VALLE', 'ALTIPIANO', 'BAITA', 'FIORDO', 'NEVE', 'MONTE', 'SENTIERO', 'ROCCIA']),
    },
    {
      title: 'Orto Aromatico',
      category: 'Cucina',
      pool: normalizePool(['TIMO', 'BASILICO', 'ORIGANO', 'ZAFFERANO', 'FINOCCHIO', 'SALVIA', 'MENTA', 'CANNELLA', 'ALLORO', 'ROSMARINO', 'SPEZIA', 'PEPE']),
    },
    {
      title: 'Fauna del Bosco',
      category: 'Animali',
      pool: normalizePool(['TASSO', 'FALCO', 'LONTRA', 'AIRONE', 'CASTORO', 'LINCE', 'PASSERO', 'CERVO', 'VOLPE', 'GUFO', 'LUPO', 'LEPRE']),
    },
    {
      title: 'Libreria Antica',
      category: 'Letteratura',
      pool: normalizePool(['SONETTO', 'ARCHIVIO', 'MEMORIA', 'CAPITOLO', 'EDIZIONE', 'INDICE', 'PROSA', 'ROMANZO', 'POEMA', 'LIBRO', 'PAGINA', 'PIUMA']),
    },
    {
      title: 'Gabinetto Minerale',
      category: 'Geologia',
      pool: normalizePool(['GRANATO', 'TOPAZIO', 'AGATA', 'COBALTO', 'DIASPRO', 'CRISTALLO', 'OPALE', 'MARMO', 'ARDESIA', 'QUARZO', 'ZAFFIRO', 'RUBINO']),
    },
    {
      title: 'Stazione Meteo',
      category: 'Meteorologia',
      pool: normalizePool(['MONSONE', 'TEMPESTA', 'BREZZA', 'CICLONE', 'TUONO', 'BRINA', 'NEBBIA', 'PIOGGIA', 'VENTO', 'NUVOLA', 'GRANDINE', 'LAMPO']),
    },
    {
      title: 'Barriera Corallina',
      category: 'Vita Marina',
      pool: normalizePool(['DELFINO', 'POLPO', 'ARAGOSTA', 'SPUGNA', 'PLANCTON', 'MAREA', 'SQUALO', 'BALENA', 'TARTARUGA', 'MEDUSA', 'GRANCHIO', 'PESCE']),
    },
    {
      title: 'Mercato della Frutta',
      category: 'Mercato',
      pool: normalizePool(['ARANCIA', 'MELA', 'BANANA', 'ANGURIA', 'MELONE', 'CILIEGIA', 'PRUGNA', 'PESCA', 'LIMONE', 'MANGO', 'FRAGOLA', 'PERA']),
    },
    {
      title: 'Castello Medievale',
      category: 'Storia',
      pool: normalizePool(['CASTELLO', 'TORRE', 'SCUDO', 'SPADA', 'CORONA', 'CAVALLO', 'PONTE', 'TORCIA', 'TESORO', 'REGNO', 'TRONO', 'ARMATURA']),
    },
    {
      title: 'Bottega del Pittore',
      category: 'Belle Arti',
      pool: normalizePool(['TAVOLOZZA', 'TELA', 'PENNELLO', 'SCHIZZO', 'RITRATTO', 'PASTELLO', 'MOSAICO', 'STUDIO', 'AFFRESCO', 'COLORE', 'CORNICE', 'QUADRO']),
    },
  ],
  pt: [
    {
      title: 'Colheita de Outono',
      category: 'Estações e Natureza',
      pool: normalizePool(['BOLOTA', 'BORDO', 'SIDRA', 'POMAR', 'ABOBORA', 'COLHEITA', 'AMBAR', 'TRIGO', 'FOLHA', 'BRISA', 'BOSQUE', 'NOZES']),
    },
    {
      title: 'Observatório Estelar',
      category: 'Astronomia',
      pool: normalizePool(['COMETA', 'NEBULOSA', 'ORBITA', 'ECLIPSE', 'GALAXIA', 'METEORO', 'COSMOS', 'SATURNO', 'PLANETA', 'ESTRELA', 'LUA', 'SOLAR']),
    },
    {
      title: 'Jardim Botânico',
      category: 'Flora e Jardins',
      pool: normalizePool(['ORQUIDEA', 'SAMAMBAIA', 'JASMIM', 'PETALA', 'POLEN', 'NECTAR', 'TREVO', 'SALGUEIRO', 'TULIPA', 'GIRASSOL', 'FLOR', 'LIRIO']),
    },
    {
      title: 'Cafeteria Artesanal',
      category: 'Gastronomia',
      pool: normalizePool(['AROMA', 'TORRA', 'BARISTA', 'MOCA', 'CREME', 'FILTRO', 'CARAMELO', 'VAPOR', 'CACAU', 'LEITE', 'ACUCAR', 'XICARA']),
    },
    {
      title: 'Viagens Oceânicas',
      category: 'Náutica',
      pool: normalizePool(['ANCORA', 'BUSSOLA', 'PORTO', 'FAROL', 'VIAGEM', 'GALEAO', 'MARUJO', 'LAGOA', 'CORAL', 'VELEIRO', 'NAVIO', 'ILHA']),
    },
    {
      title: 'Sinfonia Clássica',
      category: 'Música e Arte',
      pool: normalizePool(['SONATA', 'VIOLINO', 'CORAL', 'MAESTRO', 'OBOE', 'OITAVA', 'MELODIA', 'PIANO', 'HARPA', 'FLAUTA', 'RITMO', 'OPERA']),
    },
    {
      title: 'Expedição Alpina',
      category: 'Geografia',
      pool: normalizePool(['CUME', 'GELEIRA', 'CRISTA', 'GRANITO', 'VALE', 'PLANALTO', 'CHALE', 'FIORDE', 'NEVE', 'MONTE', 'TRILHA', 'ROCHA']),
    },
    {
      title: 'Horta Aromática',
      category: 'Culinária',
      pool: normalizePool(['TOMILHO', 'OREGANO', 'ACAFRAO', 'FUNCHO', 'SALVIA', 'SALSA', 'HORTELA', 'CANELA', 'CRAVO', 'LOURO', 'ALECRIM', 'ERVAS']),
    },
    {
      title: 'Fauna da Floresta',
      category: 'Animais',
      pool: normalizePool(['TEXUGO', 'FALCAO', 'LONTRA', 'GARCA', 'CASTOR', 'LINCE', 'PARDAL', 'CERVO', 'RAPOSA', 'CORUJA', 'LOBO', 'ESQUILO']),
    },
    {
      title: 'Livraria Antiga',
      category: 'Literatura',
      pool: normalizePool(['SONETO', 'ARQUIVO', 'MEMORIA', 'CAPITULO', 'EDICAO', 'INDICE', 'PROSA', 'ROMANCE', 'POEMA', 'CONTO', 'LIVRO', 'PAGINA']),
    },
    {
      title: 'Gabinete Mineral',
      category: 'Geologia',
      pool: normalizePool(['GRANADA', 'TOPAZIO', 'AGATA', 'COBALTO', 'JASPE', 'CRISTAL', 'OPALA', 'MARMORE', 'ARDOSIA', 'QUARTZO', 'SAFIRA', 'RUBI']),
    },
    {
      title: 'Estação do Clima',
      category: 'Meteorologia',
      pool: normalizePool(['MONCAO', 'TORMENTA', 'BRISA', 'CICLONE', 'TROVAO', 'GEADA', 'NEBLINA', 'CHUVA', 'VENTO', 'NUVEM', 'GRANIZO', 'RAIO']),
    },
    {
      title: 'Recife de Coral',
      category: 'Vida Marinha',
      pool: normalizePool(['GOLFINHO', 'POLVO', 'LAGOSTA', 'ESPONJA', 'PLANCTON', 'RECIFE', 'MARE', 'TUBARAO', 'BALEIA', 'TARTARUGA', 'MEDUSA', 'PEIXE']),
    },
    {
      title: 'Feira de Frutas',
      category: 'Mercado',
      pool: normalizePool(['LARANJA', 'BANANA', 'MELANCIA', 'MELAO', 'CEREJA', 'AMEIXA', 'PESSEGO', 'LIMAO', 'MANGA', 'MORANGO', 'PERA', 'ABACAXI']),
    },
    {
      title: 'Castelo Medieval',
      category: 'História',
      pool: normalizePool(['CASTELO', 'MURALHA', 'TORRE', 'ESCUDO', 'ESPADA', 'COROA', 'CAVALO', 'PONTE', 'TOCHA', 'TESOURO', 'REINO', 'TRONO']),
    },
    {
      title: 'Ateliê de Pintura',
      category: 'Belas Artes',
      pool: normalizePool(['PALETA', 'TELA', 'PINCEL', 'ESBOCO', 'RETRATO', 'PASTEL', 'MOSAICO', 'ATELIE', 'AFRESCO', 'CORES', 'MOLDURA', 'QUADRO']),
    },
  ],
  tl: [
    {
      title: 'Pagkaing Pinoy',
      category: 'Lutuin',
      pool: normalizePool(['ADOBO', 'SINIGANG', 'LUMPIA', 'LECHON', 'PANCIT', 'BIBINGKA', 'KAREKARE', 'TINOLA', 'SISIG', 'BULALO', 'PUTO', 'TURON']),
    },
    {
      title: 'Prutas sa Palengke',
      category: 'Ani at Prutas',
      pool: normalizePool(['MANGGA', 'SAGING', 'PINYA', 'PAKWAN', 'PAPAYA', 'BAYABAS', 'RAMBUTAN', 'DURIAN', 'LANSONES', 'NIYOG', 'ATIS', 'CHICO']),
    },
    {
      title: 'Gulay sa Bahay Kubo',
      category: 'Halaman',
      pool: normalizePool(['TALONG', 'KALABASA', 'SITAW', 'AMPALAYA', 'KAMATIS', 'SIBUYAS', 'BAWANG', 'PATATAS', 'LABANOS', 'MUSTASA', 'SINGKAMAS', 'PATOLA']),
    },
    {
      title: 'Hayop sa Pilipinas',
      category: 'Kalikasan',
      pool: normalizePool(['KALABAW', 'AGILA', 'TARSIER', 'PAGONG', 'BUWAYA', 'UNGGOY', 'KABAYO', 'MANOK', 'PALAKA', 'PARUPARO', 'BALYENA', 'PATING']),
    },
    {
      title: 'Kalikasan at Panahon',
      category: 'Kapaligiran',
      pool: normalizePool(['BUNDOK', 'BULKAN', 'DAGAT', 'ILOG', 'GUBAT', 'BAGYO', 'KIDLAT', 'KULOG', 'BAHAGHARI', 'HANGIN', 'ULAP', 'ULAN']),
    },
    {
      title: 'Sa Loob ng Bahay',
      category: 'Tahanan',
      pool: normalizePool(['KUSINA', 'KWARTO', 'BINTANA', 'PINTUAN', 'HAGDAN', 'BUBONG', 'LAMPARA', 'SILID', 'KAMA', 'MESA', 'SILYA', 'UNAN']),
    },
    {
      title: 'Laro ng Lahi',
      category: 'Kultura',
      pool: normalizePool(['PATINTERO', 'SUNGKA', 'SIPA', 'TUMBANG', 'TRUMPO', 'HOLEN', 'PIKO', 'TAGUAN', 'HABULAN', 'LANGIT', 'LUPA', 'TAYA']),
    },
    {
      title: 'Pista at Tradisyon',
      category: 'Pagdiriwang',
      pool: normalizePool(['PAROL', 'PISTA', 'HARANA', 'SAYAW', 'KANTA', 'BANDILA', 'PAPUTOK', 'SIMBANG', 'REGALO', 'MUSIKA', 'GITARA', 'TAMBOL']),
    },
    {
      title: 'Sasakyan sa Kalsada',
      category: 'Biyahe',
      pool: normalizePool(['JEEPNEY', 'KALESA', 'TRICYCLE', 'BANGKA', 'BARKO', 'EROPLANO', 'BISIKLETA', 'KOTSE', 'TREN', 'TRAK', 'TULAY', 'KALYE']),
    },
    {
      title: 'Sa Paaralan',
      category: 'Edukasyon',
      pool: normalizePool(['GURO', 'AKLAT', 'LAPIS', 'PAPEL', 'PISARA', 'KLASE', 'SULAT', 'BASA', 'ARALIN', 'KWADERNO', 'PAMBURA', 'SILID']),
    },
    {
      title: 'Kalangitan at Bituin',
      category: 'Astronomiya',
      pool: normalizePool(['ARAW', 'BUWAN', 'BITUIN', 'TALA', 'PLANETA', 'KOMETA', 'ULAP', 'LANGIT', 'SINAG', 'LIWANAG', 'DILIM', 'GABI']),
    },
    {
      title: 'Buhay sa Dagat',
      category: 'Karagatan',
      pool: normalizePool(['ISDA', 'ALIMANGO', 'HIPON', 'PUGITA', 'TAHONG', 'KORALES', 'ALON', 'DALUYONG', 'BUHANGIN', 'PULO', 'BANGKA', 'LAMBAT']),
    },
    {
      title: 'Mga Kulay at Sining',
      category: 'Sining',
      pool: normalizePool(['PULA', 'ASUL', 'DILAW', 'BERDE', 'LILA', 'KAHEL', 'PUTI', 'ITIM', 'PINTA', 'KULAY', 'HUGIS', 'GUHIT']),
    },
    {
      title: 'Katawan ng Tao',
      category: 'Kalusugan',
      pool: normalizePool(['MATA', 'ILONG', 'BIBIG', 'TAINGA', 'NGIPIN', 'DILA', 'KAMAY', 'BALIKAT', 'TUHOD', 'PUSO', 'UTAK', 'BUHOK']),
    },
    {
      title: 'Pamilya at Kaibigan',
      category: 'Lipunan',
      pool: normalizePool(['NANAY', 'TATAY', 'KUYA', 'LOLO', 'LOLA', 'KAPATID', 'KAIBIGAN', 'PINSAN', 'ANAK', 'PAMILYA', 'BAYAN', 'KAPWA']),
    },
    {
      title: 'Alamat at Hiwaga',
      category: 'Mitolohiya',
      pool: normalizePool(['DIWATA', 'SIRENA', 'KAPRE', 'DUWENDE', 'DRAGON', 'HARI', 'REYNA', 'PRINSIPE', 'PRINSESA', 'KASTILYO', 'KORONA', 'ESPADA']),
    },
  ],
};

function formatDeStackHint(code: Exclude<DictionaryLanguageCode, 'en'>, word: string): string {
  const first = word[0];
  const last = word[word.length - 1];
  switch (code) {
    case 'es':
      return `Empieza por "${first}" · Termina en "${last}" · 5 letras únicas`;
    case 'fr':
      return `Commence par "${first}" · Finit par "${last}" · 5 lettres uniques`;
    case 'de':
      return `Beginnt mit "${first}" · Endet auf "${last}" · 5 verschiedene Buchstaben`;
    case 'it':
      return `Inizia con "${first}" · Finisce con "${last}" · 5 lettere uniche`;
    case 'pt':
      return `Começa com "${first}" · Termina com "${last}" · 5 letras únicas`;
    case 'tl':
      return `Nagsisimula sa "${first}" · Nagtatapos sa "${last}" · 5 natatanging titik`;
  }
}

const DESTACK_LANG_BANK_CACHE = new Map<
  Exclude<DictionaryLanguageCode, 'en'>,
  MultiLangDeStackBank
>();

export function getDeStackLanguageBank(
  code: Exclude<DictionaryLanguageCode, 'en'>
): MultiLangDeStackBank {
  const cached = DESTACK_LANG_BANK_CACHE.get(code);
  if (cached) return cached;

  const pack = getMultiLangPack(code);
  const dict5Set = new Set<string>();
  const isogramSet = new Set<string>();

  if (pack) {
    for (const raw of pack.words) {
      const clean = stripDiacritics(raw).toUpperCase().replace(/[^A-Z]/g, '');
      if (clean.length === 5 && /^[A-Z]{5}$/.test(clean)) {
        dict5Set.add(clean);
        if (new Set(clean.split('')).size === 5) {
          isogramSet.add(clean);
        }
      }
    }
    for (const prompt of pack.drawingPrompts) {
      if (!prompt.includes(' ') && !prompt.includes('-')) {
        const clean = stripDiacritics(prompt).toUpperCase().replace(/[^A-Z]/g, '');
        if (clean.length === 5 && /^[A-Z]{5}$/.test(clean)) {
          dict5Set.add(clean);
          if (new Set(clean.split('')).size === 5) {
            isogramSet.add(clean);
          }
        }
      }
    }
  }

  // Also include 5-letter words from MP Search themes for that language
  for (const theme of MULTILANG_MPSEARCH_THEMES[code] || []) {
    for (const w of theme.pool) {
      if (w.length === 5 && /^[A-Z]{5}$/.test(w)) {
        dict5Set.add(w);
        if (new Set(w.split('')).size === 5) {
          isogramSet.add(w);
        }
      }
    }
  }

  const wordBank = Array.from(isogramSet).map((word) => ({
    word,
    hint: formatDeStackHint(code, word),
  }));

  const wordMasks = new Uint32Array(wordBank.length);
  const wordFirstBits = new Uint32Array(wordBank.length);
  const wordCharBits = new Uint32Array(wordBank.length * 5);

  for (let i = 0; i < wordBank.length; i++) {
    const w = wordBank[i].word;
    let mask = 0;
    for (let k = 0; k < 5; k++) {
      const bit = 1 << (w.charCodeAt(k) - 65);
      wordCharBits[i * 5 + k] = bit;
      mask |= bit;
      if (k === 0) wordFirstBits[i] = bit;
    }
    wordMasks[i] = mask;
  }

  const dict5Words = Array.from(dict5Set);
  const dict5Masks = new Uint32Array(dict5Words.length);
  const dict5Chars = new Uint8Array(dict5Words.length * 5);
  const dict5Buckets: number[][] = Array.from({ length: 26 }, () => []);

  for (let i = 0; i < dict5Words.length; i++) {
    const w = dict5Words[i];
    let mask = 0;
    for (let k = 0; k < 5; k++) {
      const charCode = w.charCodeAt(k);
      dict5Chars[i * 5 + k] = charCode;
      mask |= 1 << (charCode - 65);
    }
    dict5Masks[i] = mask;
    dict5Buckets[w.charCodeAt(0) - 65].push(i);
  }

  const built: MultiLangDeStackBank = {
    wordBank,
    wordMasks,
    wordFirstBits,
    wordCharBits,
    dict5Words,
    dict5Masks,
    dict5Chars,
    dict5Buckets,
  };

  DESTACK_LANG_BANK_CACHE.set(code, built);
  return built;
}
