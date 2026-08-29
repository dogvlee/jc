/**
 * Shangyue-owned monochrome material glyphs.
 *
 * These are source-independent vector drawings made for thermal labels. Paths
 * use a compact, absolute M/L/C/Q/Z subset in a 24 x 24 unit box, so the same
 * artwork stays sharp in browser previews and printer canvases without raster
 * assets or external icon fonts.
 */

const SYMBOLS = {
  cat: {
    paths: ['M5 9 L6 3 L10 6 C11 5.6 13 5.6 14 6 L18 3 L19 9 C20 15 17 20 12 20 C7 20 4 15 5 9 Z', 'M8 12 L9.5 12', 'M14.5 12 L16 12', 'M10 16 Q12 18 14 16', 'M4 14 L8 15', 'M20 14 L16 15'],
    fills: ['M11 14 L13 14 L12 15.5 Z']
  },
  dog: {
    paths: ['M7 7 C8 4 16 4 17 7 C20 6 21 8 20 12 L18 16 C17 20 7 20 6 16 L4 12 C3 8 4 6 7 7 Z', 'M9 11 L10 11', 'M14 11 L15 11', 'M9 16 Q12 19 15 16'],
    fills: ['M10.5 14 Q12 12.5 13.5 14 Q12 16 10.5 14 Z']
  },
  rabbit: {
    paths: ['M8 8 C6 3 7 1 9 2 C11 3 11 6 11 7', 'M13 7 C13 4 14 1 16 2 C18 3 17 7 16 8', 'M6 13 C6 8 18 8 18 13 C18 19 15 21 12 21 C9 21 6 19 6 13 Z', 'M9 13 L10 13', 'M14 13 L15 13', 'M10 17 Q12 18.5 14 17'],
    fills: ['M11 15 L13 15 L12 16.2 Z']
  },
  bird: {
    paths: ['M5 14 C5 8 10 5 15 8 C18 9 19 12 19 15 C18 19 12 21 8 18 C6 17 5 16 5 14 Z', 'M10 11 C13 10 15 12 15 15 C12 15 10 14 10 11 Z', 'M8 18 L7 21', 'M13 19 L14 21'],
    fills: ['M18 11 L22 13 L18 15 Z'],
    circles: [[15, 10, 0.75, true]]
  },
  fish: {
    paths: ['M4 12 C7 7 14 7 18 12 C14 17 7 17 4 12 Z', 'M18 12 L22 8 L22 16 Z', 'M10 9 Q12 12 10 15'],
    circles: [[7.5, 11, 0.7, true]]
  },
  butterfly: {
    paths: ['M11 10 C8 4 3 4 4 9 C4 12 7 13 11 12', 'M13 10 C16 4 21 4 20 9 C20 12 17 13 13 12', 'M11 14 C8 12 5 14 6 18 C7 21 10 18 12 16', 'M13 14 C16 12 19 14 18 18 C17 21 14 18 12 16', 'M12 7 L12 19', 'M12 7 Q9 4 8 3', 'M12 7 Q15 4 16 3'],
    circles: [[12, 6.5, 0.8, true]]
  },
  bear: {
    paths: ['M6 9 C5 6 7 4 9 6 C11 5 13 5 15 6 C17 4 19 6 18 9 C21 15 17 20 12 20 C7 20 3 15 6 9 Z', 'M8 12 L9.5 12', 'M14.5 12 L16 12', 'M10 17 Q12 18.5 14 17'],
    circles: [[12, 15, 2.3, false], [12, 14.5, 0.8, true]]
  },
  chick: {
    paths: ['M6 13 C6 7 10 5 15 7 C19 9 19 16 15 19 C10 22 6 18 6 13 Z', 'M8 19 L7 22', 'M14 20 L15 22'],
    fills: ['M18 11 L22 13 L18 15 Z'],
    circles: [[14.5, 10.5, 0.75, true]]
  },
  fox: {
    paths: ['M5 8 L7 3 L11 6 C12 5.5 13 5.5 14 6 L18 3 L19 9 C20 14 17 20 12 21 C7 20 4 14 5 8 Z', 'M6 9 L10 13 L12 19', 'M18 9 L14 13 L12 19', 'M8 11 L9.5 11', 'M14.5 11 L16 11'],
    fills: ['M10.5 15 L13.5 15 L12 17 Z']
  },
  wink: {
    paths: ['M4 12 C4 6 8 3 12 3 C18 3 21 7 21 12 C21 18 17 21 12 21 C6 21 4 17 4 12 Z', 'M7.5 10 Q9 8.5 10.5 10', 'M14 10 L16 10', 'M8.5 15 Q12 18.5 16 15'],
    circles: [[15, 10, 0.6, true]]
  },
  sad: {
    paths: ['M4 12 C4 6 8 3 12 3 C18 3 21 7 21 12 C21 18 17 21 12 21 C6 21 4 17 4 12 Z', 'M8 17 Q12 13 16 17'],
    circles: [[9, 10, 0.8, true], [15, 10, 0.8, true]]
  },
  cool: {
    paths: ['M4 12 C4 6 8 3 12 3 C18 3 21 7 21 12 C21 18 17 21 12 21 C6 21 4 17 4 12 Z', 'M5.5 9 L10.5 9 L10 12 L7 12 Z', 'M13.5 9 L18.5 9 L17 12 L14 12 Z', 'M10.5 9 L13.5 9', 'M9 16 Q12 18 15 16']
  },
  love_face: {
    paths: ['M4 12 C4 6 8 3 12 3 C18 3 21 7 21 12 C21 18 17 21 12 21 C6 21 4 17 4 12 Z', 'M8 9 C6 7 5 10 8 12 C11 10 10 7 8 9 Z', 'M16 9 C14 7 13 10 16 12 C19 10 18 7 16 9 Z', 'M8 15 Q12 19 16 15']
  },
  user: {
    paths: ['M5 21 C5 16 8 14 12 14 C16 14 19 16 19 21', 'M8 8 C8 5 10 3 12 3 C15 3 17 5 17 8 C17 11 15 13 12 13 C9 13 8 11 8 8 Z']
  },

  apple: {
    paths: ['M12 8 C9 5 4 8 5 14 C6 20 10 22 12 19 C14 22 18 20 19 14 C20 8 15 5 12 8 Z', 'M12 8 C11 5 12 3 14 2', 'M13 5 C16 3 18 4 18 6 C16 7 14 7 13 5 Z']
  },
  bread: {
    paths: ['M5 10 C3 7 5 4 8 4 L16 4 C20 4 21 8 19 10 L19 20 L5 20 Z', 'M8 9 Q9 7 10 9', 'M12 9 Q13 7 14 9', 'M16 9 Q17 7 18 9']
  },
  coffee: {
    paths: ['M5 9 L17 9 L16 18 C15 20 7 20 6 18 Z', 'M17 11 C22 10 22 17 17 17', 'M7 22 L18 22', 'M9 7 C7 5 10 4 9 2', 'M13 7 C11 5 14 4 13 2']
  },
  ice_cream: {
    paths: ['M7 10 C7 6 9 3 12 3 C16 3 18 6 17 10 C18 12 16 14 14 13 C13 15 10 15 9 13 C6 14 5 11 7 10 Z', 'M8 14 L16 14 L12 22 Z', 'M10 15 L14 19', 'M14 15 L11 19']
  },
  pizza: {
    paths: ['M5 19 L11 4 C15 5 19 8 21 12 Z', 'M9 8 C13 9 17 11 19 14'],
    circles: [[12, 11, 1, false], [15.5, 14.5, 0.9, false]]
  },
  egg: {
    paths: ['M12 3 C16 3 20 11 19 15 C18 20 15 22 12 22 C8 22 5 19 5 15 C4 11 8 3 12 3 Z'],
    circles: [[12, 14, 3, false]]
  },
  bowl: {
    paths: ['M4 11 L20 11 C19 17 16 20 12 20 C8 20 5 17 4 11 Z', 'M3 11 L21 11', 'M8 8 C6 6 9 5 8 3', 'M13 8 C11 6 14 5 13 3']
  },
  strawberry: {
    paths: ['M12 7 C17 5 20 9 18 14 C16 19 13 22 12 22 C11 22 8 19 6 14 C4 9 7 5 12 7 Z', 'M8 7 L6 4 L10 5 L12 2 L14 5 L18 4 L16 7'],
    circles: [[9, 11, 0.45, true], [14, 10, 0.45, true], [12, 14, 0.45, true], [15, 16, 0.45, true], [9, 17, 0.45, true]]
  },
  champagne: {
    paths: ['M5 4 L11 4 L10 11 C9 13 7 13 6 11 Z', 'M8 13 L8 20', 'M5 21 L11 21', 'M14 4 L20 4 L19 11 C18 13 16 13 15 11 Z', 'M17 13 L17 20', 'M14 21 L20 21', 'M10 15 L15 10'],
    circles: [[7, 7, 0.45, true], [17, 7, 0.45, true]]
  },

  bow_tie: { paths: ['M4 7 L11 11 L11 13 L4 17 Z', 'M20 7 L13 11 L13 13 L20 17 Z'], fills: ['M10 10 L14 10 L14 14 L10 14 Z'] },
  gem: { paths: ['M4 9 L8 4 L16 4 L20 9 L12 21 Z', 'M4 9 L20 9', 'M8 4 L10 9 L12 21', 'M16 4 L14 9 L12 21'] },
  crown: { paths: ['M4 7 L8 12 L12 4 L16 12 L20 7 L18 19 L6 19 Z', 'M6 16 L18 16'], circles: [[4, 6, 1, true], [12, 3, 1, true], [20, 6, 1, true]] },
  lock: { paths: ['M6 10 L18 10 L18 21 L6 21 Z', 'M8 10 L8 7 C8 2 16 2 16 7 L16 10', 'M12 14 L12 17'], circles: [[12, 14, 1, true]] },
  folder: { paths: ['M3 7 L10 7 L12 10 L21 10 L20 20 L4 20 Z', 'M3 7 L3 5 L10 5 L12 8 L20 8 L21 10'] },
  calendar: { paths: ['M4 6 L20 6 L20 21 L4 21 Z', 'M4 10 L20 10', 'M8 3 L8 8', 'M16 3 L16 8', 'M8 14 L10 14', 'M14 14 L16 14', 'M8 18 L10 18', 'M14 18 L16 18'] },
  clipboard: { paths: ['M6 5 L18 5 L19 21 L5 21 Z', 'M9 3 L15 3 L16 7 L8 7 Z', 'M8 11 L16 11', 'M8 15 L16 15', 'M8 19 L13 19'] },
  printer: { paths: ['M7 3 L17 3 L17 9 L7 9 Z', 'M4 9 L20 9 L21 17 L17 17 L17 21 L7 21 L7 17 L3 17 Z', 'M8 15 L16 15 L16 21 L8 21 Z'], circles: [[17.5, 12.5, 0.8, true]] },
  trophy: { paths: ['M7 4 L17 4 L16 11 C15 16 9 16 8 11 Z', 'M7 6 L4 6 C4 11 6 13 9 13', 'M17 6 L20 6 C20 11 18 13 15 13', 'M12 16 L12 20', 'M8 21 L16 21'] },
  cart: { paths: ['M3 5 L6 5 L8 16 L18 16 L21 8 L7 8', 'M9 12 L19 12'], circles: [[9, 20, 1.5, false], [18, 20, 1.5, false]] },
  bag: { paths: ['M5 8 L19 8 L20 21 L4 21 Z', 'M8 9 C8 2 16 2 16 9'] },
  tag: { paths: ['M4 5 L14 4 L21 11 L12 20 L4 12 Z'], circles: [[9, 9, 1.3, false]] },
  store: { paths: ['M4 10 L20 10 L19 21 L5 21 Z', 'M3 9 L6 3 L18 3 L21 9', 'M3 9 Q5 13 7 9 Q9 13 12 9 Q15 13 17 9 Q19 13 21 9', 'M8 14 L12 14 L12 21', 'M15 14 L18 14 L18 17 L15 17 Z'] },
  chat: { paths: ['M4 5 L20 5 L20 17 L13 17 L8 21 L8 17 L4 17 Z'], circles: [[8, 11, 0.8, true], [12, 11, 0.8, true], [16, 11, 0.8, true]] },
  home: { paths: ['M3 11 L12 3 L21 11', 'M5 10 L5 21 L19 21 L19 10', 'M10 21 L10 15 L14 15 L14 21'] },
  truck: { paths: ['M3 6 L14 6 L14 17 L3 17 Z', 'M14 10 L18 10 L21 14 L21 17 L14 17 Z'], circles: [[7, 19, 2, false], [18, 19, 2, false]] },
  package: { paths: ['M4 7 L12 3 L20 7 L20 18 L12 22 L4 18 Z', 'M4 7 L12 12 L20 7', 'M12 12 L12 22', 'M8 5 L16 9 L16 13'] },
  red_packet: { paths: ['M6 3 L18 3 L19 21 L5 21 Z', 'M6 7 L12 12 L18 7', 'M8 16 L16 16'], circles: [[12, 16, 2.5, false]] },
  ribbon: { paths: ['M7 4 C9 2 11 4 12 7 C13 4 15 2 17 4 C20 7 17 11 12 14 C7 11 4 7 7 4 Z', 'M9 12 L7 22 L12 19 L17 22 L15 12'] },

  balloon: { paths: ['M7 9 C7 4 10 2 13 3 C17 3 19 6 18 10 C18 14 15 17 12 17 C9 17 7 13 7 9 Z', 'M12 17 L10 20 L13 20 L11 23'] },
  bells: { paths: ['M5 15 C7 13 7 9 8 7 C10 3 14 3 16 7 C17 9 17 13 19 15 Z', 'M4 16 L20 16', 'M10 18 Q12 21 14 18', 'M12 4 L12 2'] },
  earring: { paths: ['M12 3 L12 7'], circles: [[12, 4, 1.5, false], [12, 14, 6, false], [12, 14, 2, false]] },
  necklace: { paths: ['M4 5 C5 14 8 19 12 19 C16 19 19 14 20 5', 'M8 6 C9 12 10 15 12 16 C14 15 15 12 16 6'], fills: ['M12 16 L15 19 L12 22 L9 19 Z'] },
  sun: { paths: ['M12 1 L12 4', 'M12 20 L12 23', 'M1 12 L4 12', 'M20 12 L23 12', 'M4 4 L6 6', 'M18 18 L20 20', 'M20 4 L18 6', 'M6 18 L4 20'], circles: [[12, 12, 5, false]] },
  cloud: { paths: ['M5 18 C2 18 2 13 5 12 C5 8 9 6 12 8 C15 4 21 8 19 12 C23 13 22 18 19 18 Z'] },
  rain: { paths: ['M5 14 C2 14 2 9 5 8 C5 4 9 2 12 5 C15 1 21 5 19 9 C23 10 22 14 19 14 Z', 'M7 17 L6 21', 'M12 17 L11 21', 'M17 17 L16 21'] },
  moon: { paths: ['M16 3 C9 4 6 9 8 15 C10 20 16 22 21 18 C14 19 10 14 12 9 C13 6 14 5 16 3 Z'] },
  gear: { paths: ['M10 3 L14 3 L15 6 L18 5 L20 8 L18 10 L21 12 L20 16 L17 16 L16 20 L13 19 L11 22 L8 20 L8 17 L4 17 L4 13 L2 11 L5 8 L7 9 Z'], circles: [[12, 12, 3.5, false]] },
  target: { paths: ['M12 2 L12 5', 'M12 19 L12 22', 'M2 12 L5 12', 'M19 12 L22 12'], circles: [[12, 12, 8, false], [12, 12, 4.5, false], [12, 12, 1.2, true]] },
  link: { paths: ['M9 15 L7 17 C3 21 0 16 3 13 L6 10 C8 8 10 8 12 10', 'M15 9 L17 7 C21 3 24 8 21 11 L18 14 C16 16 14 16 12 14', 'M8 16 L16 8'] },
  lantern: { paths: ['M8 5 L16 5', 'M7 8 C8 5 16 5 17 8 L16 17 C15 20 9 20 8 17 Z', 'M7 10 L17 10', 'M8 16 L16 16', 'M12 20 L12 23', 'M9 23 L15 23', 'M10 3 L14 3'] },
  sunflower: { paths: ['M12 15 L12 23', 'M12 19 C9 17 7 18 7 20 C9 21 11 21 12 19', 'M12 18 C15 16 17 17 17 19 C15 21 13 20 12 18'], circles: [[12, 9, 3.5, true], [12, 3.5, 2.5, false], [12, 14.5, 2.5, false], [6.5, 9, 2.5, false], [17.5, 9, 2.5, false], [8, 5, 2.5, false], [16, 5, 2.5, false], [8, 13, 2.5, false], [16, 13, 2.5, false]] },
  medal: { paths: ['M7 3 L11 3 L13 10 L9 12 Z', 'M13 3 L17 3 L15 12 L11 10 Z', 'M9 19 L7 23 L12 21 L17 23 L15 19'], circles: [[12, 15, 5.5, false], [12, 15, 2, true]] },
  refresh: { paths: ['M19 8 C17 4 12 2 8 4 C4 6 3 10 4 13', 'M19 8 L19 3', 'M19 8 L14 8', 'M5 16 C7 20 12 22 16 20 C20 18 21 14 20 11', 'M5 16 L5 21', 'M5 16 L10 16'] },

  chopsticks: { paths: ['M8 3 L5 21', 'M14 3 L11 21', 'M17 5 L21 9 L16 14 L12 10 Z'] },
  wrench: { paths: ['M15 3 C18 2 21 4 21 7 L18 6 L16 8 L17 11 C15 13 13 13 12 12 L5 20 C3 22 1 19 3 17 L11 10 C10 7 11 4 15 3 Z'], circles: [[5, 18, 1, false]] },
  hammer: { paths: ['M4 5 L13 3 L15 7 L11 9 L19 20 L16 22 L8 11 L5 12 Z'] },
  key: { paths: ['M4 15 C1 11 4 7 8 8 C11 9 11 12 10 14 L20 4 L22 6 L20 8 L22 10 L19 13 L17 11 L12 16 C9 19 6 18 4 15 Z'], circles: [[6.5, 12.5, 1.5, false]] },
  pen: { paths: ['M4 20 L7 14 L17 4 L21 8 L11 18 Z', 'M7 14 L11 18', 'M14 7 L18 11', 'M4 20 L9 18'] },
  flag: { paths: ['M5 22 L5 3', 'M6 4 C10 2 13 7 19 4 L19 13 C14 16 10 10 6 13 Z'] },
  plane: { paths: ['M3 13 L21 4 L15 20 L11 14 Z', 'M11 14 L14 11', 'M3 13 L10 10'] },
  plus: { paths: ['M12 4 L12 20', 'M4 12 L20 12'] },
  minus: { paths: ['M4 12 L20 12'] },

  lightning: { fills: ['M13 2 L5 14 L11 14 L9 22 L20 10 L14 10 Z'] },
  triangle: { paths: ['M12 3 L22 21 L2 21 Z'] },
  electricity: { paths: ['M12 2 L22 21 L2 21 Z'], fills: ['M13 6 L8 14 L12 14 L10 19 L17 11 L13 11 Z'] },
  high_temp: { paths: ['M12 2 L22 21 L2 21 Z', 'M10 8 C10 5 14 5 14 8 L14 14 C17 17 15 20 12 20 C9 20 7 17 10 14 Z', 'M12 8 L12 16'], circles: [[12, 17, 1.7, true]] },
  tree: { paths: ['M12 14 L12 22', 'M7 22 L17 22'], circles: [[12, 8, 5, false], [8, 11, 4, false], [16, 11, 4, false]] },
  rose: { paths: ['M12 12 C6 10 7 4 12 6 C15 2 20 6 17 10 C19 14 14 17 12 14 C9 17 5 14 7 11', 'M12 14 L12 22', 'M12 18 C9 16 7 17 7 19 C9 20 11 20 12 18', 'M12 19 C15 17 17 18 17 20'], circles: [[12, 10, 2.5, false]] },
  cactus: { paths: ['M9 20 L9 8 C9 4 15 4 15 8 L15 12 L18 12 L18 8 C18 6 21 6 21 9 L21 14 C21 17 18 18 15 18 L15 22 L9 22 L9 17 C6 17 3 15 3 12 L3 9 C3 7 6 7 6 10 L6 13 L9 13'] },
  arrow_double: { paths: ['M4 12 L20 12', 'M4 12 L8 8', 'M4 12 L8 16', 'M20 12 L16 8', 'M20 12 L16 16'] },
  download: { paths: ['M12 3 L12 16', 'M7 11 L12 16 L17 11', 'M4 19 L4 22 L20 22 L20 19'] },
  upload: { paths: ['M12 18 L12 5', 'M7 10 L12 5 L17 10', 'M4 19 L4 22 L20 22 L20 19'] }
};

