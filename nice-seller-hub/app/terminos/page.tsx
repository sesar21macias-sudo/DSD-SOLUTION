import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { ContactBlock, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: `Reglas de uso de ${LEGAL.platform}.`,
};

/**
 * Términos del servicio.
 *
 * Lo importante que tienen que dejar claro, porque es donde nacen los
 * malentendidos caros: la plataforma no vende nada. Vende cada distribuidora,
 * y el trato es entre ella y su clienta.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones">
      <h2>Qué es esto</h2>
      <p>
        {LEGAL.platform} es una herramienta para que distribuidoras independientes muestren su
        inventario y reciban pedidos por WhatsApp.
      </p>
      <p>
        <strong>La plataforma no vende joyería.</strong> Cada distribuidora vende sus propias
        piezas, pone sus propios precios y acuerda directamente con su clienta la entrega y el
        pago. El contrato de compraventa es entre ellas dos; nosotros solo damos el sistema.
      </p>

      <h2>Sobre la marca NICE</h2>
      <p>
        NICE es una marca de joyería que no nos pertenece y con la que no tenemos relación
        comercial ni representación. Las distribuidoras que usan esta herramienta venden producto
        que compran por su cuenta, y los nombres, códigos e imágenes de las piezas pertenecen a su
        titular. {LEGAL.platform} es únicamente el software con el que ellas administran su
        negocio.
      </p>

      <h2>Si eres distribuidora</h2>
      <ul>
        <li>Eres responsable de que tu inventario, tus precios y tus fotos sean verdaderos.</li>
        <li>
          Eres responsable de cumplirle a tus clientas: entregar lo que ofreciste, respetar los
          puntos y los cupones que tú misma configuraste, y devolver los abonos cuando
          corresponda.
        </li>
        <li>
          Eres responsable de los datos de tus clientas. Úsalos para atenderlas, no para nada más.
        </li>
        <li>Cuida tu contraseña. Lo que se haga desde tu cuenta cuenta como tuyo.</li>
        <li>
          Puedes dejar de usar el servicio cuando quieras y pedir que borremos tu información.
        </li>
      </ul>

      <h2>Si eres clienta</h2>
      <ul>
        <li>
          Hacer un pedido aquí es una <strong>solicitud</strong>, no una compra cerrada. Tu
          distribuidora te confirma disponibilidad, entrega y forma de pago por WhatsApp.
        </li>
        <li>
          Los precios y las existencias los pone cada distribuidora y pueden cambiar entre que
          armas tu pedido y ella te contesta.
        </li>
        <li>
          Los puntos y cupones del club los otorga y honra tu distribuidora, no la plataforma. No
          tienen valor en dinero ni se pueden cambiar por efectivo.
        </li>
        <li>
          Cualquier aclaración sobre tu compra —un cambio, una devolución, un abono— va con tu
          distribuidora.
        </li>
      </ul>

      <h2>Lo que no está permitido</h2>
      <ul>
        <li>Publicar productos falsos, robados o que no tengas.</li>
        <li>Usar los datos de las clientas para algo distinto de atenderlas.</li>
        <li>Intentar entrar a la información de otra distribuidora.</li>
        <li>Automatizar peticiones para saturar el servicio.</li>
      </ul>
      <p>
        Una cuenta que haga cualquiera de estas cosas se suspende. Suspenderla apaga su tienda
        pública; su información no se borra.
      </p>

      <h2>Disponibilidad</h2>
      <p>
        Hacemos lo razonable por mantener el servicio en pie, pero se ofrece &ldquo;tal como
        está&rdquo;: puede haber interrupciones, mantenimiento o errores. No respondemos por
        ventas no concretadas, ni por acuerdos entre una distribuidora y su clienta.
      </p>

      <h2>Cambios</h2>
      <p>
        Estos términos pueden cambiar. La versión vigente es la que está publicada aquí, con su
        fecha. Seguir usando el servicio después de un cambio significa que lo aceptas.
      </p>

      <h2>Ley aplicable</h2>
      <p>
        Se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las
        partes se someten a los tribunales competentes de {LEGAL.address}.
      </p>

      <h2>Contacto</h2>
      <ContactBlock />
      <p>
        Cómo tratamos los datos personales está en el{" "}
        <Link href="/privacidad" className="underline underline-offset-2">
          aviso de privacidad
        </Link>
        .
      </p>
    </LegalPage>
  );
}
