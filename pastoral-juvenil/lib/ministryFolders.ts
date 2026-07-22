export type Ministry = {
  id: string;
  slug: string;
  nombre: string;
  coordinador: string;
  subcoordinador: string;
  driveFolderId: string;
  descripcion: string;
  accentVar: string;
};

export const DRIVE_ROOT_FOLDER_ID = "1-_qlQ8vjQ801ijLFKOW2slREYnknTSPb";

export const DRIVE_FORMACION_FOLDER_ID = "18bCYbLxOlBb6a3VtqDc8BAG7NNly84Dc";
export const DRIVE_CONFIRMACIONES_FOLDER_ID = "1nEYeZqSHFKc26vGnvfZ-MOXJyp0POUeN";
export const DRIVE_MINISTERIOS_FOLDER_ID = "1256ZZvnh1K5ChlCOx8BrcTRQj1u9x_rm";

export const MINISTRIES: Ministry[] = [
  {
    id: "coordinacion-general",
    slug: "coordinacion-general",
    nombre: "Coordinación General",
    coordinador: "Karen",
    subcoordinador: "Sesar y Naty",
    driveFolderId: "1n4kk-_Yd7G23-EjMPqzXgwbn1bbPWD0b",
    descripcion: "Dirige y da seguimiento a los ocho ministerios de la Pastoral Juvenil.",
    accentVar: "--indigo",
  },
  {
    id: "pastores",
    slug: "pastores",
    nombre: "Pastores",
    coordinador: "Mafe",
    subcoordinador: "Eduardo",
    driveFolderId: "1JIk9nOsLYaSNedK7deoRm5vo6mmAfVeY",
    descripcion: "Acompañamiento y cuidado personal de cada integrante del grupo.",
    accentVar: "--logo-azul",
  },
  {
    id: "tesoreria",
    slug: "tesoreria",
    nombre: "Tesorería",
    coordinador: "Luis Diego",
    subcoordinador: "Dana",
    driveFolderId: "1ZRj9oki6THkqxatec_UAxQPGdfmB6_Iq",
    descripcion: "Administra fondos, cuotas y presupuestos de las actividades.",
    accentVar: "--oro",
  },
  {
    id: "espiritualidad",
    slug: "espiritualidad",
    nombre: "Espiritualidad",
    coordinador: "Andy",
    subcoordinador: "Luz Ama",
    driveFolderId: "1PmgcGRfV2UkJGad6XEa65Kyhk0hWBtcM",
    descripcion: "Prepara oraciones, retiros y momentos de formación en la fe.",
    accentVar: "--terracota",
  },
  {
    id: "mercadotecnia",
    slug: "mercadotecnia",
    nombre: "Mercadotecnia",
    coordinador: "Amy",
    subcoordinador: "Ale",
    driveFolderId: "1OZhO-cdSrZMQ8qJ1GT4sZ3zpmABxhfvq",
    descripcion: "Difusión, diseño gráfico y convocatoria de cada evento.",
    accentVar: "--logo-magenta",
  },
  {
    id: "caridad",
    slug: "caridad",
    nombre: "Caridad",
    coordinador: "Pato",
    subcoordinador: "Sofi N",
    driveFolderId: "1TLnns4hIhZpTu0CwbjJPEpL5wwLE-oeI",
    descripcion: "Organiza labor social y apoyo a quienes más lo necesitan.",
    accentVar: "--logo-rojo",
  },
  {
    id: "alabanzas",
    slug: "alabanzas",
    nombre: "Alabanzas",
    coordinador: "Alemán",
    subcoordinador: "Pala",
    driveFolderId: "1bncOej9DbHZcA-N_ey61ngxhfHFPwJ3d",
    descripcion: "Música y ambientación para misas, retiros y encuentros.",
    accentVar: "--logo-naranja",
  },
  {
    id: "predicadores",
    slug: "predicadores",
    nombre: "Predicadores",
    coordinador: "Isa",
    subcoordinador: "Sofi S",
    driveFolderId: "1wvfxT7kEVyeYIhghQ5Rx2agJ6zfllPND",
    descripcion: "Prepara y comparte la Palabra en las sesiones formativas.",
    accentVar: "--logo-amarillo",
  },
  {
    id: "art-attack",
    slug: "art-attack",
    nombre: "Art-Attack",
    coordinador: "Carlos",
    subcoordinador: "Vane",
    driveFolderId: "1WrA_HapwphweaRac4W4V4SYMc8-n_ftx",
    descripcion: "Escenografía, manualidades y ambientación creativa.",
    accentVar: "--indigo",
  },
];

export function getMinistryBySlug(slug: string): Ministry | undefined {
  return MINISTRIES.find((m) => m.slug === slug);
}
