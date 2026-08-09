// Quote of the day for the login screen.
//
// Kept as a curated local list rather than pulled from a quotes API on
// purpose. A public quote endpoint returns English, goes down without warning,
// and occasionally serves something crude or political -- none of which you
// want greeting staff on a company login screen, unreviewed, every morning.
// Twenty-odd lines chosen once are a better trade than a live feed nobody
// vets.
//
// Every quote exists in both languages so the screen never mixes them, and
// they lean toward building, craft and patience rather than generic
// hustle-culture slogans.

export type Quote = {
  ru: string;
  tj: string;
  /** Attribution in both languages -- a Tajik quote credited in Russian reads
      like a translation someone forgot to finish. */
  author: { ru: string; tj: string };
};

export const QUOTES: Quote[] = [
  {
    ru: "Мы строим дома, а потом дома строят нас.",
    tj: "Мо хонаҳоро месозем, сипас хонаҳо моро месозанд.",
    author: { ru: "Уинстон Черчилль", tj: "Уинстон Черчилл" },
  },
  {
    ru: "Терпение — дерево с горькими корнями, но очень сладкими плодами.",
    tj: "Сабр дарахтест, ки решааш талх, вале мевааш ширин аст.",
    author: { ru: "Персидская пословица", tj: "Зарбулмасали форсӣ" },
  },
  {
    ru: "Дом — это не место. Это чувство.",
    tj: "Хона ҷой нест. Хона ҳиссиёт аст.",
    author: { ru: "Сесилия Ахерн", tj: "Сесилия Аҳерн" },
  },
  {
    ru: "Качество — это не действие, а привычка.",
    tj: "Сифат амал нест, балки одат аст.",
    author: { ru: "Аристотель", tj: "Арасту" },
  },
  {
    ru: "Кто хочет — ищет возможности, кто не хочет — ищет причины.",
    tj: "Он ки мехоҳад — имконият меҷӯяд, он ки намехоҳад — баҳона.",
    author: { ru: "Сократ", tj: "Суқрот" },
  },
  {
    ru: "Доверие строится годами, а теряется за минуту.",
    tj: "Эътимод солҳо сохта мешавад ва дар як дақиқа аз даст меравад.",
    author: { ru: "Народная мудрость", tj: "Ҳикмати халқӣ" },
  },
  {
    ru: "Лучшее время посадить дерево было двадцать лет назад. Второе лучшее — сегодня.",
    tj: "Беҳтарин вақти шинондани дарахт бист сол пеш буд. Дуюмин беҳтарин — имрӯз.",
    author: { ru: "Китайская пословица", tj: "Зарбулмасали чинӣ" },
  },
  {
    ru: "Работа, сделанная с душой, не нуждается в рекламе.",
    tj: "Кори бо дил кардашуда ба реклама эҳтиёҷ надорад.",
    author: { ru: "Народная мудрость", tj: "Ҳикмати халқӣ" },
  },
  {
    ru: "Архитектура — это застывшая музыка.",
    tj: "Меъморӣ мусиқии яхбастааст.",
    author: { ru: "Иоганн Вольфганг Гёте", tj: "Иоганн Волфганг Гёте" },
  },
  {
    ru: "Успех — это сумма небольших усилий, повторяемых изо дня в день.",
    tj: "Муваффақият ҷамъи кӯшишҳои хурдест, ки ҳар рӯз такрор мешаванд.",
    author: { ru: "Роберт Кольер", tj: "Роберт Колйер" },
  },
  {
    ru: "Не бойся медленно идти, бойся стоять на месте.",
    tj: "Аз оҳиста рафтан натарс, аз дар ҷой истодан битарс.",
    author: { ru: "Китайская пословица", tj: "Зарбулмасали чинӣ" },
  },
  {
    ru: "Обещай меньше, делай больше.",
    tj: "Камтар ваъда деҳ, бештар иҷро кун.",
    author: { ru: "Народная мудрость", tj: "Ҳикмати халқӣ" },
  },
  {
    ru: "Камень к камню — и вот стена.",
    tj: "Санг ба санг — девор мешавад.",
    author: { ru: "Таджикская пословица", tj: "Зарбулмасали тоҷикӣ" },
  },
  {
    ru: "Тот, кто хорошо начал, сделал половину дела.",
    tj: "Он ки хуб оғоз кард, нисфи корро анҷом дод.",
    author: { ru: "Гораций", tj: "Гораций" },
  },
  {
    ru: "Честность — самая дорогая валюта. Её нельзя занять.",
    tj: "Ростқавлӣ гаронбаҳотарин асъор аст. Онро қарз гирифтан мумкин нест.",
    author: { ru: "Народная мудрость", tj: "Ҳикмати халқӣ" },
  },
  {
    ru: "Дисциплина — это мост между целью и результатом.",
    tj: "Интизом пул миёни ҳадаф ва натиҷа аст.",
    author: { ru: "Джим Рон", tj: "Ҷим Рон" },
  },
  {
    ru: "Считай не дни, а то, что сделано за день.",
    tj: "Рӯзҳоро не, балки кори дар рӯз кардаатро ҳисоб кун.",
    author: { ru: "Народная мудрость", tj: "Ҳикмати халқӣ" },
  },
  {
    ru: "Дом строится не из кирпича, а из терпения.",
    tj: "Хона аз хишт не, аз сабр сохта мешавад.",
    author: { ru: "Таджикская пословица", tj: "Зарбулмасали тоҷикӣ" },
  },
  {
    ru: "Клиент запоминает не цену, а отношение.",
    tj: "Мизоҷ на нархро, балки муносибатро дар ёд нигоҳ медорад.",
    author: { ru: "Народная мудрость", tj: "Ҳикмати халқӣ" },
  },
  {
    ru: "Порядок в делах — половина спокойствия.",
    tj: "Тартиб дар корҳо нисфи оромӣ аст.",
    author: { ru: "Народная мудрость", tj: "Ҳикмати халқӣ" },
  },
  {
    ru: "Сначала сделай необходимое, потом возможное — и вдруг ты делаешь невозможное.",
    tj: "Аввал зарурро кун, баъд имконпазирро — ва ногаҳон ғайриимконро мекунӣ.",
    author: { ru: "Франциск Ассизский", tj: "Франсиски Ассизӣ" },
  },
  {
    ru: "Слово, данное клиенту, дороже подписи на бумаге.",
    tj: "Сухани ба мизоҷ додашуда аз имзои рӯи коғаз гаронтар аст.",
    author: { ru: "Народная мудрость", tj: "Ҳикмати халқӣ" },
  },
];

/**
 * The same quote for the whole day, changing at local midnight.
 *
 * Keyed on the LOCAL calendar date rather than Math.random() or Date.now():
 * random would hand a different quote to every render (and a different one to
 * the server than to the browser, which React reports as a hydration
 * mismatch), and it is meant to be "quote of the day", not "quote of the
 * refresh".
 */
export function quoteOfTheDay(date = new Date()): Quote {
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
  return QUOTES[((dayNumber % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
