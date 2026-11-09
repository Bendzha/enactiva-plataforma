/**
 * El panel derecho del login: lo que la plataforma hace, en una imagen.
 *
 * Es la ilustración que reemplaza la "imagen de universidad corporativa" que la clienta había
 * pedido antes (2026-10-29). Va con la paleta aprobada —azul marino y ámbar— y no con los
 * violetas del boceto, para que no haya un salto de identidad al apretar Ingresar.
 *
 * Los números de los tokens son de adorno y a propósito pequeños: el modelo real reparte 1, 2 o
 * 3, y una portada que prometiera decenas mentiría sobre la primera pantalla de adentro.
 */
export function Ilustracion() {
  return (
    <aside
      className="relative hidden overflow-hidden bg-marca text-white lg:grid lg:place-items-center"
      aria-hidden="true"
    >
      <span className="absolute -top-24 -right-16 size-72 rounded-full bg-white/10" />
      <span className="absolute bottom-[-6rem] left-[-4rem] size-80 rounded-full bg-white/5" />
      <span className="absolute top-1/3 right-12 size-4 rotate-45 rounded-sm bg-acento/70" />

      <div className="relative w-full max-w-md px-10 py-16">
        <p className="mb-10 inline-block rounded-full border border-white/25 px-4 py-1.5 text-xs font-semibold">
          Match corporativo · conocimiento entre colegas
        </p>

        <div className="space-y-4">
          <Tarjeta iniciales="AM" titulo="Ana enseña" tema="Análisis de datos" etiqueta="Enseña" />

          <div className="flex items-center gap-3 pl-6">
            <span className="rounded-full border-2 border-acento bg-marca-oscuro px-4 py-2 text-sm font-extrabold">
              ¡Match!
            </span>
            <span className="rounded-full bg-acento px-3 py-1 text-xs font-bold text-texto">
              +2 tokens
            </span>
          </div>

          <Tarjeta
            iniciales="LP"
            titulo="Luis quiere aprender"
            tema="Análisis de datos"
            etiqueta="Aprende"
          />
        </div>

        <h2 className="mt-12 text-3xl font-extrabold tracking-tight">
          Más conexión, mejor equipo.
        </h2>
        <p className="mt-2 text-sm text-white/80">
          Crea tu match por actitud, conocimientos o habilidades y conecta con colegas de tu
          empresa. Cada taller suma tokens.
        </p>
      </div>
    </aside>
  );
}

function Tarjeta({
  iniciales,
  titulo,
  tema,
  etiqueta,
}: {
  iniciales: string;
  titulo: string;
  tema: string;
  etiqueta: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-4 text-texto shadow-lg">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-marca text-sm font-bold text-white">
        {iniciales}
      </span>
      <span className="grow">
        <span className="block text-xs font-bold tracking-wide text-marca uppercase">
          {etiqueta}
        </span>
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-xs text-texto-suave">{tema}</span>
      </span>
    </div>
  );
}
