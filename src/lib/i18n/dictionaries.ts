export const locales = ["ru", "tj"] as const;
export type Locale = (typeof locales)[number];

export const dictionaries = {
  ru: {
    appName: "RealEstate CRM",
    nav: {
      dashboard: "Дашборд",
      objects: "Объекты",
    },
    dashboard: {
      title: "Дашборд",
      totalObjects: "Всего объектов",
      available: "Свободно",
      sold: "Продано",
      inProgress: "В работе",
    },
    objects: {
      title: "Объекты",
      newObject: "Новый объект",
      search: "Поиск по названию или адресу",
      empty: "Объектов пока нет",
      table: {
        name: "Название",
        address: "Адрес",
        type: "Тип",
        status: "Статус",
        area: "Площадь",
        price: "Цена",
      },
      filters: {
        allTypes: "Все типы",
        allStatuses: "Все статусы",
      },
      form: {
        name: "Название",
        address: "Адрес",
        type: "Тип",
        status: "Статус",
        area: "Площадь (м²)",
        price: "Цена (сомони)",
        description: "Описание",
        save: "Сохранить",
        cancel: "Отмена",
        delete: "Удалить",
        confirmDelete: "Удалить этот объект?",
        creating: "Создание...",
        saving: "Сохранение...",
      },
      types: {
        apartment: "Квартира",
        house: "Дом",
        commercial: "Коммерческая",
        land: "Участок",
        construction_site: "Стройобъект",
      },
      statuses: {
        available: "Свободно",
        reserved: "Забронировано",
        sold: "Продано",
        rented: "Сдано в аренду",
        in_progress: "В работе",
      },
      backToList: "К списку объектов",
      notFound: "Объект не найден",
    },
    common: {
      loading: "Загрузка...",
      error: "Произошла ошибка",
      supabaseNotConfigured:
        "Supabase не настроен. Добавьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local",
    },
  },
  tj: {
    appName: "RealEstate CRM",
    nav: {
      dashboard: "Дашборд",
      objects: "Объектҳо",
    },
    dashboard: {
      title: "Дашборд",
      totalObjects: "Ҳамаи объектҳо",
      available: "Озод",
      sold: "Фурӯхта шуд",
      inProgress: "Дар кор",
    },
    objects: {
      title: "Объектҳо",
      newObject: "Объекти нав",
      search: "Ҷустуҷӯ аз рӯи ном ё суроға",
      empty: "Ҳоло объект нест",
      table: {
        name: "Ном",
        address: "Суроға",
        type: "Навъ",
        status: "Ҳолат",
        area: "Масоҳат",
        price: "Нарх",
      },
      filters: {
        allTypes: "Ҳамаи навъҳо",
        allStatuses: "Ҳамаи ҳолатҳо",
      },
      form: {
        name: "Ном",
        address: "Суроға",
        type: "Навъ",
        status: "Ҳолат",
        area: "Масоҳат (м²)",
        price: "Нарх (сомонӣ)",
        description: "Тавсиф",
        save: "Захира кардан",
        cancel: "Бекор кардан",
        delete: "Нест кардан",
        confirmDelete: "Ин объектро нест кунам?",
        creating: "Сохта истодааст...",
        saving: "Захира истодааст...",
      },
      types: {
        apartment: "Хонаи истиқоматӣ",
        house: "Хона",
        commercial: "Тиҷоратӣ",
        land: "Замин",
        construction_site: "Объекти сохтмонӣ",
      },
      statuses: {
        available: "Озод",
        reserved: "Брон карда шуд",
        sold: "Фурӯхта шуд",
        rented: "Ба иҷора дода шуд",
        in_progress: "Дар кор",
      },
      backToList: "Ба рӯйхати объектҳо",
      notFound: "Объект ёфт нашуд",
    },
    common: {
      loading: "Боркунӣ...",
      error: "Хатогӣ рух дод",
      supabaseNotConfigured:
        "Supabase танзим нашудааст. NEXT_PUBLIC_SUPABASE_URL ва NEXT_PUBLIC_SUPABASE_ANON_KEY-ро ба .env.local илова кунед",
    },
  },
} satisfies Record<Locale, unknown>;

export type Dictionary = typeof dictionaries.ru;
