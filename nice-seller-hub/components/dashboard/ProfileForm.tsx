"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { saveProfile, type ActionState } from "@/app/dashboard/actions";
import type { Seller } from "@/db/schema";
import { displayPhone } from "@/lib/phone";
import { Button, ErrorNote, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ShareSheet } from "@/components/store/ShareSheet";

/**
 * El perfil publico. El enlace de la tienda no se edita aqui a proposito:
 * cambiarlo rompe todos los QR ya impresos y todos los enlaces que la
 * distribuidora ya compartio. Si alguna vez necesita cambiarlo, tendra que
 * ser un flujo aparte que avise de eso.
 */
export function ProfileForm({ seller, email }: { seller: Seller; email: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProfile, {
    ok: false,
  });
  const [share, setShare] = useState(false);

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      router.refresh();
    }
  }, [state, router, toast]);

  return (
    <>
      <div className="mb-6 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <p className="text-[12px] uppercase tracking-[0.14em] text-mute">Tu enlace</p>
        <p className="mt-1.5 text-[15px] font-medium">/{seller.slug}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-mute">
          No se puede cambiar: los códigos QR que ya imprimiste y los enlaces que compartiste
          dejarían de funcionar.
        </p>
        <button
          onClick={() => setShare(true)}
          className="mt-3 h-9 rounded-lg border border-line-strong px-3.5 text-[13px] font-medium transition-colors hover:border-ink/25"
        >
          Compartir mi tienda
        </button>
      </div>

      <form action={action} className="max-w-lg space-y-5">
        <Field label="Nombre de tu tienda">
          <Input name="businessName" defaultValue={seller.businessName} required maxLength={80} />
        </Field>

        <Field
          label="WhatsApp"
          hint={`Ahí llegan los pedidos. Guardado como ${displayPhone(seller.whatsapp)}.`}
        >
          <Input
            name="whatsapp"
            defaultValue={seller.whatsapp}
            inputMode="tel"
            required
            maxLength={20}
          />
        </Field>

        <Field label="Descripción" hint="Una o dos líneas. Es lo primero que se lee.">
          <Textarea
            name="description"
            defaultValue={seller.description ?? ""}
            rows={3}
            maxLength={400}
            placeholder="Joyería NICE disponible para entrega inmediata."
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad">
            <Input name="city" defaultValue={seller.city ?? ""} maxLength={80} />
          </Field>
          <Field label="Estado">
            <Input name="state" defaultValue={seller.state ?? ""} maxLength={80} />
          </Field>
        </div>

        <Field label="Tu foto" hint="Pega el enlace de una imagen cuadrada.">
          <Input
            name="profileImage"
            defaultValue={seller.profileImage ?? ""}
            placeholder="https://…"
            inputMode="url"
            maxLength={500}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Instagram">
            <Input
              name="instagram"
              defaultValue={seller.instagram ?? ""}
              placeholder="@tuusuario"
              maxLength={60}
            />
          </Field>
          <Field label="Facebook">
            <Input
              name="facebook"
              defaultValue={seller.facebook ?? ""}
              placeholder="tu página"
              maxLength={120}
            />
          </Field>
        </div>

        <Field label="Horario">
          <Input
            name="schedule"
            defaultValue={seller.schedule ?? ""}
            placeholder="Lunes a sábado, 10 a 7"
            maxLength={160}
          />
        </Field>

        <Field label="Cómo entregas">
          <Input
            name="deliveryMethods"
            defaultValue={seller.deliveryMethods ?? ""}
            placeholder="Entrega en persona o envío por paquetería"
            maxLength={200}
          />
        </Field>

        <Field label="Cómo te pagan">
          <Input
            name="paymentMethods"
            defaultValue={seller.paymentMethods ?? ""}
            placeholder="Efectivo, transferencia"
            maxLength={200}
          />
        </Field>

        {state.error && <ErrorNote>{state.error}</ErrorNote>}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>

      <div className="mt-8 max-w-lg border-t border-line pt-6">
        <p className="text-[13px] text-mute">
          Sesión iniciada como <span className="font-medium text-ink">{email}</span>
        </p>
        <form action="/api/auth/logout" method="post" className="mt-3">
          <button
            type="submit"
            className="h-10 rounded-xl border border-line-strong px-4 text-[14px] font-medium text-ink-soft transition-colors hover:border-ink/25"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      {share && (
        <ShareSheet
          slug={seller.slug}
          businessName={seller.businessName}
          onClose={() => setShare(false)}
        />
      )}
    </>
  );
}
