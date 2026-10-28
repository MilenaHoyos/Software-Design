/**
 * Portal del técnico: visitas pendientes, agenda, llegada y resultado de visita (con acta PDF).
 */
document.addEventListener("DOMContentLoaded", () => {
    const usuario = requerirSesion(["tecnico"]);
    if (!usuario) return;
    prepararMenu(usuario);
    document.getElementById("tec-nombre").textContent = (usuario.nombre || "técnico").split(" ")[0];

    const tabla = document.getElementById("tabla-cola");
    const aviso = document.getElementById("tec-aviso");
    const formResultado = document.getElementById("form-resultado");
    const btnLlegada = document.getElementById("btn-llegada");
    let ticketSeleccionado = null;

    // Pestañas
    let agendaCargada = false;
    document.querySelectorAll("[data-pestana]").forEach((boton) => {
        boton.addEventListener("click", () => {
            document.querySelectorAll("[data-pestana]").forEach((b) => b.setAttribute("aria-selected", String(b === boton)));
            document.getElementById("pestana-visitas").hidden = boton.dataset.pestana !== "visitas";
            document.getElementById("pestana-agenda").hidden = boton.dataset.pestana !== "agenda";
            if (boton.dataset.pestana === "agenda" && !agendaCargada) { agendaCargada = true; agenda.recargar(); }
        });
    });

    const agenda = crearAgenda({
        contenedor: document.getElementById("agenda"),
        titulo: document.getElementById("agenda-titulo"),
        anterior: document.getElementById("agenda-anterior"),
        hoy: document.getElementById("agenda-hoy"),
        siguiente: document.getElementById("agenda-siguiente"),
        cargar: async (desde, hasta) => {
            const r = await llamarApi("operacion", { accion: "agenda", desde, hasta });
            return r.success ? r.citas : null;
        },
        alSeleccionar: (ticketId) => {
            document.querySelector('[data-pestana="visitas"]').click();
            mostrarDetalle(ticketId);
        },
    });

    document.getElementById("btn-recargar").addEventListener("click", () => {
        cargarCola();
        if (agendaCargada) agenda.recargar();
    });
    cargarCola();

    async function cargarCola() {
        const r = await llamarApi("operacion", { accion: "cola_tecnico" });
        if (!r.success) {
            mostrarAviso(aviso, r.message || "No se pudo cargar la cola.");
            return;
        }
        const tickets = r.tickets || [];
        if (!tickets.length) {
            tabla.innerHTML = `<tr><td colspan="6" class="vacio">No tienes visitas pendientes. 🎉</td></tr>`;
            return;
        }
        tabla.innerHTML = tickets.map((t) => `
            <tr data-id="${t.ticket_id}">
                <td>#${t.ticket_id}</td>
                <td>${formatearFecha(t.fecha_visita)}</td>
                <td>${etiquetaPrioridad(t.prioridad)}</td>
                <td>${escapeHtml(t.nombre_completo)}<br><small>${escapeHtml(t.telefono || "")}</small></td>
                <td class="texto-corto">${escapeHtml(t.direccion || "—")}</td>
                <td>${etiquetaEstado(t.estado)}</td>
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
        formResultado.hidden = true;
        btnLlegada.hidden = true;

        const r = await llamarApi("portal", { accion: "detalle_ticket", ticket_id: ticketId });
        if (!r.success) {
            contenido.innerHTML = `<p class="aviso aviso-error">${escapeHtml(r.message)}</p>`;
            return;
        }
        const t = r.data;
        ticketSeleccionado = t.ticket_id;
        const res = t.ultimo_resultado;
        contenido.innerHTML = `
            <dl class="detalle-lista">
                <dt>Ticket</dt><dd>#${t.ticket_id} ${etiquetaEstado(t.estado)}</dd>
                <dt>Prioridad</dt><dd>${etiquetaPrioridad(t.prioridad)} <small>${escapeHtml(t.motivo_prioridad || "")}</small></dd>
                <dt>Visita</dt><dd>${formatearFecha(t.fecha_visita)}</dd>
                <dt>Cliente</dt><dd>${escapeHtml(t.nombre_completo)}</dd>
                <dt>Contacto</dt><dd>${escapeHtml(t.telefono || "—")} · ${escapeHtml(t.correo || "")}</dd>
                <dt>Dirección</dt><dd>${escapeHtml(t.direccion || "—")}</dd>
                <dt>Dispositivo</dt><dd>${escapeHtml(t.tipo_dispositivo || "No especificado")}</dd>
                <dt>Problema</dt><dd>${escapeHtml(t.descripcion_problema)}</dd>
            </dl>
            ${res ? `
                <h3>Último resultado registrado</h3>
                <p><strong>${escapeHtml(res.resultado)}</strong> — ${escapeHtml(res.diagnostico)}</p>
                <p>
                    ${t.tiene_acta ? '<button type="button" class="btn btn-secundario" id="btn-descargar">Descargar acta</button>' : ""}
                    <button type="button" class="btn btn-secundario" id="btn-regenerar">${t.tiene_acta ? "Regenerar y reenviar acta" : "Generar acta"}</button>
                </p>` : ""}
            <h3>Conversación con la IA</h3>
            ${pintarHistorial(t.historial)}`;
        btnLlegada.hidden = t.estado !== "Agendado";
        formResultado.hidden = !["Agendado", "En atención"].includes(t.estado);
        document.getElementById("btn-descargar")?.addEventListener("click", () => descargarActa(t.ticket_id, aviso));
        document.getElementById("btn-regenerar")?.addEventListener("click", async (e) => {
            e.target.disabled = true;
            const g = await llamarServidor("actas/generar", { ticket_id: t.ticket_id });
            e.target.disabled = false;
            mostrarAviso(aviso, g.message, g.success ? "ok" : "error");
            if (g.success) mostrarDetalle(t.ticket_id);
        });
    }

    btnLlegada.addEventListener("click", async () => {
        btnLlegada.disabled = true;
        const r = await llamarApi("operacion", { accion: "iniciar_visita", ticket_id: ticketSeleccionado });
        btnLlegada.disabled = false;
        mostrarAviso(aviso, r.message, r.success ? "ok" : "error");
        if (r.success) {
            await cargarCola();
            mostrarDetalle(ticketSeleccionado);
        }
    });

    formResultado.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!ticketSeleccionado) return;
        const boton = document.getElementById("btn-resultado");
        boton.disabled = true;
        boton.textContent = "Generando acta...";

        // server.js registra el resultado en n8n, genera el PDF, lo guarda y n8n lo envía al cliente
        const r = await llamarServidor("visitas/resultado", {
            ticket_id: ticketSeleccionado,
            diagnostico: document.getElementById("res-diagnostico").value.trim(),
            trabajo_realizado: document.getElementById("res-trabajo").value.trim(),
            repuestos: document.getElementById("res-repuestos").value.trim(),
            resultado: document.getElementById("res-resultado").value,
            observaciones: document.getElementById("res-observaciones").value.trim(),
        });
        boton.disabled = false;
        boton.textContent = "Registrar resultado y generar acta";
        mostrarAviso(aviso, r.message, r.success && r.acta_generada !== false ? "ok" : "error");
        if (r.success) {
            formResultado.reset();
            await cargarCola();
            mostrarDetalle(ticketSeleccionado);
            if (agendaCargada) agenda.recargar();
        }
    });
});
