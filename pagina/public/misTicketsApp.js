/**
 * Ventana "Mis tickets" (cliente): lista, detalle, encuesta, acta y trazabilidad.
 */
document.addEventListener("DOMContentLoaded", async () => {
    const usuario = requerirSesion();
    if (!usuario) return;
    prepararMenu(usuario);

    const tabla = document.getElementById("tabla-tickets");
    const aviso = document.getElementById("tickets-aviso");
    await cargarLista();

    const pedido = new URLSearchParams(window.location.search).get("ticket");
    if (pedido) tabla.querySelector(`tr[data-id="${CSS.escape(pedido)}"]`)?.click();

    async function cargarLista() {
        const resultado = await llamarApi("portal", { accion: "mis_tickets" });
        if (!resultado.success) {
            mostrarAviso(aviso, resultado.message || "No se pudieron cargar los tickets.");
            tabla.innerHTML = `<tr><td colspan="5" class="vacio">Sin datos</td></tr>`;
            return;
        }
        const tickets = resultado.tickets || [];
        if (!tickets.length) {
            tabla.innerHTML = `<tr><td colspan="5" class="vacio">Aún no tienes solicitudes. <a href="VenSolicitud.html">Crea la primera</a>.</td></tr>`;
            return;
        }
        const pendientes = tickets.filter((t) => t.encuesta_pendiente).length;
        if (pendientes) {
            mostrarAviso(aviso, `Tienes ${pendientes} encuesta(s) pendiente(s): abre el ticket marcado con ★ para confirmar si se resolvió.`, "info");
        }
        tabla.innerHTML = tickets.map((t) => `
            <tr data-id="${t.ticket_id}">
                <td>#${t.ticket_id}${t.encuesta_pendiente ? ' <span title="Encuesta pendiente">★</span>' : ""}</td>
                <td class="texto-corto">${escapeHtml(t.descripcion)}</td>
                <td>${etiquetaPrioridad(t.prioridad)}</td>
                <td>${etiquetaEstado(t.estado)}</td>
                <td>${formatearFecha(t.fecha_creacion, false)}</td>
            </tr>`).join("");
        etiquetarTabla(tabla.closest("table"));
        tabla.querySelectorAll("tr[data-id]").forEach((fila) => {
            fila.addEventListener("click", () => {
                tabla.querySelectorAll("tr").forEach((f) => f.classList.remove("seleccionado"));
                fila.classList.add("seleccionado");
                mostrarDetalle(fila.dataset.id);
            });
        });
    }

    async function mostrarDetalle(ticketId) {
        const contenido = document.getElementById("detalle-contenido");
        document.getElementById("detalle-vacio").hidden = true;
        contenido.hidden = false;
        contenido.innerHTML = `<p class="card-description">Cargando...</p>`;

        const r = await llamarApi("portal", { accion: "detalle_ticket", ticket_id: ticketId });
        if (!r.success) {
            contenido.innerHTML = `<p class="aviso aviso-error">${escapeHtml(r.message)}</p>`;
            return;
        }
        const t = r.data;
        const enChat = ["Pendiente", "En diagnóstico", "Escalamiento pendiente"].includes(t.estado);
        const res = t.ultimo_resultado;
        const encuestas = t.encuestas || [];
        contenido.innerHTML = `
            <div id="zona-encuesta"></div>
            <dl class="detalle-lista">
                <dt>Ticket</dt><dd>#${t.ticket_id} ${etiquetaEstado(t.estado)} ${etiquetaSla(t.sla_vencido)}</dd>
                <dt>Prioridad</dt><dd>${etiquetaPrioridad(t.prioridad)} <small>${escapeHtml(t.motivo_prioridad || "")}</small></dd>
                <dt>Atender antes de</dt><dd>${formatearFecha(t.fecha_limite_atencion)}</dd>
                <dt>Dispositivo</dt><dd>${escapeHtml(t.tipo_dispositivo || "No especificado")}</dd>
                <dt>Problema</dt><dd>${escapeHtml(t.descripcion_problema)}</dd>
                <dt>Creado</dt><dd>${formatearFecha(t.fecha_creacion)}</dd>
                <dt>Visita</dt><dd>${formatearFecha(t.fecha_visita)}</dd>
                <dt>Técnico</dt><dd>${escapeHtml(t.tecnico_nombre || "—")}</dd>
                <dt>Cierre</dt><dd>${formatearFecha(t.fecha_cierre)}</dd>
                <dt>Acta</dt><dd>${t.tiene_acta ? `<button type="button" class="btn btn-secundario" id="btn-acta">Descargar acta PDF</button>` : "—"}</dd>
            </dl>
            ${enChat ? `<p><a class="btn" href="chatVen.html?ticket=${t.ticket_id}" style="text-decoration:none;display:inline-block;">Continuar en el chat</a></p>` : ""}
            ${res ? `
                <h3>Resultado de la visita</h3>
                <dl class="detalle-lista">
                    <dt>Resultado</dt><dd><strong>${escapeHtml(res.resultado)}</strong></dd>
                    <dt>Diagnóstico</dt><dd>${escapeHtml(res.diagnostico)}</dd>
                    <dt>Trabajo</dt><dd>${escapeHtml(res.trabajo_realizado)}</dd>
                    <dt>Repuestos</dt><dd>${escapeHtml(res.repuestos || "Ninguno")}</dd>
                    <dt>Llegada / salida</dt><dd>${formatearFecha(res.hora_llegada)} — ${formatearFecha(res.hora_salida)}</dd>
                </dl>` : ""}
            ${encuestas.length ? `<h3>Tu evaluación</h3><p>${encuestas.map((e) =>
                `${"★".repeat(e.calificacion || 0)} · ${e.resuelto ? "Resuelto" : "No resuelto"}${e.comentario ? " · " + escapeHtml(e.comentario) : ""}`).join("<br>")}</p>` : ""}
            <h3>Seguimiento del caso</h3>
            ${pintarLineaTiempo(t.linea_tiempo)}
            <h3>Conversación</h3>
            ${pintarHistorial(t.historial)}`;

        document.getElementById("btn-acta")?.addEventListener("click", () => descargarActa(t.ticket_id, aviso));
        if (t.encuesta_pendiente) {
            const titulo = t.estado === "Resuelto IA"
                ? "¿Cómo te fue con el asistente?"
                : "El técnico terminó la visita: ¿se resolvió tu problema?";
            pintarEncuesta(document.getElementById("zona-encuesta"), t.ticket_id, {
                titulo,
                alTerminar: async () => {
                    await cargarLista();
                    setTimeout(() => mostrarDetalle(ticketId), 1500);
                },
            });
        }
    }
});
