import {
  stripDiacritics,
  type DictionaryLanguageCode,
} from "../../lib/dictionary-language-core.ts";
import { getMultiLangPack, type NonEnglishLanguageCode } from "./multilang-word-packs.ts";

export interface MultiLangSearchTheme {
  title: string;
  category: string;
  pool: string[];
}

export const MULTILANG_MPSEARCH_THEMES: Record<NonEnglishLanguageCode, MultiLangSearchTheme[]> = {
  "es": [
    {
      "title": "Cosecha de Otoño",
      "category": "Estaciones y Naturaleza",
      "pool": [
        "BELLOTA",
        "ARCE",
        "SIDRA",
        "HUERTO",
        "CALABAZA",
        "COSECHA",
        "AMBAR",
        "TRIGO",
        "HOJAS",
        "BRISA",
        "BOSQUE",
        "NUEZ"
      ]
    },
    {
      "title": "Observatorio Estelar",
      "category": "Astronomía",
      "pool": [
        "COMETA",
        "NEBULOSA",
        "ORBITA",
        "ECLIPSE",
        "GALAXIA",
        "METEORO",
        "COSMOS",
        "SATURNO",
        "PLANETA",
        "ESTRELLA",
        "LUNA",
        "SOLAR"
      ]
    },
    {
      "title": "Jardín Botánico",
      "category": "Flora y Jardines",
      "pool": [
        "ORQUIDEA",
        "HELECHO",
        "JAZMIN",
        "PETALO",
        "POLEN",
        "NECTAR",
        "TREBOL",
        "SAUCE",
        "TULIPAN",
        "GIRASOL",
        "ROSA",
        "LIRIO"
      ]
    },
    {
      "title": "Cafetería Artesanal",
      "category": "Gastronomía",
      "pool": [
        "AROMA",
        "TUESTE",
        "BARISTA",
        "MOCA",
        "CREMA",
        "FILTRO",
        "CARAMELO",
        "VAPOR",
        "CACAO",
        "LECHE",
        "AZUCAR",
        "TAZA"
      ]
    },
    {
      "title": "Travesía Oceánica",
      "category": "Náutica",
      "pool": [
        "ANCLA",
        "BRUJULA",
        "PUERTO",
        "FARO",
        "TRAVESIA",
        "GALEON",
        "MARINO",
        "LAGUNA",
        "CORAL",
        "OLEAJE",
        "VELERO",
        "ISLA"
      ]
    },
    {
      "title": "Sinfonía Clásica",
      "category": "Música y Arte",
      "pool": [
        "SONATA",
        "VIOLIN",
        "CORO",
        "MAESTRO",
        "OBOE",
        "OCTAVA",
        "MELODIA",
        "PIANO",
        "ARPA",
        "FLAUTA",
        "RITMO",
        "OPERA"
      ]
    },
    {
      "title": "Expedición Alpina",
      "category": "Geografía",
      "pool": [
        "CUMBRE",
        "GLACIAR",
        "CRESTA",
        "GRANITO",
        "VALLE",
        "MESETA",
        "ASCENSO",
        "FIORDO",
        "NIEVE",
        "MONTE",
        "SENDERO",
        "ROCA"
      ]
    },
    {
      "title": "Huerta Aromática",
      "category": "Cocina",
      "pool": [
        "TOMILLO",
        "ALBAHACA",
        "OREGANO",
        "AZAFRAN",
        "HINOJO",
        "SALVIA",
        "PEREJIL",
        "MENTA",
        "CANELA",
        "CLAVO",
        "LAUREL",
        "ROMERO"
      ]
    },
    {
      "title": "Fauna del Bosque",
      "category": "Animales",
      "pool": [
        "TEJON",
        "HALCON",
        "NUTRIA",
        "GARZA",
        "CASTOR",
        "LINCE",
        "GORRION",
        "CIERVO",
        "ZORRO",
        "BUHO",
        "LOBO",
        "ARDILLA"
      ]
    },
    {
      "title": "Librería Antigua",
      "category": "Literatura",
      "pool": [
        "FOLIO",
        "SONETO",
        "ARCHIVO",
        "MEMORIA",
        "CAPITULO",
        "EDICION",
        "INDICE",
        "PROSA",
        "ESTROFA",
        "NOVELA",
        "POEMA",
        "CUENTO"
      ]
    },
    {
      "title": "Gabinete Mineral",
      "category": "Geología",
      "pool": [
        "GRANATE",
        "TOPACIO",
        "AGATA",
        "COBALTO",
        "JASPE",
        "CRISTAL",
        "OPALO",
        "MARMOL",
        "PIZARRA",
        "CUARZO",
        "ZAFIRO",
        "RUBI"
      ]
    },
    {
      "title": "Estación del Clima",
      "category": "Meteorología",
      "pool": [
        "MONZON",
        "TORMENTA",
        "BRISA",
        "CICLON",
        "TRUENO",
        "ESCARCHA",
        "NIEBLA",
        "LLUVIA",
        "VIENTO",
        "NUBE",
        "GRANIZO",
        "RAYO"
      ]
    },
    {
      "title": "Panadería de Barrio",
      "category": "Horneado",
      "pool": [
        "CORTEZA",
        "TRIGO",
        "PASTEL",
        "SESAMO",
        "HARINA",
        "MIGA",
        "LEVADURA",
        "BOLLO",
        "HORNO",
        "MASA",
        "ROSCA",
        "TARTA"
      ]
    },
    {
      "title": "Arrecife de Coral",
      "category": "Vida Marina",
      "pool": [
        "DELFIN",
        "PULPO",
        "LANGOSTA",
        "ESPONJA",
        "PLANCTON",
        "ARRECIFE",
        "MAREA",
        "TIBURON",
        "BALLENA",
        "TORTUGA",
        "MEDUSA",
        "CORAL"
      ]
    },
    {
      "title": "Mercado de Frutas",
      "category": "Mercado",
      "pool": [
        "NARANJA",
        "MANZANA",
        "PLATANO",
        "SANDIA",
        "MELON",
        "CEREZA",
        "CIRUELA",
        "DURAZNO",
        "LIMON",
        "MANGO",
        "FRESA",
        "PERA"
      ]
    },
    {
      "title": "Castillo Medieval",
      "category": "Historia",
      "pool": [
        "CASTILLO",
        "MURALLA",
        "TORREON",
        "ESCUDO",
        "ESPADA",
        "CORONA",
        "CABALLO",
        "PUENTE",
        "ANTORCHA",
        "TESORO",
        "REINO",
        "TRONO"
      ]
    },
    {
      "title": "Estadio Olímpico",
      "category": "Deportes",
      "pool": [
        "FUTBOL",
        "TENIS",
        "ATLETA",
        "MEDALLA",
        "TROFEO",
        "CARRERA",
        "NATACION",
        "BOXEO",
        "CICLISMO",
        "ESGRIMA",
        "REMOS",
        "SALTO"
      ]
    },
    {
      "title": "Cocina Hispana",
      "category": "Platos Típicos",
      "pool": [
        "PAELLA",
        "GAZPACHO",
        "TORTILLA",
        "EMPANADA",
        "CHURROS",
        "CEVICHE",
        "TAMALES",
        "TACOS",
        "AREPAS",
        "CROQUETA",
        "FABADA",
        "FLAN"
      ]
    },
    {
      "title": "Estudio de Pintor",
      "category": "Bellas Artes",
      "pool": [
        "PALETA",
        "LIENZO",
        "PINCEL",
        "BOCETO",
        "RETRATO",
        "PASTEL",
        "MOSAICO",
        "FRESCO",
        "ACUARELA",
        "COLOR",
        "SOMBRA",
        "MARCO"
      ]
    },
    {
      "title": "Hogar y Muebles",
      "category": "Casa",
      "pool": [
        "SILLA",
        "MESA",
        "SOFA",
        "LAMPARA",
        "ESPEJO",
        "VENTANA",
        "PUERTA",
        "ALFOMBRA",
        "CORTINA",
        "ARMARIO",
        "CAMA",
        "ESTANTE"
      ]
    },
    {
      "title": "Oficios y Carreras",
      "category": "Profesiones",
      "pool": [
        "MEDICO",
        "MAESTRO",
        "BOMBERO",
        "PILOTO",
        "PINTOR",
        "ABOGADO",
        "CHEF",
        "DENTISTA",
        "MUSICO",
        "NOTARIO",
        "SASTRE",
        "JUEZ"
      ]
    },
    {
      "title": "Viaje en Tren",
      "category": "Transporte",
      "pool": [
        "ESTACION",
        "ANDEN",
        "VAGON",
        "BILLETE",
        "MALETA",
        "VIAJERO",
        "TUNEL",
        "PUENTE",
        "RIELES",
        "LOCOMOTOR",
        "RUTA",
        "TREN"
      ]
    },
    {
      "title": "Sabana Africana",
      "category": "Vida Salvaje",
      "pool": [
        "LEON",
        "JIRAFA",
        "CEBRA",
        "ELEFANTE",
        "GUEPARDO",
        "HIENA",
        "ANTILOPE",
        "BUFALO",
        "AVESTRUZ",
        "LEOPARDO",
        "CHACAL",
        "MONO"
      ]
    },
    {
      "title": "Ropa y Moda",
      "category": "Vestuario",
      "pool": [
        "CAMISA",
        "PANTALON",
        "VESTIDO",
        "ABRIGO",
        "BUFANDA",
        "SOMBRERO",
        "ZAPATO",
        "CORBATA",
        "CHAQUETA",
        "FALDA",
        "GUANTE",
        "BOTA"
      ]
    },
    {
      "title": "Mundo Digital",
      "category": "Tecnología",
      "pool": [
        "TECLADO",
        "PANTALLA",
        "CORREO",
        "ARCHIVO",
        "CODIGO",
        "DATOS",
        "SERVIDOR",
        "MEMORIA",
        "SISTEMA",
        "ENLACE",
        "CONSOLA",
        "SENSOR"
      ]
    },
    {
      "title": "Fiesta y Carnaval",
      "category": "Celebración",
      "pool": [
        "MASCARA",
        "DESFILE",
        "MUSICA",
        "BAILE",
        "CONFETI",
        "DISFRAZ",
        "TAMBOR",
        "ALEGRIA",
        "REGALO",
        "PINATA",
        "BRINDIS",
        "GLOBO"
      ]
    },
    {
      "title": "Cuerpo Humano",
      "category": "Salud",
      "pool": [
        "CORAZON",
        "CEREBRO",
        "PULMON",
        "HUESO",
        "SANGRE",
        "MUSCULO",
        "MANO",
        "BRAZO",
        "PIERNA",
        "RODILLA",
        "ESPALDA",
        "DIENTE"
      ]
    },
    {
      "title": "Aula y Escuela",
      "category": "Educación",
      "pool": [
        "LAPIZ",
        "CUADERNO",
        "PIZARRA",
        "REGLA",
        "MOCHILA",
        "EXAMEN",
        "LECTURA",
        "CIENCIA",
        "HISTORIA",
        "MAPA",
        "CLASE",
        "TIZA"
      ]
    },
    {
      "title": "Verduras Frescas",
      "category": "Huerta",
      "pool": [
        "TOMATE",
        "CEBOLLA",
        "PEPINO",
        "LECHUGA",
        "ESPINACA",
        "BROCOLI",
        "PATATA",
        "APIO",
        "RABANO",
        "PUERRO",
        "NABO",
        "ACELGA"
      ]
    },
    {
      "title": "Cine y Teatro",
      "category": "Espectáculo",
      "pool": [
        "ACTOR",
        "GUION",
        "ESCENA",
        "TELON",
        "CAMARA",
        "ESTRENO",
        "DRAMA",
        "COMEDIA",
        "BUTACA",
        "APLAUSO",
        "PAPEL",
        "CARTEL"
      ]
    },
    {
      "title": "Desierto y Dunas",
      "category": "Paisajes",
      "pool": [
        "ARENA",
        "DUNA",
        "OASIS",
        "CACTUS",
        "CAMELLO",
        "ESPEJISMO",
        "PALMERA",
        "CALOR",
        "SEQUIA",
        "CANON",
        "MESETA",
        "COYOTE"
      ]
    },
    {
      "title": "Joyería Real",
      "category": "Tesoros",
      "pool": [
        "ANILLO",
        "COLLAR",
        "PULSERA",
        "PERLA",
        "DIAMANTE",
        "PLATA",
        "BRONCE",
        "BROCHE",
        "DIADEMA",
        "GEMAS",
        "JOYA"
      ]
    }
  ],
  "fr": [
    {
      "title": "Récolte d’Automne",
      "category": "Saisons et Nature",
      "pool": [
        "GLAND",
        "ERABLE",
        "CIDRE",
        "VERGER",
        "RECOLTE",
        "AMBRE",
        "FEUILLE",
        "BRUME",
        "FORET",
        "NOISETTE",
        "CHAMPS"
      ]
    },
    {
      "title": "Observatoire Céleste",
      "category": "Astronomie",
      "pool": [
        "COMETE",
        "NEBULEUSE",
        "ORBITE",
        "ECLIPSE",
        "GALAXIE",
        "METEORE",
        "COSMOS",
        "SATURNE",
        "PLANETE",
        "ETOILE",
        "LUNE",
        "SOLEIL"
      ]
    },
    {
      "title": "Jardin Botanique",
      "category": "Flore et Jardins",
      "pool": [
        "ORCHIDEE",
        "FOUGERE",
        "JASMIN",
        "PIVOINE",
        "PETALE",
        "POLLEN",
        "NECTAR",
        "TREFLE",
        "SAULE",
        "TULIPE",
        "FLEUR",
        "LILAS"
      ]
    },
    {
      "title": "Boulangerie Artisanale",
      "category": "Gastronomie",
      "pool": [
        "BRIOCHE",
        "CROUTE",
        "LEVAIN",
        "FARINE",
        "BAGUETTE",
        "CROISSANT",
        "TARTE",
        "GATEAU",
        "PAIN",
        "BEURRE",
        "MIEL",
        "SUCRE"
      ]
    },
    {
      "title": "Voyages Océaniques",
      "category": "Maritime",
      "pool": [
        "ANCRE",
        "BOUSSOLE",
        "PORT",
        "PHARE",
        "VOYAGE",
        "GALION",
        "MARIN",
        "LAGON",
        "CORAIL",
        "VOILIER",
        "NAVIRE",
        "VAGUE"
      ]
    },
    {
      "title": "Symphonie Classique",
      "category": "Musique et Arts",
      "pool": [
        "SONATE",
        "VIOLON",
        "CHOEUR",
        "MAESTRO",
        "HAUTBOIS",
        "OCTAVE",
        "MELODIE",
        "PIANO",
        "HARPE",
        "FLUTE",
        "RYTHME",
        "OPERA"
      ]
    },
    {
      "title": "Expédition Alpine",
      "category": "Géographie",
      "pool": [
        "SOMMET",
        "GLACIER",
        "CRETE",
        "GRANIT",
        "VALLEE",
        "PLATEAU",
        "CHALET",
        "FJORD",
        "NEIGE",
        "SENTIER",
        "ROCHER",
        "MONTAGNE"
      ]
    },
    {
      "title": "Jardin d’Herbes",
      "category": "Cuisine",
      "pool": [
        "THYM",
        "BASILIC",
        "ORIGAN",
        "SAFRAN",
        "FENOUIL",
        "SAUGE",
        "PERSIL",
        "MENTHE",
        "CANNELLE",
        "LAURIER",
        "ROMARIN",
        "EPICE"
      ]
    },
    {
      "title": "Faune Forestière",
      "category": "Animaux",
      "pool": [
        "BLAIREAU",
        "FAUCON",
        "LOUTRE",
        "HERON",
        "CASTOR",
        "LYNX",
        "MOINEAU",
        "CERF",
        "RENARD",
        "HIBOU",
        "LOUP",
        "ECUREUIL"
      ]
    },
    {
      "title": "Librairie Ancienne",
      "category": "Littérature",
      "pool": [
        "SONNET",
        "ARCHIVE",
        "MEMOIRE",
        "CHAPITRE",
        "EDITION",
        "PROSE",
        "ROMAN",
        "POEME",
        "CONTE",
        "LIVRE",
        "PAGE",
        "PLUME"
      ]
    },
    {
      "title": "Cabinet Minéral",
      "category": "Géologie",
      "pool": [
        "GRENAT",
        "TOPAZE",
        "AGATE",
        "COBALT",
        "JASPE",
        "CRISTAL",
        "OPALE",
        "MARBRE",
        "ARDOISE",
        "QUARTZ",
        "SAPHIR",
        "RUBIS"
      ]
    },
    {
      "title": "Station Météo",
      "category": "Météorologie",
      "pool": [
        "MOUSSON",
        "TEMPETE",
        "BRISE",
        "CYCLONE",
        "TONNERRE",
        "GIVRE",
        "BRUME",
        "PLUIE",
        "ORAGE",
        "NUAGE",
        "GRELE",
        "ECLAIR"
      ]
    },
    {
      "title": "Récif Corallien",
      "category": "Vie Marine",
      "pool": [
        "DAUPHIN",
        "PIEUVRE",
        "HOMARD",
        "EPONGE",
        "PLANCTON",
        "RECIF",
        "MAREE",
        "REQUIN",
        "BALEINE",
        "TORTUE",
        "MEDUSE",
        "CRABE"
      ]
    },
    {
      "title": "Marché Provençal",
      "category": "Marché",
      "pool": [
        "ORANGE",
        "POMME",
        "BANANE",
        "MELON",
        "CERISE",
        "PRUNE",
        "PECHE",
        "CITRON",
        "MANGUE",
        "FRAISE",
        "POIRE",
        "RAISIN"
      ]
    },
    {
      "title": "Château Médiéval",
      "category": "Histoire",
      "pool": [
        "CHATEAU",
        "DONJON",
        "BOUCLIER",
        "EPEE",
        "COURONNE",
        "CHEVAL",
        "PONT",
        "TORCHE",
        "TRESOR",
        "ROYAUME",
        "TRONE",
        "ARMURE"
      ]
    },
    {
      "title": "Atelier de Peintre",
      "category": "Beaux-Arts",
      "pool": [
        "PALETTE",
        "TOILE",
        "PINCEAU",
        "ESQUISSE",
        "PORTRAIT",
        "PASTEL",
        "MOSAIQUE",
        "ATELIER",
        "FRESQUE",
        "COULEUR",
        "OMBRE",
        "CADRE"
      ]
    },
    {
      "title": "Stade Olympique",
      "category": "Sports",
      "pool": [
        "TENNIS",
        "FOOTBALL",
        "NATATION",
        "ESCRIME",
        "CYCLISME",
        "BOXE",
        "ATHLETE",
        "MEDAILLE",
        "TROPHEE",
        "COURSE",
        "SAUT",
        "EQUIPE"
      ]
    },
    {
      "title": "Bistrot Parisien",
      "category": "Cuisine Française",
      "pool": [
        "QUICHE",
        "CREPE",
        "FROMAGE",
        "SOUPE",
        "SALADE",
        "OMELETTE",
        "POTAGE",
        "DESSERT",
        "CAFE",
        "CARAFE",
        "MENU",
        "ASSIETTE"
      ]
    },
    {
      "title": "Maison et Mobilier",
      "category": "Intérieur",
      "pool": [
        "CHAISE",
        "TABLE",
        "CANAPE",
        "LAMPE",
        "MIROIR",
        "FENETRE",
        "PORTE",
        "TAPIS",
        "RIDEAU",
        "ARMOIRE",
        "COUSSIN",
        "ETAGERE"
      ]
    },
    {
      "title": "Métiers du Monde",
      "category": "Professions",
      "pool": [
        "MEDECIN",
        "POMPIER",
        "PILOTE",
        "PEINTRE",
        "AVOCAT",
        "NOTAIRE",
        "DENTISTE",
        "ARTISAN",
        "BAKER",
        "MAIRE",
        "JUGE",
        "BOUCHER"
      ]
    },
    {
      "title": "Mode et Couture",
      "category": "Vêtements",
      "pool": [
        "CHEMISE",
        "PANTALON",
        "MANTEAU",
        "ECHARPE",
        "CHAPEAU",
        "ROBE",
        "JUPE",
        "VESTE",
        "CRAVATE",
        "GANT",
        "BOTTE",
        "CEINTURE"
      ]
    },
    {
      "title": "Savane Africaine",
      "category": "Faune Sauvage",
      "pool": [
        "LION",
        "GIRAFE",
        "ZEBRE",
        "ELEPHANT",
        "GUEPARD",
        "HYENE",
        "ANTILOPE",
        "BUFFLE",
        "AUTRUCHE",
        "LEOPARD",
        "CHACAL",
        "SINGE"
      ]
    },
    {
      "title": "Voyage en Train",
      "category": "Transports",
      "pool": [
        "GARE",
        "QUAI",
        "WAGON",
        "BILLET",
        "VALISE",
        "VOYAGEUR",
        "TUNNEL",
        "PONT",
        "RAILS",
        "TRAJET",
        "TRAIN",
        "HORAIRE"
      ]
    },
    {
      "title": "École et Savoir",
      "category": "Éducation",
      "pool": [
        "CRAYON",
        "CAHIER",
        "TABLEAU",
        "REGLE",
        "CARTABLE",
        "EXAMEN",
        "LECTURE",
        "SCIENCE",
        "HISTOIRE",
        "CARTE",
        "CLASSE",
        "CRAIE"
      ]
    },
    {
      "title": "Potager de Saison",
      "category": "Légumes",
      "pool": [
        "TOMATE",
        "OIGNON",
        "CAROTTE",
        "POIREAU",
        "LAITUE",
        "EPINARD",
        "BROCOLI",
        "RADIS",
        "NAVET",
        "CELERI",
        "HARICOT",
        "COURGE"
      ]
    },
    {
      "title": "Théâtre et Cinéma",
      "category": "Spectacle",
      "pool": [
        "ACTEUR",
        "SCENARIO",
        "SCENE",
        "RIDEAU",
        "CAMERA",
        "DRAME",
        "COMEDIE",
        "FAUTEUIL",
        "ROLE",
        "AFFICHE",
        "DECORS",
        "STUDIO"
      ]
    },
    {
      "title": "Corps Humain",
      "category": "Santé",
      "pool": [
        "COEUR",
        "CERVEAU",
        "POUMON",
        "SANG",
        "MUSCLE",
        "MAIN",
        "BRAS",
        "JAMBE",
        "GENOU",
        "EPAULE",
        "DENT",
        "OREILLE"
      ]
    },
    {
      "title": "Monde Numérique",
      "category": "Technologie",
      "pool": [
        "CLAVIER",
        "ECRAN",
        "FICHIER",
        "CODE",
        "SERVEUR",
        "MEMOIRE",
        "RESEAU",
        "LOGICIEL",
        "LIEN",
        "CAPTEUR",
        "DONNEE",
        "CONSOLE"
      ]
    },
    {
      "title": "Bijoux et Gemmes",
      "category": "Joaillerie",
      "pool": [
        "BAGUE",
        "COLLIER",
        "BRACELET",
        "PERLE",
        "DIAMANT",
        "ARGENT",
        "BRONZE",
        "BROCHE",
        "DIADEME",
        "BIJOU",
        "EMERAUDE",
        "AMETHYSTE"
      ]
    },
    {
      "title": "Fête et Carnaval",
      "category": "Célébration",
      "pool": [
        "MASQUE",
        "DEFILE",
        "MUSIQUE",
        "DANSE",
        "CONFETTI",
        "COSTUME",
        "TAMBOUR",
        "JOIE",
        "CADEAU",
        "BALLON",
        "BOUGIE",
        "FANFARE"
      ]
    },
    {
      "title": "Vignoble et Terroir",
      "category": "Viticulture",
      "pool": [
        "RAISIN",
        "TONNEAU",
        "CAVE",
        "VENDANGE",
        "TERROIR",
        "CEPAGE",
        "BOUCHON",
        "VERRE",
        "AROME",
        "MILLESIME",
        "DOMAINE",
        "VIGNE"
      ]
    },
    {
      "title": "Désert et Dunes",
      "category": "Paysages",
      "pool": [
        "SABLE",
        "DUNE",
        "OASIS",
        "CACTUS",
        "CHAMEAU",
        "MIRAGE",
        "PALMIER",
        "CHALEUR",
        "CARAVANE",
        "CANYON",
        "PLATEAU",
        "NOMADE"
      ]
    }
  ],
  "de": [
    {
      "title": "Herbsternte",
      "category": "Jahreszeiten & Natur",
      "pool": [
        "EICHEL",
        "AHORN",
        "APFEL",
        "GARTEN",
        "KURBIS",
        "ERNTE",
        "BERNSTEIN",
        "WEIZEN",
        "LAUB",
        "BRISE",
        "WALD",
        "HERBST"
      ]
    },
    {
      "title": "Sternwarte",
      "category": "Astronomie",
      "pool": [
        "KOMET",
        "NEBEL",
        "ORBIT",
        "GALAXIE",
        "METEOR",
        "KOSMOS",
        "SATURN",
        "PLANET",
        "STERN",
        "MOND",
        "SONNE",
        "RAKETE"
      ]
    },
    {
      "title": "Botanischer Garten",
      "category": "Flora & Pflanzen",
      "pool": [
        "ORCHIDEE",
        "FARN",
        "JASMIN",
        "BLUTE",
        "POLLEN",
        "NEKTAR",
        "KLEE",
        "WEIDE",
        "TULPE",
        "BLUME",
        "ROSE",
        "LILIE"
      ]
    },
    {
      "title": "Bäckerei & Café",
      "category": "Genuss",
      "pool": [
        "BREZEL",
        "KRUSTE",
        "WEIZEN",
        "KUCHEN",
        "SESAM",
        "MEHL",
        "HEFE",
        "BROT",
        "TORTE",
        "KAFFEE",
        "HONIG",
        "ZUCKER"
      ]
    },
    {
      "title": "Seefahrt & Ozean",
      "category": "Maritim",
      "pool": [
        "ANKER",
        "KOMPASS",
        "HAFEN",
        "LEUCHTE",
        "REISE",
        "SEGLER",
        "LAGUNE",
        "KORALLE",
        "SCHIFF",
        "WELLE",
        "INSEL",
        "STRAND"
      ]
    },
    {
      "title": "Klassische Sinfonie",
      "category": "Musik & Kunst",
      "pool": [
        "SONATE",
        "GEIGE",
        "CHOR",
        "MAESTRO",
        "OBOE",
        "OKTAVE",
        "MELODIE",
        "KLAVIER",
        "HARFE",
        "FLOTE",
        "TAKTE",
        "OPER"
      ]
    },
    {
      "title": "Alpen-Expedition",
      "category": "Geografie",
      "pool": [
        "GIPFEL",
        "GLETSCHER",
        "GRAT",
        "GRANIT",
        "PLATEAU",
        "HUTTE",
        "FJORD",
        "SCHNEE",
        "BERG",
        "PFAD",
        "FELSEN"
      ]
    },
    {
      "title": "Kräutergarten",
      "category": "Küche",
      "pool": [
        "THYMIAN",
        "BASILIK",
        "OREGANO",
        "SAFRAN",
        "FENCHEL",
        "SALBEI",
        "MINZE",
        "ZIMT",
        "NELKE",
        "LORBEER",
        "KRAUT",
        "PFEFFER"
      ]
    },
    {
      "title": "Waldtiere",
      "category": "Tierwelt",
      "pool": [
        "DACHS",
        "FALKE",
        "OTTER",
        "REIHER",
        "BIBER",
        "LUCHS",
        "SPATZ",
        "HIRSCH",
        "FUCHS",
        "EULE",
        "WOLF",
        "HASE"
      ]
    },
    {
      "title": "Alte Buchhandlung",
      "category": "Literatur",
      "pool": [
        "SONETT",
        "ARCHIV",
        "KAPITEL",
        "AUSGABE",
        "PROSA",
        "ROMAN",
        "GEDICHT",
        "BUCH",
        "SEITE",
        "FEDER",
        "TINTE",
        "LESEN"
      ]
    },
    {
      "title": "Mineralienkabinett",
      "category": "Geologie",
      "pool": [
        "GRANAT",
        "TOPAS",
        "ACHAT",
        "KOBALT",
        "JASPIS",
        "KRISTALL",
        "OPAL",
        "MARMOR",
        "SCHIEFER",
        "QUARZ",
        "SAPHIR",
        "RUBIN"
      ]
    },
    {
      "title": "Wetterstation",
      "category": "Wetter",
      "pool": [
        "MONSUN",
        "STURM",
        "BRISE",
        "ZYKLON",
        "DONNER",
        "FROST",
        "NEBEL",
        "REGEN",
        "WIND",
        "WOLKE",
        "HAGEL",
        "BLITZ"
      ]
    },
    {
      "title": "Korallenriff",
      "category": "Meeresleben",
      "pool": [
        "DELFIN",
        "KRAKE",
        "HUMMER",
        "SCHWAMM",
        "PLANKTON",
        "RIFF",
        "FLUT",
        "QUALLE",
        "KRABBE",
        "FISCH",
        "ROBBE",
        "MUSCHEL"
      ]
    },
    {
      "title": "Obstmarkt",
      "category": "Markt",
      "pool": [
        "ORANGE",
        "APFEL",
        "BANANE",
        "MELONE",
        "KIRSCHE",
        "PFLAUME",
        "BIRNE",
        "ZITRONE",
        "MANGO",
        "BEERE",
        "TRAUBE",
        "PFIRSICH"
      ]
    },
    {
      "title": "Mittelalterburg",
      "category": "Geschichte",
      "pool": [
        "BURG",
        "MAUER",
        "TURM",
        "SCHILD",
        "SCHWERT",
        "KRONE",
        "PFERD",
        "BRUCKE",
        "FACKEL",
        "SCHATZ",
        "REICH",
        "THRON"
      ]
    },
    {
      "title": "Maleratelier",
      "category": "Kunst",
      "pool": [
        "PALETTE",
        "LEINWAND",
        "PINSEL",
        "SKIZZE",
        "PORTRAIT",
        "PASTELL",
        "MOSAIK",
        "ATELIER",
        "FRESKO",
        "FARBE",
        "RAHMEN",
        "BILD"
      ]
    },
    {
      "title": "Olympiastadion",
      "category": "Sport",
      "pool": [
        "FUSSBALL",
        "TENNIS",
        "ATHLET",
        "MEDAILLE",
        "POKAL",
        "RENNEN",
        "BOXEN",
        "FECHTEN",
        "RUDERN",
        "SPRUNG",
        "LAUF",
        "TEAM"
      ]
    },
    {
      "title": "Wohnen & Möbel",
      "category": "Zuhause",
      "pool": [
        "STUHL",
        "TISCH",
        "SOFA",
        "LAMPE",
        "SPIEGEL",
        "FENSTER",
        "TEPPICH",
        "VORHANG",
        "SCHRANK",
        "KISSEN",
        "REGAL",
        "BETT"
      ]
    },
    {
      "title": "Berufe & Handwerk",
      "category": "Berufe",
      "pool": [
        "ARZT",
        "LEHRER",
        "PILOT",
        "MALER",
        "ANWALT",
        "BACKER",
        "KOCH",
        "RICHTER",
        "SCHMIED",
        "GARTNER",
        "MUSIKER",
        "BARBIER"
      ]
    },
    {
      "title": "Mode & Kleidung",
      "category": "Kleidung",
      "pool": [
        "HEMD",
        "HOSE",
        "MANTEL",
        "SCHAL",
        "KLEID",
        "ROCK",
        "JACKE",
        "KRAWATTE",
        "STIEFEL",
        "GURTEL",
        "MUTZE",
        "SCHUH"
      ]
    },
    {
      "title": "Afrikanische Savanne",
      "category": "Wildtiere",
      "pool": [
        "LOWE",
        "GIRAFFE",
        "ZEBRA",
        "ELEFANT",
        "GEPARD",
        "HYANE",
        "ANTILOPE",
        "BUFFEL",
        "STRAUSS",
        "LEOPARD",
        "SCHAKAL",
        "AFFE"
      ]
    },
    {
      "title": "Bahnreise",
      "category": "Verkehr",
      "pool": [
        "BAHNHOF",
        "WAGGON",
        "TICKET",
        "KOFFER",
        "TUNNEL",
        "BRUCKE",
        "SCHIENE",
        "STRECKE",
        "FAHRT",
        "GLEIS",
        "ABTEIL",
        "REISE"
      ]
    },
    {
      "title": "Schule & Lernen",
      "category": "Bildung",
      "pool": [
        "STIFT",
        "HEFT",
        "TAFEL",
        "LINEAL",
        "RANZEN",
        "PRUFUNG",
        "LEKTURE",
        "CHEMIE",
        "KARTE",
        "KLASSE",
        "KREIDE",
        "ATLAS"
      ]
    },
    {
      "title": "Gemüsegarten",
      "category": "Gemüse",
      "pool": [
        "TOMATE",
        "ZWIEBEL",
        "GURKE",
        "SALAT",
        "SPINAT",
        "KAROTTE",
        "SELLERIE",
        "RETTICH",
        "LAUCH",
        "BOHNE",
        "ERBSE",
        "KOHL"
      ]
    },
    {
      "title": "Theater & Film",
      "category": "Kultur",
      "pool": [
        "BUHNE",
        "VORHANG",
        "KAMERA",
        "DRAMA",
        "KOMODIE",
        "SESSEL",
        "APPLAUS",
        "ROLLE",
        "PLAKAT",
        "KULISSE",
        "STUDIO",
        "FILM"
      ]
    },
    {
      "title": "Menschlicher Körper",
      "category": "Gesundheit",
      "pool": [
        "HERZ",
        "GEHIRN",
        "LUNGE",
        "KNOCHEN",
        "BLUT",
        "MUSKEL",
        "HAND",
        "BEIN",
        "KNIE",
        "SCHULTER",
        "ZAHN",
        "RUCKEN"
      ]
    },
    {
      "title": "Digitale Welt",
      "category": "Technik",
      "pool": [
        "TASTATUR",
        "DATEI",
        "CODE",
        "SERVER",
        "SPEICHER",
        "NETZWERK",
        "SYSTEM",
        "SENSOR",
        "KONSOLE",
        "DATEN",
        "KABEL",
        "MODEM"
      ]
    },
    {
      "title": "Schmuck & Juwelen",
      "category": "Kostbarkeiten",
      "pool": [
        "RING",
        "KETTE",
        "ARMBAND",
        "PERLE",
        "DIAMANT",
        "GOLD",
        "SILBER",
        "BRONZE",
        "BROSCHE",
        "DIADEM",
        "JUWEL",
        "SMARAGD"
      ]
    },
    {
      "title": "Fest & Karneval",
      "category": "Feier",
      "pool": [
        "MASKE",
        "UMZUG",
        "MUSIK",
        "TANZ",
        "KONFETTI",
        "KOSTUM",
        "TROMMEL",
        "FREUDE",
        "GESCHENK",
        "BALLON",
        "KERZE",
        "FEST"
      ]
    },
    {
      "title": "Deutsche Küche",
      "category": "Kulinarik",
      "pool": [
        "BRATEN",
        "SUPPE",
        "KNODEL",
        "WURST",
        "SPATZLE",
        "STRUDEL",
        "SALAT",
        "SENF",
        "SAUCE",
        "SCHINKEN",
        "KASE",
        "QUARK"
      ]
    },
    {
      "title": "Wüste & Dünen",
      "category": "Landschaften",
      "pool": [
        "SAND",
        "DUNE",
        "OASE",
        "KAKTUS",
        "KAMEL",
        "PALME",
        "HITZE",
        "KARAWANE",
        "SCHLUCHT",
        "NOMADE",
        "SONNE",
        "STAUB"
      ]
    },
    {
      "title": "Werkstatt & Werkzeug",
      "category": "Handwerk",
      "pool": [
        "HAMMER",
        "ZANGE",
        "SAGE",
        "NAGEL",
        "SCHRAUBE",
        "BOHRER",
        "FEILE",
        "HOBEL",
        "MEISSEL",
        "SEIL",
        "KETTE",
        "SCHLOSS"
      ]
    }
  ],
  "it": [
    {
      "title": "Raccolto d’Autunno",
      "category": "Stagioni e Natura",
      "pool": [
        "GHIANDA",
        "ACERO",
        "SIDRO",
        "FRUTTETO",
        "ZUCCA",
        "RACCOLTO",
        "AMBRA",
        "GRANO",
        "FOGLIA",
        "BREZZA",
        "BOSCO",
        "NOCE"
      ]
    },
    {
      "title": "Osservatorio Celeste",
      "category": "Astronomia",
      "pool": [
        "COMETA",
        "NEBULOSA",
        "ORBITA",
        "ECLISSI",
        "GALASSIA",
        "METEORA",
        "COSMO",
        "SATURNO",
        "PIANETA",
        "STELLA",
        "LUNA",
        "SOLE"
      ]
    },
    {
      "title": "Giardino Botanico",
      "category": "Flora e Giardini",
      "pool": [
        "ORCHIDEA",
        "FELCE",
        "PETALO",
        "POLLINE",
        "NETTARE",
        "TRIFOGLIO",
        "SALICE",
        "TULIPANO",
        "GIRASOLE",
        "FIORE",
        "ROSA",
        "GIGLIO"
      ]
    },
    {
      "title": "Torrefazione Artigiana",
      "category": "Gastronomia",
      "pool": [
        "AROMA",
        "TOSTATO",
        "BARISTA",
        "MOKA",
        "CREMA",
        "FILTRO",
        "CARAMELLO",
        "VAPORE",
        "CACAO",
        "LATTE",
        "CAFFE",
        "TAZZA"
      ]
    },
    {
      "title": "Viaggi Oceanici",
      "category": "Mare",
      "pool": [
        "ANCORA",
        "BUSSOLA",
        "PORTO",
        "FARO",
        "VIAGGIO",
        "GALEONE",
        "MARINAIO",
        "LAGUNA",
        "CORALLO",
        "VELIERO",
        "NAVE",
        "ISOLA"
      ]
    },
    {
      "title": "Sinfonia Classica",
      "category": "Musica e Arte",
      "pool": [
        "SONATA",
        "VIOLINO",
        "CORO",
        "MAESTRO",
        "OBOE",
        "OTTAVA",
        "MELODIA",
        "PIANO",
        "ARPA",
        "FLAUTO",
        "RITMO",
        "OPERA"
      ]
    },
    {
      "title": "Spedizione Alpina",
      "category": "Geografia",
      "pool": [
        "VETTA",
        "GHIACCIO",
        "CRESTA",
        "GRANITO",
        "VALLE",
        "ALTIPIANO",
        "BAITA",
        "FIORDO",
        "NEVE",
        "MONTE",
        "SENTIERO",
        "ROCCIA"
      ]
    },
    {
      "title": "Orto Aromatico",
      "category": "Cucina",
      "pool": [
        "TIMO",
        "BASILICO",
        "ORIGANO",
        "ZAFFERANO",
        "FINOCCHIO",
        "SALVIA",
        "MENTA",
        "CANNELLA",
        "ALLORO",
        "ROSMARINO",
        "SPEZIA",
        "PEPE"
      ]
    },
    {
      "title": "Fauna del Bosco",
      "category": "Animali",
      "pool": [
        "TASSO",
        "FALCO",
        "LONTRA",
        "AIRONE",
        "CASTORO",
        "LINCE",
        "PASSERO",
        "CERVO",
        "VOLPE",
        "GUFO",
        "LUPO",
        "LEPRE"
      ]
    },
    {
      "title": "Libreria Antica",
      "category": "Letteratura",
      "pool": [
        "SONETTO",
        "ARCHIVIO",
        "MEMORIA",
        "CAPITOLO",
        "EDIZIONE",
        "INDICE",
        "PROSA",
        "ROMANZO",
        "POEMA",
        "LIBRO",
        "PAGINA",
        "PIUMA"
      ]
    },
    {
      "title": "Gabinetto Minerale",
      "category": "Geologia",
      "pool": [
        "GRANATO",
        "TOPAZIO",
        "AGATA",
        "COBALTO",
        "DIASPRO",
        "CRISTALLO",
        "OPALE",
        "MARMO",
        "ARDESIA",
        "QUARZO",
        "ZAFFIRO",
        "RUBINO"
      ]
    },
    {
      "title": "Stazione Meteo",
      "category": "Meteorologia",
      "pool": [
        "MONSONE",
        "TEMPESTA",
        "BREZZA",
        "CICLONE",
        "TUONO",
        "BRINA",
        "NEBBIA",
        "PIOGGIA",
        "VENTO",
        "NUVOLA",
        "GRANDINE",
        "LAMPO"
      ]
    },
    {
      "title": "Barriera Corallina",
      "category": "Vita Marina",
      "pool": [
        "DELFINO",
        "POLPO",
        "ARAGOSTA",
        "SPUGNA",
        "PLANCTON",
        "MAREA",
        "SQUALO",
        "BALENA",
        "TARTARUGA",
        "MEDUSA",
        "GRANCHIO",
        "PESCE"
      ]
    },
    {
      "title": "Mercato della Frutta",
      "category": "Mercato",
      "pool": [
        "ARANCIA",
        "MELA",
        "BANANA",
        "ANGURIA",
        "MELONE",
        "CILIEGIA",
        "PRUGNA",
        "PESCA",
        "LIMONE",
        "MANGO",
        "FRAGOLA",
        "PERA"
      ]
    },
    {
      "title": "Castello Medievale",
      "category": "Storia",
      "pool": [
        "CASTELLO",
        "TORRE",
        "SCUDO",
        "SPADA",
        "CORONA",
        "CAVALLO",
        "PONTE",
        "TORCIA",
        "TESORO",
        "REGNO",
        "TRONO",
        "ARMATURA"
      ]
    },
    {
      "title": "Bottega del Pittore",
      "category": "Belle Arti",
      "pool": [
        "TAVOLOZZA",
        "TELA",
        "PENNELLO",
        "SCHIZZO",
        "RITRATTO",
        "PASTELLO",
        "MOSAICO",
        "STUDIO",
        "AFFRESCO",
        "COLORE",
        "CORNICE",
        "QUADRO"
      ]
    },
    {
      "title": "Stadio Olimpico",
      "category": "Sport",
      "pool": [
        "CALCIO",
        "TENNIS",
        "ATLETA",
        "MEDAGLIA",
        "TROFEO",
        "CORSA",
        "NUOTO",
        "SCHERMA",
        "CICLISMO",
        "PUGILATO",
        "SALTO",
        "SQUADRA"
      ]
    },
    {
      "title": "Trattoria Italiana",
      "category": "Cucina Italiana",
      "pool": [
        "PIZZA",
        "PASTA",
        "RISOTTO",
        "LASAGNA",
        "GNOCCHI",
        "RAVIOLI",
        "FOCACCIA",
        "GELATO",
        "TIRAMISU",
        "PESTO",
        "SUGO",
        "POLENTA"
      ]
    },
    {
      "title": "Casa e Arredo",
      "category": "Interni",
      "pool": [
        "SEDIA",
        "TAVOLO",
        "DIVANO",
        "LAMPADA",
        "SPECCHIO",
        "FINESTRA",
        "PORTA",
        "TAPPETO",
        "TENDA",
        "ARMADIO",
        "CUSCINO",
        "LETTO"
      ]
    },
    {
      "title": "Mestieri e Professioni",
      "category": "Lavoro",
      "pool": [
        "MEDICO",
        "MAESTRO",
        "POMPIERE",
        "PILOTA",
        "PITTORE",
        "AVVOCATO",
        "CUOCO",
        "DENTISTA",
        "NOTAIO",
        "SARTO",
        "GIUDICE",
        "FORNAIO"
      ]
    },
    {
      "title": "Moda Milanese",
      "category": "Abbigliamento",
      "pool": [
        "CAMICIA",
        "PANTALONE",
        "CAPPOTTO",
        "SCIARPA",
        "CAPPELLO",
        "ABITO",
        "GONNA",
        "GIACCA",
        "CRAVATTA",
        "STIVALE",
        "CINTURA",
        "GUANTO"
      ]
    },
    {
      "title": "Savana Africana",
      "category": "Fauna Selvatica",
      "pool": [
        "LEONE",
        "GIRAFFA",
        "ZEBRA",
        "ELEFANTE",
        "GHEPARDO",
        "IENA",
        "ANTILOPE",
        "BUFALO",
        "STRUZZO",
        "LEOPARDO",
        "SCIACALLO",
        "SCIMMIA"
      ]
    },
    {
      "title": "Viaggio in Treno",
      "category": "Trasporti",
      "pool": [
        "STAZIONE",
        "BINARIO",
        "VAGONE",
        "BIGLIETTO",
        "VALIGIA",
        "GALLERIA",
        "PONTE",
        "ROTAIA",
        "TRAGITTO",
        "TRENO",
        "ORARIO",
        "PARTENZA"
      ]
    },
    {
      "title": "Scuola e Sapere",
      "category": "Istruzione",
      "pool": [
        "MATITA",
        "QUADERNO",
        "LAVAGNA",
        "RIGHELLO",
        "ZAINO",
        "ESAME",
        "LETTURA",
        "SCIENZA",
        "STORIA",
        "MAPPA",
        "CLASSE",
        "GESSO"
      ]
    },
    {
      "title": "Orto di Stagione",
      "category": "Verdure",
      "pool": [
        "POMODORO",
        "CIPOLLA",
        "CAROTA",
        "PORRO",
        "LATTUGA",
        "SPINACI",
        "BROCCOLI",
        "RAPANO",
        "SEDANO",
        "FAGIOLO",
        "ZUCCHINA",
        "CAVOLO"
      ]
    },
    {
      "title": "Cinema e Teatro",
      "category": "Spettacolo",
      "pool": [
        "ATTORE",
        "COPIONE",
        "SCENA",
        "SIPARIO",
        "REGISTA",
        "DRAMMA",
        "COMMEDIA",
        "POLTRONA",
        "APPLAUSO",
        "RUOLO",
        "LOCANDINA",
        "PALCO"
      ]
    },
    {
      "title": "Corpo Umano",
      "category": "Salute",
      "pool": [
        "CUORE",
        "CERVELLO",
        "POLMONE",
        "OSSO",
        "SANGUE",
        "MUSCOLO",
        "MANO",
        "BRACCIO",
        "GAMBA",
        "GINOCCHIO",
        "SPALLA",
        "DENTE"
      ]
    },
    {
      "title": "Mondo Digitale",
      "category": "Tecnologia",
      "pool": [
        "TASTIERA",
        "SCHERMO",
        "CODICE",
        "SERVER",
        "MEMORIA",
        "SISTEMA",
        "RETE",
        "SENSORE",
        "CONSOLE",
        "DATI",
        "CAVO",
        "MODEM"
      ]
    },
    {
      "title": "Gioielli e Gemme",
      "category": "Oreficeria",
      "pool": [
        "ANELLO",
        "COLLANA",
        "BRACCIALE",
        "PERLA",
        "DIAMANTE",
        "ARGENTO",
        "BRONZO",
        "SPILLA",
        "DIADEMA",
        "GIOIELLO",
        "SMERALDO",
        "AMETISTA"
      ]
    },
    {
      "title": "Carnevale di Venezia",
      "category": "Festa",
      "pool": [
        "MASCHERA",
        "SFILATA",
        "MUSICA",
        "BALLO",
        "CORIANDOL",
        "COSTUME",
        "TAMBURO",
        "GIOIA",
        "REGALO",
        "GONDOLA",
        "CANALE",
        "FESTA"
      ]
    },
    {
      "title": "Deserto e Dune",
      "category": "Paesaggi",
      "pool": [
        "SABBIA",
        "DUNA",
        "OASI",
        "CACTUS",
        "CAMMELLO",
        "MIRAGGIO",
        "PALMA",
        "CALORE",
        "CAROVANA",
        "GOLA",
        "NOMADE",
        "POLVERE"
      ]
    },
    {
      "title": "Officina e Attrezzi",
      "category": "Artigianato",
      "pool": [
        "MARTELLO",
        "PINZA",
        "SEGA",
        "CHIODO",
        "VITE",
        "TRAPANO",
        "LIMA",
        "PIALLA",
        "SCALPELLO",
        "CORDA",
        "CATENA",
        "CHIAVE"
      ]
    }
  ],
  "pt": [
    {
      "title": "Colheita de Outono",
      "category": "Estações e Natureza",
      "pool": [
        "BOLOTA",
        "BORDO",
        "SIDRA",
        "POMAR",
        "ABOBORA",
        "COLHEITA",
        "AMBAR",
        "TRIGO",
        "FOLHA",
        "BRISA",
        "BOSQUE",
        "NOZES"
      ]
    },
    {
      "title": "Observatório Estelar",
      "category": "Astronomia",
      "pool": [
        "COMETA",
        "NEBULOSA",
        "ORBITA",
        "ECLIPSE",
        "GALAXIA",
        "METEORO",
        "COSMOS",
        "SATURNO",
        "PLANETA",
        "ESTRELA",
        "SOLAR"
      ]
    },
    {
      "title": "Jardim Botânico",
      "category": "Flora e Jardins",
      "pool": [
        "ORQUIDEA",
        "SAMAMBAIA",
        "JASMIM",
        "PETALA",
        "POLEN",
        "NECTAR",
        "TREVO",
        "SALGUEIRO",
        "TULIPA",
        "GIRASSOL",
        "FLOR",
        "LIRIO"
      ]
    },
    {
      "title": "Cafeteria Artesanal",
      "category": "Gastronomia",
      "pool": [
        "AROMA",
        "TORRA",
        "BARISTA",
        "MOCA",
        "CREME",
        "FILTRO",
        "CARAMELO",
        "VAPOR",
        "CACAU",
        "LEITE",
        "ACUCAR",
        "XICARA"
      ]
    },
    {
      "title": "Viagens Oceânicas",
      "category": "Náutica",
      "pool": [
        "ANCORA",
        "BUSSOLA",
        "PORTO",
        "FAROL",
        "VIAGEM",
        "GALEAO",
        "MARUJO",
        "LAGOA",
        "CORAL",
        "VELEIRO",
        "NAVIO",
        "ILHA"
      ]
    },
    {
      "title": "Sinfonia Clássica",
      "category": "Música e Arte",
      "pool": [
        "SONATA",
        "VIOLINO",
        "CORAL",
        "MAESTRO",
        "OBOE",
        "OITAVA",
        "MELODIA",
        "PIANO",
        "HARPA",
        "FLAUTA",
        "RITMO",
        "OPERA"
      ]
    },
    {
      "title": "Expedição Alpina",
      "category": "Geografia",
      "pool": [
        "CUME",
        "GELEIRA",
        "CRISTA",
        "GRANITO",
        "VALE",
        "PLANALTO",
        "CHALE",
        "FIORDE",
        "NEVE",
        "MONTE",
        "TRILHA",
        "ROCHA"
      ]
    },
    {
      "title": "Horta Aromática",
      "category": "Culinária",
      "pool": [
        "TOMILHO",
        "OREGANO",
        "ACAFRAO",
        "FUNCHO",
        "SALVIA",
        "SALSA",
        "HORTELA",
        "CANELA",
        "CRAVO",
        "LOURO",
        "ALECRIM",
        "ERVAS"
      ]
    },
    {
      "title": "Fauna da Floresta",
      "category": "Animais",
      "pool": [
        "TEXUGO",
        "FALCAO",
        "LONTRA",
        "GARCA",
        "CASTOR",
        "LINCE",
        "PARDAL",
        "CERVO",
        "RAPOSA",
        "CORUJA",
        "LOBO",
        "ESQUILO"
      ]
    },
    {
      "title": "Livraria Antiga",
      "category": "Literatura",
      "pool": [
        "SONETO",
        "ARQUIVO",
        "MEMORIA",
        "CAPITULO",
        "EDICAO",
        "INDICE",
        "PROSA",
        "ROMANCE",
        "POEMA",
        "CONTO",
        "LIVRO",
        "PAGINA"
      ]
    },
    {
      "title": "Gabinete Mineral",
      "category": "Geologia",
      "pool": [
        "GRANADA",
        "TOPAZIO",
        "AGATA",
        "COBALTO",
        "JASPE",
        "CRISTAL",
        "OPALA",
        "MARMORE",
        "ARDOSIA",
        "QUARTZO",
        "SAFIRA",
        "RUBI"
      ]
    },
    {
      "title": "Estação do Clima",
      "category": "Meteorologia",
      "pool": [
        "MONCAO",
        "TORMENTA",
        "BRISA",
        "CICLONE",
        "TROVAO",
        "GEADA",
        "NEBLINA",
        "CHUVA",
        "VENTO",
        "NUVEM",
        "GRANIZO",
        "RAIO"
      ]
    },
    {
      "title": "Recife de Coral",
      "category": "Vida Marinha",
      "pool": [
        "GOLFINHO",
        "POLVO",
        "LAGOSTA",
        "ESPONJA",
        "PLANCTON",
        "RECIFE",
        "MARE",
        "TUBARAO",
        "BALEIA",
        "TARTARUGA",
        "MEDUSA",
        "PEIXE"
      ]
    },
    {
      "title": "Feira de Frutas",
      "category": "Mercado",
      "pool": [
        "LARANJA",
        "BANANA",
        "MELANCIA",
        "MELAO",
        "CEREJA",
        "AMEIXA",
        "PESSEGO",
        "LIMAO",
        "MANGA",
        "MORANGO",
        "PERA",
        "ABACAXI"
      ]
    },
    {
      "title": "Castelo Medieval",
      "category": "História",
      "pool": [
        "CASTELO",
        "MURALHA",
        "TORRE",
        "ESCUDO",
        "ESPADA",
        "COROA",
        "CAVALO",
        "PONTE",
        "TOCHA",
        "TESOURO",
        "REINO",
        "TRONO"
      ]
    },
    {
      "title": "Ateliê de Pintura",
      "category": "Belas Artes",
      "pool": [
        "PALETA",
        "TELA",
        "PINCEL",
        "ESBOCO",
        "RETRATO",
        "PASTEL",
        "MOSAICO",
        "ATELIE",
        "AFRESCO",
        "CORES",
        "MOLDURA",
        "QUADRO"
      ]
    },
    {
      "title": "Estádio Olímpico",
      "category": "Esportes",
      "pool": [
        "FUTEBOL",
        "TENIS",
        "ATLETA",
        "MEDALHA",
        "TROFEU",
        "CORRIDA",
        "NATACAO",
        "BOXE",
        "CICLISMO",
        "ESGRIMA",
        "REMO",
        "SALTO"
      ]
    },
    {
      "title": "Cozinha Lusófona",
      "category": "Pratos Típicos",
      "pool": [
        "FEIJOADA",
        "BACALHAU",
        "MOQUECA",
        "COXINHA",
        "PASTEL",
        "PUDIM",
        "TAPIOCA",
        "ACARAJE",
        "FAROFA",
        "CALDO",
        "EMPADA",
        "BOLO"
      ]
    },
    {
      "title": "Casa e Móveis",
      "category": "Lar",
      "pool": [
        "CADEIRA",
        "MESA",
        "SOFA",
        "LAMPADA",
        "ESPELHO",
        "JANELA",
        "PORTA",
        "TAPETE",
        "CORTINA",
        "ARMARIO",
        "CAMA",
        "ESTANTE"
      ]
    },
    {
      "title": "Profissões e Ofícios",
      "category": "Carreiras",
      "pool": [
        "MEDICO",
        "MESTRE",
        "BOMBEIRO",
        "PILOTO",
        "PINTOR",
        "ADVOGADO",
        "DENTISTA",
        "MUSICO",
        "PADEIRO",
        "ALFAIATE",
        "JUIZ",
        "CHEF"
      ]
    },
    {
      "title": "Moda e Vestuário",
      "category": "Roupas",
      "pool": [
        "CAMISA",
        "CALCA",
        "VESTIDO",
        "CASACO",
        "CACHECOL",
        "CHAPEU",
        "SAPATO",
        "GRAVATA",
        "JAQUETA",
        "SAIA",
        "LUVA",
        "BOTA"
      ]
    },
    {
      "title": "Savana Africana",
      "category": "Vida Selvagem",
      "pool": [
        "LEAO",
        "GIRAFA",
        "ZEBRA",
        "ELEFANTE",
        "GUEPARDO",
        "HIENA",
        "ANTILOPE",
        "BUFALO",
        "AVESTRUZ",
        "LEOPARDO",
        "CHACAL",
        "MACACO"
      ]
    },
    {
      "title": "Viagem de Trem",
      "category": "Transportes",
      "pool": [
        "ESTACAO",
        "VAGAO",
        "BILHETE",
        "MALA",
        "VIAJANTE",
        "TUNEL",
        "PONTE",
        "TRILHO",
        "ROTA",
        "TREM",
        "HORARIO",
        "PARTIDA"
      ]
    },
    {
      "title": "Escola e Saber",
      "category": "Educação",
      "pool": [
        "LAPIS",
        "CADERNO",
        "QUADRO",
        "REGUA",
        "MOCHILA",
        "EXAME",
        "LEITURA",
        "CIENCIA",
        "HISTORIA",
        "MAPA",
        "AULA",
        "LIVRO"
      ]
    },
    {
      "title": "Horta de Legumes",
      "category": "Verduras",
      "pool": [
        "TOMATE",
        "CEBOLA",
        "PEPINO",
        "ALFACE",
        "ESPINAFRE",
        "BROCOLIS",
        "BATATA",
        "CENOURA",
        "RABANETE",
        "NABO",
        "COUVE",
        "QUIABO"
      ]
    },
    {
      "title": "Cinema e Teatro",
      "category": "Espetáculo",
      "pool": [
        "ATOR",
        "ROTEIRO",
        "CENA",
        "CORTINA",
        "CAMERA",
        "ESTREIA",
        "DRAMA",
        "COMEDIA",
        "POLTRONA",
        "APLAUSO",
        "PAPEL",
        "PALCO"
      ]
    },
    {
      "title": "Corpo Humano",
      "category": "Saúde",
      "pool": [
        "CORACAO",
        "CEREBRO",
        "PULMAO",
        "OSSO",
        "SANGUE",
        "MUSCULO",
        "BRACO",
        "PERNA",
        "JOELHO",
        "OMBRO",
        "DENTE",
        "ORELHA"
      ]
    },
    {
      "title": "Mundo Digital",
      "category": "Tecnologia",
      "pool": [
        "TECLADO",
        "TELA",
        "ARQUIVO",
        "CODIGO",
        "DADOS",
        "SERVIDOR",
        "MEMORIA",
        "SISTEMA",
        "REDE",
        "SENSOR",
        "CONSOLE",
        "CABO"
      ]
    },
    {
      "title": "Joias e Gemas",
      "category": "Joalheria",
      "pool": [
        "ANEL",
        "COLAR",
        "PULSEIRA",
        "PEROLA",
        "DIAMANTE",
        "OURO",
        "PRATA",
        "BRONZE",
        "BROCHE",
        "DIADEMA",
        "GEMA",
        "ESMERALDA"
      ]
    },
    {
      "title": "Festa e Carnaval",
      "category": "Celebração",
      "pool": [
        "MASCARA",
        "DESFILE",
        "MUSICA",
        "DANCA",
        "CONFETE",
        "FANTASIA",
        "TAMBOR",
        "ALEGRIA",
        "SAMBA",
        "TRIO",
        "BALAO",
        "FESTA"
      ]
    },
    {
      "title": "Deserto e Dunas",
      "category": "Paisagens",
      "pool": [
        "AREIA",
        "DUNA",
        "OASIS",
        "CACTO",
        "CAMELO",
        "MIRAGEM",
        "PALMEIRA",
        "CALOR",
        "CARAVANA",
        "CANION",
        "NOMADE",
        "POEIRA"
      ]
    },
    {
      "title": "Oficina e Ferramentas",
      "category": "Artesanato",
      "pool": [
        "MARTELO",
        "ALICATE",
        "SERRA",
        "PREGO",
        "PARAFUSO",
        "FURADEIRA",
        "LIMA",
        "PLAINA",
        "CORDA",
        "CORRENTE",
        "CADEADO",
        "CHAVE"
      ]
    }
  ],
  "tl": [
    {
      "title": "Pagkaing Pinoy",
      "category": "Lutuin",
      "pool": [
        "ADOBO",
        "SINIGANG",
        "LUMPIA",
        "LECHON",
        "PANCIT",
        "BIBINGKA",
        "KAREKARE",
        "TINOLA",
        "SISIG",
        "BULALO",
        "PUTO",
        "TURON",
        "MENUDO",
        "LAING"
      ]
    },
    {
      "title": "Prutas sa Palengke",
      "category": "Ani at Prutas",
      "pool": [
        "MANGGA",
        "SAGING",
        "PINYA",
        "PAKWAN",
        "PAPAYA",
        "BAYABAS",
        "RAMBUTAN",
        "DURIAN",
        "LANSONES",
        "NIYOG",
        "ATIS",
        "CHICO",
        "SANTOL",
        "DUHAT"
      ]
    },
    {
      "title": "Gulay sa Bahay Kubo",
      "category": "Halaman",
      "pool": [
        "TALONG",
        "KALABASA",
        "SITAW",
        "AMPALAYA",
        "KAMATIS",
        "SIBUYAS",
        "BAWANG",
        "PATATAS",
        "LABANOS",
        "MUSTASA",
        "SINGKAMAS",
        "PATOLA",
        "KUNDOL"
      ]
    },
    {
      "title": "Hayop sa Pilipinas",
      "category": "Kalikasan",
      "pool": [
        "KALABAW",
        "AGILA",
        "TARSIER",
        "PAGONG",
        "BUWAYA",
        "UNGGOY",
        "KABAYO",
        "MANOK",
        "PALAKA",
        "PARUPARO",
        "BALYENA",
        "PATING",
        "TAMARAW"
      ]
    },
    {
      "title": "Kalikasan at Panahon",
      "category": "Kapaligiran",
      "pool": [
        "BUNDOK",
        "BULKAN",
        "DAGAT",
        "ILOG",
        "GUBAT",
        "BAGYO",
        "KIDLAT",
        "KULOG",
        "BAHAGHARI",
        "HANGIN",
        "ULAP",
        "ULAN",
        "BUROL",
        "TALON"
      ]
    },
    {
      "title": "Sa Loob ng Bahay",
      "category": "Tahanan",
      "pool": [
        "KUSINA",
        "KWARTO",
        "BINTANA",
        "PINTUAN",
        "HAGDAN",
        "BUBONG",
        "LAMPARA",
        "SILID",
        "KAMA",
        "MESA",
        "SILYA",
        "UNAN",
        "KUMOT",
        "BANIG"
      ]
    },
    {
      "title": "Laro ng Lahi",
      "category": "Kultura",
      "pool": [
        "PATINTERO",
        "SUNGKA",
        "SIPA",
        "TUMBANG",
        "TRUMPO",
        "HOLEN",
        "PIKO",
        "TAGUAN",
        "HABULAN",
        "LANGIT",
        "LUPA",
        "TAYA",
        "LUKSONG",
        "AGAWAN"
      ]
    },
    {
      "title": "Pista at Tradisyon",
      "category": "Pagdiriwang",
      "pool": [
        "PAROL",
        "PISTA",
        "HARANA",
        "SAYAW",
        "KANTA",
        "BANDILA",
        "PAPUTOK",
        "SIMBANG",
        "REGALO",
        "MUSIKA",
        "GITARA",
        "TAMBOL",
        "PARADA",
        "FIESTA"
      ]
    },
    {
      "title": "Sasakyan sa Kalsada",
      "category": "Biyahe",
      "pool": [
        "JEEPNEY",
        "KALESA",
        "TRICYCLE",
        "BANGKA",
        "BARKO",
        "EROPLANO",
        "BISIKLETA",
        "KOTSE",
        "TREN",
        "TRAK",
        "TULAY",
        "KALYE",
        "PEDICAB"
      ]
    },
    {
      "title": "Sa Paaralan",
      "category": "Edukasyon",
      "pool": [
        "GURO",
        "AKLAT",
        "LAPIS",
        "PAPEL",
        "PISARA",
        "KLASE",
        "SULAT",
        "BASA",
        "ARALIN",
        "KWADERNO",
        "PAMBURA",
        "SILID",
        "TISA",
        "RULER"
      ]
    },
    {
      "title": "Kalangitan at Bituin",
      "category": "Astronomiya",
      "pool": [
        "ARAW",
        "BUWAN",
        "BITUIN",
        "TALA",
        "PLANETA",
        "KOMETA",
        "ULAP",
        "LANGIT",
        "SINAG",
        "LIWANAG",
        "DILIM",
        "GABI",
        "EKLIPSE",
        "BULALAKAW"
      ]
    },
    {
      "title": "Buhay sa Dagat",
      "category": "Karagatan",
      "pool": [
        "ISDA",
        "ALIMANGO",
        "HIPON",
        "PUGITA",
        "TAHONG",
        "KORALES",
        "ALON",
        "DALUYONG",
        "BUHANGIN",
        "PULO",
        "BANGKA",
        "LAMBAT",
        "TALABA",
        "PAWIKAN"
      ]
    },
    {
      "title": "Mga Kulay at Sining",
      "category": "Sining",
      "pool": [
        "PULA",
        "ASUL",
        "DILAW",
        "BERDE",
        "LILA",
        "KAHEL",
        "PUTI",
        "ITIM",
        "PINTA",
        "KULAY",
        "HUGIS",
        "GUHIT",
        "KAYUMANGI",
        "ROSA"
      ]
    },
    {
      "title": "Katawan ng Tao",
      "category": "Kalusugan",
      "pool": [
        "MATA",
        "ILONG",
        "BIBIG",
        "TAINGA",
        "NGIPIN",
        "DILA",
        "KAMAY",
        "BALIKAT",
        "TUHOD",
        "PUSO",
        "UTAK",
        "BUHOK",
        "BRASO",
        "TIYAN"
      ]
    },
    {
      "title": "Pamilya at Kaibigan",
      "category": "Lipunan",
      "pool": [
        "NANAY",
        "TATAY",
        "KUYA",
        "LOLO",
        "LOLA",
        "KAPATID",
        "KAIBIGAN",
        "PINSAN",
        "ANAK",
        "PAMILYA",
        "BAYAN",
        "KAPWA",
        "NINONG",
        "NINANG"
      ]
    },
    {
      "title": "Alamat at Hiwaga",
      "category": "Mitolohiya",
      "pool": [
        "DIWATA",
        "SIRENA",
        "KAPRE",
        "DUWENDE",
        "DRAGON",
        "HARI",
        "REYNA",
        "PRINSIPE",
        "PRINSESA",
        "KASTILYO",
        "KORONA",
        "ESPADA",
        "TIKBALANG",
        "ASWANG"
      ]
    },
    {
      "title": "Meryenda at Kakanin",
      "category": "Kakanin",
      "pool": [
        "KUTSINTA",
        "SUMAN",
        "PALITAW",
        "BIKO",
        "MAJA",
        "ESPASOL",
        "KARIOCA",
        "PITSI",
        "TAHO",
        "BANANAQ",
        "KAMOTEQ",
        "BINGKA",
        "TUPIG",
        "PUTOBUNGO"
      ]
    },
    {
      "title": "Almusal ng Pinoy",
      "category": "Almusal",
      "pool": [
        "TAPSILOG",
        "LONGSILOG",
        "TOSILOG",
        "PANDESAL",
        "KAPE",
        "ITLOG",
        "TUYO",
        "DAING",
        "SINANGAG",
        "KESO",
        "LUGAW",
        "GOTO",
        "TINAPA",
        "ENSAYMADA"
      ]
    },
    {
      "title": "Panghimagas at Matamis",
      "category": "Matamis",
      "pool": [
        "HALOHALO",
        "LECHEFLAN",
        "YEMA",
        "PASTILLAS",
        "POLVORON",
        "SORBETES",
        "GULAMAN",
        "SAGO",
        "MAKAPUNO",
        "LANGKA",
        "PINIPIG",
        "MATAMIS",
        "ASUKAL",
        "PULOT"
      ]
    },
    {
      "title": "Inumin at Palamig",
      "category": "Inumin",
      "pool": [
        "SALABAT",
        "KALAMANSI",
        "BUKO",
        "LAMBANOG",
        "TUBA",
        "BASI",
        "GATAS",
        "TUBIG",
        "SABAW",
        "KATAS",
        "PALAMIG",
        "KAPENG",
        "TSOKOLATE",
        "SAGO"
      ]
    },
    {
      "title": "Pampalasa at Sawsawan",
      "category": "Pampalasa",
      "pool": [
        "TOYO",
        "SUKA",
        "PATIS",
        "BAGOONG",
        "ASIN",
        "PAMINTA",
        "LUYA",
        "SILI",
        "TANGLAD",
        "LAUREL",
        "ATSUETE",
        "LABUYO",
        "BAWANG",
        "SIBUYAS"
      ]
    },
    {
      "title": "Gamit sa Kusina",
      "category": "Kusina",
      "pool": [
        "KALDERO",
        "KAWALI",
        "SANDOK",
        "KUTSARA",
        "TINIDOR",
        "KUTSILYO",
        "PINGGAN",
        "MANGKOK",
        "BASO",
        "TASA",
        "TAKURE",
        "PALAYOK",
        "KALAN",
        "SALAAN"
      ]
    },
    {
      "title": "Kasuotan ng Pilipino",
      "category": "Kasuotan",
      "pool": [
        "BARONG",
        "SAYA",
        "KIMONA",
        "PATADYONG",
        "CAMISA",
        "TSINELAS",
        "BAKYA",
        "SUMBRERO",
        "SALAKOT",
        "PANTALON",
        "DAMIT",
        "PALDA",
        "MEDYAS",
        "SAPATOS"
      ]
    },
    {
      "title": "Alahas at Palamuti",
      "category": "Palamuti",
      "pool": [
        "SINGSING",
        "KWINTAS",
        "HIKAW",
        "PULSERAS",
        "KORONA",
        "PERLAS",
        "GINTO",
        "PILAK",
        "BRILYANTE",
        "RUBI",
        "DYAMANTE",
        "BROTSE",
        "PANYO",
        "PAMAYPAY"
      ]
    },
    {
      "title": "Trabaho at Hanapbuhay",
      "category": "Propesyon",
      "pool": [
        "DOKTOR",
        "ABOGADO",
        "INHINYERO",
        "BUMBERO",
        "PULIS",
        "SUNDALO",
        "MAGSASAKA",
        "PANADERO",
        "PINTOR",
        "PILOTO",
        "DRAYBER",
        "KUSINERO",
        "BARBERO",
        "MANANAHI"
      ]
    },
    {
      "title": "Mga Bulaklak sa Hardin",
      "category": "Bulaklak",
      "pool": [
        "SAMPAGITA",
        "GUMAMELA",
        "ROSAL",
        "ILANG",
        "SANTAN",
        "ROSAS",
        "LIRYO",
        "ORKIDYAS",
        "MIRASOL",
        "KAMPUPOT",
        "SITSIRIKA",
        "DAHLIA",
        "TULIPAN",
        "LOTUS"
      ]
    },
    {
      "title": "Punong Kahoy",
      "category": "Kagubatan",
      "pool": [
        "NARRA",
        "MOLAVE",
        "ACACIA",
        "BALETE",
        "MANGGA",
        "NIYOG",
        "KAWAYAN",
        "BANABA",
        "KAMAGONG",
        "YAKAL",
        "IPIL",
        "TALISAY",
        "MAHOGANY",
        "SAMPALOK"
      ]
    },
    {
      "title": "Mga Ibon sa Langit",
      "category": "Mga Ibon",
      "pool": [
        "AGILA",
        "MAYA",
        "KALAPATI",
        "LAWIN",
        "KUWAGO",
        "LORO",
        "UWAK",
        "TAGAK",
        "PUGO",
        "BIBE",
        "ITIK",
        "PATO",
        "GANSA",
        "PABO"
      ]
    },
    {
      "title": "Insekto at Maliliit",
      "category": "Insekto",
      "pool": [
        "PARUPARO",
        "LANGGAM",
        "BUBUYOG",
        "LAMOK",
        "LANGAW",
        "TUTUBI",
        "TIPAKLONG",
        "GAGAMBA",
        "IPIS",
        "ALITAPTAP",
        "KULIGLIG",
        "SALAGINTO",
        "PUTAKTI",
        "ANAY"
      ]
    },
    {
      "title": "Mga Isda sa Pilipinas",
      "category": "Isda",
      "pool": [
        "BANGUS",
        "TILAPIA",
        "HITO",
        "DALAG",
        "LAPULAPU",
        "MAYAMAYA",
        "TUNA",
        "TAMBAN",
        "DILIS",
        "BIYA",
        "HASAHASA",
        "TANIGUE",
        "SALMON",
        "SARDINAS"
      ]
    },
    {
      "title": "Lugar at Lalawigan",
      "category": "Heograpiya",
      "pool": [
        "MAYNILA",
        "CEBU",
        "DAVAO",
        "ILOILO",
        "BAGUIO",
        "PALAWAN",
        "BOHOL",
        "BORACAY",
        "SIARGAO",
        "BATANES",
        "ILOCOS",
        "BICOL",
        "LEYTE",
        "CAVITE"
      ]
    },
    {
      "title": "Anyong Lupa at Tubig",
      "category": "Kalupaan",
      "pool": [
        "BUNDOK",
        "BUROL",
        "TALAMPAS",
        "KAPATAGAN",
        "LAMBAK",
        "BULKAN",
        "KWEBA",
        "TALON",
        "LAWA",
        "LOOK",
        "KIPOT",
        "GOLPO",
        "BATIS",
        "TANGWAY"
      ]
    },
    {
      "title": "Instrumentong Musika",
      "category": "Musika",
      "pool": [
        "GITARA",
        "PIANO",
        "BYOLIN",
        "TAMBOL",
        "KUDYAPI",
        "KULINTANG",
        "AGONG",
        "GANGSA",
        "BANDURIA",
        "OKTAVINA",
        "FLAUTA",
        "TRUMPETA",
        "HARPA",
        "KUBING"
      ]
    },
    {
      "title": "Katutubong Sayaw",
      "category": "Sayaw",
      "pool": [
        "TINIKLING",
        "PANDANGGO",
        "CARINOSA",
        "SINGKIL",
        "ITIKITIK",
        "SUBLI",
        "KURATSA",
        "BINASUAN",
        "SAKUTING",
        "RIGODON",
        "BALSE",
        "INDAK",
        "HAKBANG",
        "SALUDO"
      ]
    },
    {
      "title": "Palakasan at Isports",
      "category": "Isports",
      "pool": [
        "BASKETBOL",
        "BOLIBOL",
        "BOKSING",
        "ARNIS",
        "SEPAK",
        "LANGOY",
        "TAKBO",
        "TENIS",
        "BADMINTON",
        "PUTBOL",
        "SIKLISMO",
        "KAMPYON",
        "TROPEO",
        "MEDALYA"
      ]
    },
    {
      "title": "Emosyon at Damdamin",
      "category": "Damdamin",
      "pool": [
        "SAYA",
        "LUNGKOT",
        "GALIT",
        "TAKOT",
        "PAGIBIG",
        "KILIG",
        "HIYA",
        "GULAT",
        "TUWA",
        "PIGHATI",
        "PAGASA",
        "TIWALA",
        "INGGIT",
        "GIGIL"
      ]
    },
    {
      "title": "Katangiang Pilipino",
      "category": "Pagpapahalaga",
      "pool": [
        "SIPAG",
        "TIYAGA",
        "BAIT",
        "TAPANG",
        "GALANG",
        "KATAPATAN",
        "MALASAKIT",
        "BAYANIHAN",
        "DAMAYAN",
        "DANGAL",
        "TALINO",
        "HUSAY",
        "TATAG",
        "LINGAP"
      ]
    },
    {
      "title": "Oras at Panahon",
      "category": "Oras",
      "pool": [
        "UMAGA",
        "TANGHALI",
        "HAPON",
        "GABI",
        "BUKAS",
        "KAHAPON",
        "NGAYON",
        "LINGGO",
        "BUWAN",
        "TAON",
        "MINUTO",
        "SEGUNDO",
        "ORAS",
        "DEKADA"
      ]
    },
    {
      "title": "Araw at Buwan",
      "category": "Kalendaryo",
      "pool": [
        "LUNES",
        "MARTES",
        "MYERKULES",
        "HUWEBES",
        "BIYERNES",
        "SABADO",
        "ENERO",
        "PEBRERO",
        "MARSO",
        "ABRIL",
        "MAYO",
        "HUNYO",
        "HULYO",
        "AGOSTO"
      ]
    },
    {
      "title": "Bilang at Sukat",
      "category": "Matematika",
      "pool": [
        "DALAWA",
        "TATLO",
        "APAT",
        "LIMA",
        "ANIM",
        "PITO",
        "WALO",
        "SIYAM",
        "SAMPU",
        "DAAN",
        "LIBO",
        "MILYON",
        "METRO",
        "KILO"
      ]
    },
    {
      "title": "Sa Palengke at Tindahan",
      "category": "Komersyo",
      "pool": [
        "TINDAHAN",
        "PALENGKE",
        "PRESYO",
        "SUKLI",
        "TAWAD",
        "BAYAD",
        "PERA",
        "BARYA",
        "SALAPI",
        "TIMBANGAN",
        "SUPOT",
        "BAYONG",
        "SUKI",
        "TINDERA"
      ]
    },
    {
      "title": "Sa Ospital at Klinika",
      "category": "Medisina",
      "pool": [
        "OSPITAL",
        "KLINIKA",
        "GAMOT",
        "RESETA",
        "INIKSYON",
        "BENDAHE",
        "LAGNAT",
        "SIPON",
        "SAKIT",
        "SUGAT",
        "DUGO",
        "PULSO",
        "BALAT",
        "BITAMINA"
      ]
    },
    {
      "title": "Kasangkapan sa Bahay",
      "category": "Kagamitan",
      "pool": [
        "MARTILYO",
        "LAGARI",
        "PAKO",
        "TORNILYO",
        "LIYABE",
        "PLAIS",
        "PALA",
        "ASAROL",
        "KARIT",
        "ITAK",
        "GUNTING",
        "KARAYOM",
        "SINULID",
        "KANDADO"
      ]
    },
    {
      "title": "Kalinisan at Pagligo",
      "category": "Kalinisan",
      "pool": [
        "SABON",
        "SHAMPOO",
        "TUWALYA",
        "SEPILYO",
        "SUKLAY",
        "SALAMIN",
        "TABO",
        "TIMBA",
        "BALDE",
        "GRIPO",
        "LABABO",
        "WALIS",
        "BASAHAN",
        "PLANTSA"
      ]
    },
    {
      "title": "Bayani at Kasaysayan",
      "category": "Kasaysayan",
      "pool": [
        "RIZAL",
        "BONIFACIO",
        "MABINI",
        "SILANG",
        "KALAYAAN",
        "KATIPUNAN",
        "BANDILA",
        "BAYANI",
        "BARANGAY",
        "DATU",
        "RAHA",
        "SULTAN",
        "BALANGAY",
        "BAYBAYIN"
      ]
    },
    {
      "title": "Makabagong Teknolohiya",
      "category": "Teknolohiya",
      "pool": [
        "TELEPONO",
        "KOMPYUTER",
        "INTERNET",
        "RADYO",
        "KAMERA",
        "BATERYA",
        "KABLE",
        "ISKRIN",
        "MENSAHE",
        "TAWAG",
        "LARAWAN",
        "BIDYO",
        "TUNOG",
        "KORYENTE"
      ]
    },
    {
      "title": "Buhay sa Bukid",
      "category": "Agrikultura",
      "pool": [
        "BUKID",
        "PALAY",
        "BIGAS",
        "ANIHAN",
        "ARARO",
        "KUBO",
        "PILAPIL",
        "PATUBIG",
        "BINHI",
        "PUNLA",
        "DAMO",
        "DAYAMI",
        "KAMALIG",
        "SAKAHAN"
      ]
    },
    {
      "title": "Paglalakbay at Bakasyon",
      "category": "Turismo",
      "pool": [
        "BAKASYON",
        "BIYAHE",
        "HOTEL",
        "RESORT",
        "PLAYA",
        "PULO",
        "MALETA",
        "PASAPORTE",
        "TIKET",
        "MAPA",
        "KOMPAS",
        "TULUYAN",
        "KAMPING",
        "PASYALAN"
      ]
    },
    {
      "title": "Sa Lungsod at Bayan",
      "category": "Komunidad",
      "pool": [
        "LUNGSOD",
        "BAYAN",
        "BARANGAY",
        "PLASA",
        "SIMBAHAN",
        "MUNISIPYO",
        "PARKE",
        "BANGKO",
        "TULAY",
        "KALSADA",
        "ESKINA",
        "KANTO",
        "GUSALI",
        "PALIPARAN"
      ]
    },
    {
      "title": "Pasko sa Pilipinas",
      "category": "Pasko",
      "pool": [
        "PASKO",
        "PAROL",
        "BELEN",
        "SIMBANG",
        "NOCHE",
        "AGUINALDO",
        "REGALO",
        "KANTAHAN",
        "HARANA",
        "PUTO",
        "BIBINGKA",
        "HAMON",
        "ANGHEL",
        "KAMPANA"
      ]
    },
    {
      "title": "Pagsusulat at Panitikan",
      "category": "Panitikan",
      "pool": [
        "TULA",
        "KWENTO",
        "ALAMAT",
        "PABULA",
        "NOBELA",
        "SANAYSAY",
        "BUGTONG",
        "TALATA",
        "SAKNONG",
        "TUGMA",
        "AKDA",
        "PAHINA",
        "PAMAGAT",
        "SALITA"
      ]
    },
    {
      "title": "Panahon at Sakuna",
      "category": "Klima",
      "pool": [
        "TAGINIT",
        "TAGULAN",
        "AMIHAN",
        "HABAGAT",
        "BAGYO",
        "BAHA",
        "LINDOL",
        "TSUNAMI",
        "INIT",
        "LAMIG",
        "GINAW",
        "HAMOG",
        "AMBON",
        "BUHAWI"
      ]
    },
    {
      "title": "Mga Kilos at Galaw",
      "category": "Pandiwa",
      "pool": [
        "TAKBO",
        "LAKAD",
        "TALON",
        "LANGOY",
        "LIPAD",
        "SAYAW",
        "KANTA",
        "TAWA",
        "IYAK",
        "TULOG",
        "GISING",
        "KAIN",
        "INOM",
        "TULONG"
      ]
    },
    {
      "title": "Mga Paglalarawan",
      "category": "Pang-uri",
      "pool": [
        "MAGANDA",
        "MALAKI",
        "MALIIT",
        "MATAAS",
        "MABABA",
        "MABILIS",
        "MABAGAL",
        "MALAKAS",
        "MAHINA",
        "MATAMIS",
        "MAASIM",
        "MAALAT",
        "MAPAIT",
        "MALINIS"
      ]
    },
    {
      "title": "Pangingisda at Baybayin",
      "category": "Pangingisda",
      "pool": [
        "LAMBAT",
        "BINGWIT",
        "PAIN",
        "BANGKA",
        "SAGWAN",
        "LAYAG",
        "ANGKLA",
        "PAROLA",
        "DAUNGAN",
        "PANTALAN",
        "KABIBE",
        "PERLAS",
        "TALABA",
        "ALIMASAG"
      ]
    },
    {
      "title": "Negosyo at Tanggapan",
      "category": "Opisina",
      "pool": [
        "OPISINA",
        "MESA",
        "UPUAN",
        "PAPEL",
        "BOLPEN",
        "KUWENTA",
        "SALAPI",
        "BANGKO",
        "RESIBO",
        "KONTRATA",
        "PULONG",
        "PLANO",
        "PROYEKTO",
        "SAHOD"
      ]
    },
    {
      "title": "Sining at Likhang Kamay",
      "category": "Likhang Kamay",
      "pool": [
        "BANIG",
        "BAKOL",
        "PALAYOK",
        "LILOK",
        "UKIT",
        "HABI",
        "BURDA",
        "PINTA",
        "GUHIT",
        "ESKULTURA",
        "TEATRO",
        "PELIKULA",
        "MASKARA",
        "BANDERA"
      ]
    },
    {
      "title": "Pangarap at Tagumpay",
      "category": "Inspirasyon",
      "pool": [
        "PANGARAP",
        "TAGUMPAY",
        "PAGASA",
        "LAKAS",
        "TAPANG",
        "TIWALA",
        "LIGAYA",
        "PAYAPA",
        "BIYAYA",
        "GRASYA",
        "SWERTE",
        "HIMALA",
        "LANDAS",
        "LAYUNIN"
      ]
    },
    {
      "title": "Mga Alagang Hayop",
      "category": "Alaga",
      "pool": [
        "PUSA",
        "IBON",
        "ISDA",
        "KONEHO",
        "PAGONG",
        "HAMSTER",
        "MANOK",
        "BIBE",
        "BABOY",
        "BAKA",
        "KAMBING",
        "TUPA",
        "TUTA",
        "KUTING",
        "SISIW"
      ]
    },
    {
      "title": "Piyesta ng Baryo",
      "category": "Baryo",
      "pool": [
        "BARYO",
        "BANDERA",
        "MUSIKO",
        "PARADA",
        "PALARO",
        "PALOSEBO",
        "PABITIN",
        "PUKPOK",
        "LECHON",
        "HANDAAN",
        "BISITA",
        "TAWANAN",
        "KASIYAHAN",
        "SAYAWAN"
      ]
    }
  ]
};

