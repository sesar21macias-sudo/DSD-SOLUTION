export type MockTask = {
  id: string;
  texto: string;
  hecha: boolean;
};

export const MOCK_TASKS_SEED: Record<string, MockTask[]> = {
  "coordinacion-general": [
    { id: "t1", texto: "Enviar agenda de la junta general", hecha: false },
    { id: "t2", texto: "Confirmar asistencia de los 8 coordinadores", hecha: true },
  ],
  pastores: [
    { id: "t1", texto: "Llamar a los integrantes que faltaron la semana pasada", hecha: false },
  ],
  tesoreria: [
    { id: "t1", texto: "Actualizar hoja de cuotas de julio", hecha: false },
    { id: "t2", texto: "Guardar recibos del retiro", hecha: false },
  ],
  espiritualidad: [
    { id: "t1", texto: "Preparar la oración de apertura", hecha: true },
    { id: "t2", texto: "Reservar la casa de retiros", hecha: true },
  ],
  mercadotecnia: [
    { id: "t1", texto: "Diseñar el post de la colecta de despensas", hecha: false },
  ],
  caridad: [
    { id: "t1", texto: "Contactar a la familia beneficiaria", hecha: false },
    { id: "t2", texto: "Organizar voluntarios para el sábado", hecha: false },
  ],
  alabanzas: [
    { id: "t1", texto: "Definir repertorio del ensayo", hecha: true },
  ],
  predicadores: [
    { id: "t1", texto: "Preparar reflexión sobre el evangelio del domingo", hecha: false },
  ],
  "art-attack": [
    { id: "t1", texto: "Comprar material para la escenografía", hecha: false },
  ],
};
