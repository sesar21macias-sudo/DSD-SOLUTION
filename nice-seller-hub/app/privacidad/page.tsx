import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { ContactBlock, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: `Cómo ${LEGAL.platform} trata los datos personales de distribuidoras y de sus clientas.`,
};

/**
 * Aviso de privacidad.
 *
 * Está escrito para que lo entienda quien lo va a leer —una distribuidora o una
 * clienta que va a dar su teléfono— y no para que suene a documento. Cumple lo
 * que la LFPDPPP pide de un aviso: quién responde, qué datos, para qué, con
 * quién se comparten, cómo ejercer derechos ARCO y cómo revocar el consentimiento.
 *
 * No sustituye la revisión de un abogado. Es un punto de partida honesto y
 * completo, no una opinión legal.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Aviso de privacidad">
      <h2>Quién es responsable de tus datos</h2>
      <ContactBlock />

      <h2>Qué datos guardamos</h2>
      <p>Depende de quién seas.</p>

      <h3>Si eres distribuidora</h3>
      <ul>
        <li>Tu nombre, tu correo y tu teléfono de WhatsApp.</li>
        <li>Los datos de tu tienda: nombre, ciudad, descripción, horarios, redes.</li>
        <li>Tu inventario, tus precios, tus costos, tus ventas y tus cobros.</li>
        <li>
          Tu contraseña <strong>nunca</strong> se guarda. Guardamos un resultado matemático del
          que no se puede regresar a la contraseña original.
        </li>
      </ul>

      <h3>Si eres clienta de una distribuidora</h3>
      <ul>
        <li>Tu nombre y tu teléfono, si los escribes al hacer un pedido o al entrar al club.</li>
        <li>Tus pedidos, tus compras y tus puntos con esa distribuidora.</li>
        <li>Tu correo, solo si tú lo das.</li>
      </ul>
      <p>
        Puedes comprar sin dejar ningún dato: el pedido se manda por WhatsApp igual. Los datos
        sirven para que tu distribuidora sepa quién eres y para llevarte tus puntos.
      </p>

      <h3>De todas las personas que abren el sitio</h3>
      <ul>
        <li>
          Un identificador aleatorio en una cookie para saber qué piezas apartaste mientras
          compras. No dice quién eres.
        </li>
        <li>
          Una cookie de sesión si inicias sesión, para no pedirte la contraseña en cada pantalla.
        </li>
        <li>
          Tu dirección IP de forma temporal, únicamente para frenar abusos (que alguien mande
          cientos de pedidos falsos).
        </li>
      </ul>
      <p>
        No usamos cookies de publicidad ni de rastreo, y no hay analítica de terceros siguiéndote
        entre sitios.
      </p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Mostrar la tienda de tu distribuidora y armar tu pedido.</li>
        <li>Generar el mensaje de WhatsApp con tu pedido.</li>
        <li>Llevar el inventario, las ventas, los abonos y los puntos de cada distribuidora.</li>
        <li>Frenar abusos y mantener el servicio en pie.</li>
      </ul>
      <p>
        No vendemos tus datos, no los rentamos y no los usamos para mandarte publicidad de nadie
        más.
      </p>

      <h2>Quién puede verlos</h2>
      <p>
        <strong>Cada distribuidora ve únicamente a sus propias clientas.</strong> Ninguna puede ver
        el inventario, las ventas ni la cartera de otra: el sistema está construido para que eso
        sea imposible, no solo para que esté prohibido.
      </p>
      <p>
        Quien administra la plataforma puede ver las cuentas de las distribuidoras y las cifras
        generales del servicio, para poder operarlo y darles soporte.
      </p>
      <p>Compartimos datos con terceros solo en estos casos:</p>
      <ul>
        <li>
          <strong>Cloudflare</strong>, que aloja el sitio y la base de datos.
        </li>
        <li>
          <strong>Anthropic</strong>, cuando una distribuidora fotografía su ticket de mercancía:
          esa imagen se manda para leer los códigos. La foto no se guarda en ningún lado.
        </li>
        <li>
          <strong>WhatsApp (Meta)</strong>, cuando presionas el botón para mandar tu pedido. Ahí ya
          estás en su aplicación y aplican sus propias reglas.
        </li>
        <li>Cuando una autoridad competente lo requiera conforme a la ley.</li>
      </ul>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras la cuenta esté activa y por el tiempo que la ley obligue a conservar registros de
        operaciones. Si pides que borremos tus datos, se borran salvo lo que estemos obligados a
        conservar.
      </p>

      <h2>Tus derechos (ARCO)</h2>
      <p>
        Puedes pedirnos en cualquier momento <strong>acceder</strong> a los datos que tenemos de ti,{" "}
        <strong>rectificarlos</strong> si están mal, <strong>cancelarlos</strong> o{" "}
        <strong>oponerte</strong> a que los usemos. También puedes revocar tu consentimiento.
      </p>
      <p>
        Escribe al correo de contacto de arriba diciendo qué quieres y desde qué teléfono o correo
        estás registrada. Te contestamos en un plazo máximo de 20 días hábiles.
      </p>
      <p>
        Si crees que no atendimos bien tu solicitud, puedes acudir al INAI ({" "}
        <a
          href="https://home.inai.org.mx"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          home.inai.org.mx
        </a>{" "}
        ).
      </p>

      <h2>Seguridad</h2>
      <p>
        El sitio viaja cifrado, las contraseñas se guardan derivadas y con sal, y las sesiones van
        firmadas. Ningún sistema es infalible: si llegara a ocurrir una vulneración que afecte tus
        datos, te lo diremos.
      </p>

      <h2>Menores de edad</h2>
      <p>
        El servicio está pensado para personas mayores de edad. No recabamos datos de menores a
        sabiendas.
      </p>

      <h2>Cambios a este aviso</h2>
      <p>
        Si cambia, se publica aquí con su nueva fecha. Si el cambio es importante, se avisa dentro
        del panel.
      </p>
    </LegalPage>
  );
}
