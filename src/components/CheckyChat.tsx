"use client";

import { useEffect, useRef, useState } from "react";

interface QA {
  q: string;
  a: string;
}

const FAQ: QA[] = [
  {
    q: "¿Qué es food2check?",
    a: "Una app pensada para las compras del supermercado de tu hogar: armás listas, las compartís con tu familia y te sugiere qué comprar según lo que se va consumiendo.",
  },
  {
    q: "¿Cómo creo una cuenta?",
    a: "En la pantalla de inicio tocá “Crear una cuenta local” y completá usuario, contraseña y repetir contraseña. El nombre de usuario es único en este navegador.",
  },
  {
    q: "¿Por dónde empiezo?",
    a: "Primero creá un lugar: una flecha te señala el campo “Nuevo lugar…” en el panel lateral. Después, otra flecha te guía para crear tu primera lista de compras. Con eso ya podés invitar a tu familia y agregar productos.",
  },
  {
    q: "¿Qué es un lugar?",
    a: "Tu hogar (o el espacio para el que comprás): agrupa las listas de compras, los productos y los miembros de la familia. Cada lugar tiene su propia configuración de consumo.",
  },
  {
    q: "¿Cómo creo un lugar?",
    a: "En el panel lateral, escribí el nombre en “Nuevo lugar…” y tocá +. Quedás como administrador y podés invitar a otras personas.",
  },
  {
    q: "¿Cómo invito a alguien a mi hogar?",
    a: "En “Miembros” del panel lateral escribí el nombre de usuario de tu familiar y elegí el permiso: Lectura o Escritura. La persona debe tener una cuenta registrada en este navegador.",
  },
  {
    q: "¿Cómo creo una lista de compras?",
    a: "En “Listas de compras” escribí el nombre (y una descripción opcional) y tocá Crear. Necesitás permiso de escritura en el lugar.",
  },
  {
    q: "¿Cómo agrego productos a una lista?",
    a: "Abrí la lista y usá el buscador: se consulta un catálogo de supermercado como referencia y el producto se agrega con imagen, marca y precio sugerido.",
  },
  {
    q: "¿Qué significa el precio sugerido?",
    a: "Es un precio de referencia del catálogo. No es necesariamente el precio del comercio donde vos comprás.",
  },
  {
    q: "¿Cómo funcionan los estados de una lista?",
    a: "Listando → A comprar → Comprando → Listo. Al pasar a “Listo” se actualizan las raciones de cada producto y se registra el plazo de consumo.",
  },
  {
    q: "¿Qué es “Sugerencias de compra”?",
    a: "Son los productos del lugar ordenados por consumo estimado. Las raciones se descuentan solas con el paso del tiempo, así los más urgentes aparecen primero.",
  },
  {
    q: "¿Qué significan las barras de las sugerencias?",
    a: "La barra junto a cada producto muestra qué tan urgente es reponerlo: vacía significa que acabás de comprarlo; a medida que pasa el tiempo y se consumen las raciones, la barra se llena. Cuando está casi llena, es probable que necesites comprarlo pronto.",
  },
  {
    q: "¿Cómo calcula las sugerencias?",
    a: "food2check aprende el ritmo real de consumo: cada vez que una lista pasa a “Listo”, guarda el plazo entre compras (los últimos por producto). Con ese promedio y las raciones que quedan estima cuántos días te duran; por eso cada producto muestra “Quedan ~X días”.",
  },
  {
    q: "¿Qué son las raciones y el refresco?",
    a: "Raciones = unidades que quedan de un producto. Refresco = cada cuántos días se suele reponer. Los editás en “Productos del lugar”; con cada compra el sistema aprende el plazo real.",
  },
  {
    q: "¿Puedo compartir una lista?",
    a: "Sí. Dentro de la lista, en “Invitados”, elegí un miembro del hogar: entra con solo lectura y podés otorgarle permiso de edición.",
  },
  {
    q: "¿Cómo elimino un producto del lugar?",
    a: "En “Productos del lugar” tocá el botón Eliminar del producto. Los items ya cargados en listas conservan su información.",
  },
  {
    q: "¿Cómo cierro sesión?",
    a: "Con el botón “Cerrar sesión” al pie del panel lateral. Para usar otra cuenta, cerrá sesión e ingresá con esas credenciales.",
  },
  {
    q: "¿Dónde se guardan mis datos?",
    a: "Los datos se guardan en la base SQLite del servidor, así que podés compartir lugares y listas con tu familia aunque usen otro dispositivo. El navegador solo guarda una copia local para trabajar rápido.",
  },
];

interface Msg {
  from: "checky" | "user";
  text: string;
}

export function CheckyChat() {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      from: "checky",
      text: "¡Hola! Soy Checky, tu asistente. Elegí una pregunta y te cuento cómo funciona food2check.",
    },
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs]);

  function ask(qa: QA) {
    setMsgs((m) => [
      ...m,
      { from: "user", text: qa.q },
      { from: "checky", text: qa.a },
    ]);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[34rem] w-96 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <header className="flex items-center gap-2 bg-brand px-3 py-2 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/checky.jpg"
              alt="Checky"
              className="h-10 w-10 rounded-full border-2 border-white object-cover"
            />
            <div className="flex-1">
              <p className="font-brand text-sm">Checky</p>
              <p className="text-[10px] text-white/80">
                Asistente de food2check
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              className="rounded px-1.5 text-white/90 hover:bg-white/20"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                    m.from === "user"
                      ? "bg-brand text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>

          <div className="max-h-40 space-y-1 overflow-y-auto border-t border-gray-200 p-2">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Preguntas frecuentes
            </p>
            {FAQ.map((qa) => (
              <button
                key={qa.q}
                type="button"
                className="block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-xs text-gray-700 hover:border-brand hover:text-brand"
                onClick={() => ask(qa)}
              >
                {qa.q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="group relative">
        {!open && (
          <div className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="relative rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-md">
              ¿Te puedo ayudar en algo?
              <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-r border-gray-200 bg-white" />
            </span>
          </div>
        )}
        <button
          type="button"
          aria-label={open ? "Cerrar ayuda" : "Abrir ayuda"}
          className="h-24 w-24 overflow-hidden rounded-full border-4 border-brand bg-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-brand/30"
          onClick={() => setOpen((o) => !o)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/checky.jpg"
            alt="Checky"
            className="h-full w-full object-cover"
          />
        </button>
      </div>
    </div>
  );
}
