/**
 * Los datos del responsable, para el aviso de privacidad y los términos.
 *
 * Viven en un solo archivo porque la ley pide que sean exactos y porque cuando
 * cambien —un domicilio, un correo de contacto— tienen que cambiar en los dos
 * documentos a la vez, no en uno solo.
 *
 * Si `contactEmail` queda vacío, las dos páginas avisan que el documento está
 * incompleto en lugar de fingir que está listo: un aviso de privacidad sin a
 * quién reclamarle no cumple nada.
 */
export const LEGAL = {
  /** Como se llama la plataforma. */
  platform: "DSD Seller Hub",

  /**
   * Quién responde legalmente por los datos. Persona física o moral, con el
   * nombre completo tal como está registrada.
   */
  responsible: "DSD AI Solutions",

  /**
   * Correo al que una persona puede escribir para saber qué datos tienes de
   * ella, corregirlos o pedir que los borres. La LFPDPPP lo exige y tiene que
   * ser un buzón que alguien lea de verdad.
   */
  contactEmail: "sesar21macias@gmail.com",

  /** WhatsApp de contacto, opcional. Solo dígitos con lada. */
  contactWhatsapp: "",

  /**
   * Domicilio del responsable. La ley lo pide; si operas sin domicilio fiscal
   * publicable, al menos ciudad y estado.
   */
  address: "Ciudad Juárez, Chihuahua, México",

  /** Última revisión de los documentos. */
  updatedAt: "7 de septiembre de 2026",
} as const;

/** Si falta lo indispensable, las páginas lo dicen en vez de aparentar. */
export function legalIsComplete(): boolean {
  return LEGAL.contactEmail.trim().length > 0;
}