export interface DeStackWordEntry {
  word: string;
  hint: string;
}

export interface DeStackLanguageBank {
  wordBank: DeStackWordEntry[];
  wordMasks: Uint32Array;
  wordFirstBits: Uint32Array;
  wordCharBits: Uint32Array;
  dict5Words: string[];
  dict5Masks: Uint32Array;
  dict5Chars: Uint8Array;
  dict5Buckets: number[][];
}

const DESTACK_LANG_CACHE = new Map<string, DeStackLanguageBank>();

function makeLocalizedHint(lang: NonEnglishLanguageCode, word: string): string {
  const labels: Record<NonEnglishLanguageCode, string> = {
    es: "Palabra en español",
    fr: "Mot français",
    de: "Deutsches Wort",
    it: "Parola italiana",
    pt: "Palavra em português",
    tl: "Salitang Filipino",
  };
  return `${labels[lang]} (${word[0]}...${word[word.length - 1]})`;
}

export function getDeStackLanguageBank(lang: DictionaryLanguageCode): DeStackLanguageBank | null {
  if (lang === "en") return null;
  const cached = DESTACK_LANG_CACHE.get(lang);
  if (cached) return cached;

  const pack = getMultiLangPack(lang);
  const all5 = new Set<string>();
  const unique5 = new Set<string>();

  if (pack) {
    for (const w of pack.words) {
      const clean = stripDiacritics(w).toUpperCase().replace(/[^A-Z]/g, "");
      if (clean.length === 5 && /^[A-Z]{5}$/.test(clean)) {
        all5.add(clean);
        if (new Set(clean.split("")).size === 5) unique5.add(clean);
      }
    }
    for (const prompt of pack.drawingPrompts) {
      if (!prompt.includes(" ") && !prompt.includes("-")) {
        const clean = stripDiacritics(prompt).toUpperCase().replace(/[^A-Z]/g, "");
        if (clean.length === 5 && /^[A-Z]{5}$/.test(clean)) {
          all5.add(clean);
          if (new Set(clean.split("")).size === 5) unique5.add(clean);
        }
      }
    }
  }
  for (const theme of MULTILANG_MPSEARCH_THEMES[lang] || []) {
    for (const w of theme.pool) {
      if (w.length === 5 && /^[A-Z]{5}$/.test(w)) {
        all5.add(w);
        if (new Set(w.split("")).size === 5) unique5.add(w);
      }
    }
  }

  const wordBank: DeStackWordEntry[] = Array.from(unique5).map((word) => ({
    word,
    hint: makeLocalizedHint(lang, word),
  }));
  const wordMasks = new Uint32Array(wordBank.length);
  const wordFirstBits = new Uint32Array(wordBank.length);
  const wordCharBits = new Uint32Array(wordBank.length * 5);

  for (let i = 0; i < wordBank.length; i++) {
    const w = wordBank[i].word;
    let mask = 0;
    for (let j = 0; j < 5; j++) {
      const bit = 1 << (w.charCodeAt(j) - 65);
      wordCharBits[i * 5 + j] = bit;
      mask |= bit;
      if (j === 0) wordFirstBits[i] = bit;
    }
    wordMasks[i] = mask;
  }

  const dict5Words = Array.from(all5);
  const dict5Masks = new Uint32Array(dict5Words.length);
  const dict5Chars = new Uint8Array(dict5Words.length * 5);
  const dict5Buckets: number[][] = Array.from({ length: 26 }, () => []);

  for (let i = 0; i < dict5Words.length; i++) {
    const w = dict5Words[i];
    let mask = 0;
    for (let j = 0; j < 5; j++) {
      const code = w.charCodeAt(j);
      dict5Chars[i * 5 + j] = code;
      mask |= 1 << (code - 65);
    }
    dict5Masks[i] = mask;
    dict5Buckets[w.charCodeAt(0) - 65].push(i);
  }

  const bank: DeStackLanguageBank = {
    wordBank,
    wordMasks,
    wordFirstBits,
    wordCharBits,
    dict5Words,
    dict5Masks,
    dict5Chars,
    dict5Buckets,
  };
  DESTACK_LANG_CACHE.set(lang, bank);
  return bank;
}
