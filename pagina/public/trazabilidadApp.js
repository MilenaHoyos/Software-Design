/**
 * Consulta de trazabilidad (admin): historia completa de un caso y auditoría de accesos.
 */
const TIPOS_EVENTO = {
    auditoria: "📋 Estado", chat: "💬 Chat", cita: "📅 Cita", resultado: "🛠 Visita", encuesta: "★ Encuesta",
};
const NOMBRES_EVENTO_ACCESO = {
    login_ok: "Inicio de sesión", login_fallido: "Intento fallido", login_bloqueado: "Cuenta bloqueada",
    logout: "Cierre de sesión", reset_password: "Cambio de contraseña",
};

document.addEventListener("DOMContentLoaded", () => {
    const usuario = requerirSesion(["admin"]);
    if (!usuario) return;
    prepararMenu(usuario);

    const aviso = document.getElementById("traza-aviso");
    document.getElementById("form-buscar").addEventListener("submit", (e) => {
        e.preventDefault();
        const ticket = document.getElementById("b-ticket").value;
        const correo = document.getElementById("b-correo").value.trim();
        if (!ticket && !correo) return mostrarAviso(aviso, "Escribe un número de ticket o un correo.");
        buscar(ticket, correo);
    });
    let espera = null;
    ["a-correo", "a-evento"].forEach((id) => document.getElementById(id).addEventListener("input", () => {
        clearTimeout(espera);
        espera = setTimeout(cargarAccesos, 400);
    }));
    cargarAccesos();

    const pedido = new URLSearchParams(window.location.search).get("ticket");
    if (pedido) {
        document.getElementById("b-ticket").value = pedido;
        buscar(pedido, "");
    }

    async function buscar(ticketId, correo) {
        mostrarAviso(aviso, "");
        const r = await llamarApi("gestion", { accion: "trazabilidad", ticket_id: ticketId, correo });
        if (!r.success) return mostrarAviso(aviso, r.message || "No se pudo consultar la trazabilidad.");

        const lista = document.getElementById("traza-tickets");
        lista.innerHTML = r.tickets.length ? `
            <p class="card-description">${r.tickets.length} caso(s) de ${escapeHtml(correo)}:</p>
            <div class="tabla-wrap"><table class="tabla" id="tabla-casos">
                <thead><tr><th>#</th><th>Creado</th><th>Prioridad</th><th>Estado</th><th>Problema</th></tr></thead>
                <tbody>${r.tickets.map((t) => `<tr data-id="${t.ticket_id}"><td>#${t.ticket_id}</td><td>${formatearFecha(t.fecha_creacion, false)}</td>
                    <td>${etiquetaPrioridad(t.prioridad)}</td><td>${etiquetaEstado(t.estado)}</td><td class="texto-corto">${escapeHtml(t.descripcion)}</td></tr>`).join("")}</tbody>
            </table></div>` : (correo ? '<p class="card-description">No hay casos con ese correo.</p>' : "");
        const tablaCasos = document.getElementById("tabla-casos");
        if (tablaCasos) {
            etiquetarTabla(tablaCasos);
            tablaCasos.querySelectorAll("tr[data-id]").forEach((f) => f.addEventListener("click", () => {
                document.getElementById("b-ticket").value = f.dataset.id;
                buscar(f.dataset.id, "");
            }));
        }
        if (!r.ticket) {
            if (ticketId) mostrarAviso(aviso, `No existe el ticket #${ticketId}.`);
            return;
        }
        pintarCaso(r);
    }

    function pintarCaso(r) {
        const t = r.ticket;
        document.getElementById("traza-vacio").hidden = true;
        document.getElementById("traza-ticket").innerHTML = `
            <dl class="detalle-lista">
                <dt>Ticket</dt><dd>#${t.ticket_id} ${etiquetaEstado(t.estado)}</dd>
                <dt>Prioridad</dt><dd>${etiquetaPrioridad(t.prioridad)} <small>${escapeHtml(t.motivo_prioridad || "")}</small></dd>
                <dt>Cliente</dt><dd>${escapeHtml(t.nombre_completo)} · ${escapeHtml(t.correo || "")}</dd>
                <dt>Canal</dt><dd>${escapeHtml(t.canal_origen)} · ${escapeHtml(t.categoria || "Sin clasificar")}</dd>
                <dt>Creado</dt><dd>${formatearFecha(t.fecha_creacion)}</dd>
                <dt>Tiempo límite</dt><dd>${formatearFecha(t.fecha_limite_atencion)}</dd>
                <dt>Cierre</dt><dd>${formatearFecha(t.fecha_cierre)}</dd>
                <dt>Técnico</dt><dd>${escapeHtml(t.tecnico_nombre || "—")}</dd>
                <dt>Acta</dt><dd>${t.tiene_acta ? `<button type="button" class="btn btn-secundario" id="btn-acta">Descargar</button><br><small title="Huella SHA-256">${escapeHtml(t.acta_sha256 || "")}</small>` : "—"}</dd>
            </dl>`;
        document.getElementById("btn-acta")?.addEventListener("click", () => descargarActa(t.ticket_id, aviso));

        document.getElementById("traza-eventos").innerHTML = `<ol class="linea-tiempo">${r.eventos.map((e) => {
            const detalle = e.detalle && Object.keys(e.detalle).length
                ? Object.entries(e.detalle).filter(([, v]) => v !== null && v !== "").map(([k, v]) =>
                    `${escapeHtml(k)}: ${escapeHtml(typeof v === "object" ? JSON.stringify(v) : v)}`).join(" · ") : "";
            return `<li>
                <span class="lt-fecha">${formatearFecha(e.fecha)} · ${TIPOS_EVENTO[e.tipo] || e.tipo}</span>
                <span class="lt-titulo">${escapeHtml(e.tipo === "auditoria" ? (NOMBRES_ACCION[e.titulo] || e.titulo) : e.titulo)}</span>
                ${e.estado_nuevo ? `<span class="lt-estado">${e.estado_anterior ? escapeHtml(e.estado_anterior) + " → " : ""}${escapeHtml(e.estado_nuevo)}</span>` : ""}
                ${e.actor ? `<span class="lt-actor">${escapeHtml(e.actor)}</span>` : ""}
                ${detalle ? `<span class="lt-estado">${detalle}</span>` : ""}
            </li>`;
        }).join("")}</ol>`;

        document.getElementById("traza-accesos").innerHTML = r.accesos_cliente.length
            ? `<ul class="historial">${r.accesos_cliente.map((a) => `<li><span class="quien">${formatearFecha(a.creado_en)}</span>
                ${escapeHtml(NOMBRES_EVENTO_ACCESO[a.evento] || a.evento)} ${a.ip ? "· IP " + escapeHtml(a.ip) : ""}</li>`).join("")}</ul>`
            : '<p class="card-description">Sin accesos registrados.</p>';
    }

    async function cargarAccesos() {
        const r = await llamarApi("gestion", {
            accion: "accesos",
            correo: document.getElementById("a-correo").value.trim(),
            evento: document.getElementById("a-evento").value,
        });
        const tabla = document.getElementById("tabla-accesos");
        const cuerpo = tabla.querySelector("tbody");
        if (!r.success) {
            cuerpo.innerHTML = `<tr><td colspan="5" class="vacio">${escapeHtml(r.message || "Sin datos")}</td></tr>`;
            return;
        }
        cuerpo.innerHTML = r.accesos.length ? r.accesos.map((a) => `
            <tr><td>${formatearFecha(a.creado_en)}</td><td>${escapeHtml(a.correo || "—")}</td>
                <td>${escapeHtml(a.nombre_completo || "—")}${a.rol ? ` <small>(${escapeHtml(a.rol)})</small>` : ""}</td>
                <td>${a.evento === "login_fallido" || a.evento === "login_bloqueado" ? "⚠ " : ""}${escapeHtml(NOMBRES_EVENTO_ACCESO[a.evento] || a.evento)}</td>
                <td>${escapeHtml(a.ip || "—")}</td></tr>`).join("")
            : '<tr><td colspan="5" class="vacio">Sin registros.</td></tr>';
        etiquetarTabla(tabla);
    }
});