function drawPath(context, value, x, y, w, h, paint) {
  const tokens = String(value).match(/[MLCQZ]|-?\d*\.?\d+/g) || [];
  let index = 0;
  let command = '';
  const px = (value) => x + Number(value) * w / 24;
  const py = (value) => y + Number(value) * h / 24;
  context.beginPath();
  while (index < tokens.length) {
    if (/^[MLCQZ]$/.test(tokens[index])) command = tokens[index++];
    if (command === 'M') {
      context.moveTo(px(tokens[index++]), py(tokens[index++]));
      command = 'L';
    } else if (command === 'L') {
      context.lineTo(px(tokens[index++]), py(tokens[index++]));
    } else if (command === 'C') {
      context.bezierCurveTo(px(tokens[index++]), py(tokens[index++]), px(tokens[index++]), py(tokens[index++]), px(tokens[index++]), py(tokens[index++]));
    } else if (command === 'Q') {
      context.quadraticCurveTo(px(tokens[index++]), py(tokens[index++]), px(tokens[index++]), py(tokens[index++]));
    } else if (command === 'Z') {
      context.closePath();
      command = '';
    } else {
      break;
    }
  }
  if (paint === 'fill') context.fill();
  else context.stroke();
}

function drawShangyueMaterialSymbol(context, symbol, x, y, w, h, lineWidthPx) {
  const item = SYMBOLS[symbol];
  if (!item) return false;
  const radiusScale = Math.min(w, h) / 24;
  context.save();
  context.strokeStyle = '#000000';
  context.fillStyle = '#000000';
  context.lineWidth = Math.max(1, Number(lineWidthPx) || 2);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  (item.paths || []).forEach((path) => drawPath(context, path, x, y, w, h, 'stroke'));
  (item.fills || []).forEach((path) => drawPath(context, path, x, y, w, h, 'fill'));
  (item.circles || []).forEach(([cx, cy, radius, filled]) => {
    context.beginPath();
    context.arc(x + cx * w / 24, y + cy * h / 24, radius * radiusScale, 0, Math.PI * 2);
    if (filled) context.fill();
    else context.stroke();
  });
  context.restore();
  return true;
}

module.exports = {
  SHANGYUE_MATERIAL_SYMBOL_IDS: Object.freeze(Object.keys(SYMBOLS)),
  drawShangyueMaterialSymbol
};
