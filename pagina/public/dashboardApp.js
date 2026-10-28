/**
 * Dashboard de administración: indicadores gerenciales, tickets por prioridad,
 * asignación con horarios libres y agenda de todos los técnicos.
 */
const ESTADOS_ASIGNABLES = ["Pendiente de asignación", "Escalado nivel 2", "Escalamiento pendiente"];
const ORDEN_PRIORIDAD = ["Crítica", "Alta", "Media", "Baja", "Sin prioridad"];
const TAMANO_PAGINA = 15;

document.addEventListener("DOMContentLoaded", () => {
    const usuario = requerirSesion(["admin"]);
    if (!usuario) return;
    prepararMenu(usuario);

    const aviso = document.getElementById("dash-aviso");
    const tabla = document.getElementById("tabla-admin");
    const formAsignar = document.getElementById("form-asignar");
    let tecnicos = [];
    let ticketSeleccionado = null;
    let pagina = 1;
    let total = 0;

    document.getElementById("btn-filtrar").addEventListener("click", cargarMetricas);
    ["f-estado", "f-prioridad", "f-vencidos", "f-creado-desde", "f-creado-hasta"].forEach((id) =>
        document.getElementById(id).addEventListener("change", () => { pagina = 1; cargarTickets(); }));
    let esperaTexto = null;
    document.getElementById("f-texto").addEventListener("input", () => {
        clearTimeout(esperaTexto);
        esperaTexto = setTimeout(() => { pagina = 1; cargarTickets(); }, 400);
    });
    document.getElementById("pag-anterior").addEventListener("click", () => { if (pagina > 1) { pagina--; cargarTickets(); } });
    document.getElementById("pag-siguiente").addEventListener("click", () => {
        if (pagina * TAMANO_PAGINA < total) { pagina++; cargarTickets(); }
    });
    document.getElementById("btn-csv").addEventListener("click", exportarCsv);
    document.getElementById("asig-tecnico").addEventListener("change", cargarHorarios);

    const agendaTecnico = document.getElementById("agenda-tecnico");
    const agenda = crearAgenda({
        contenedor: document.getElementById("agenda"),
        titulo: document.getElementById("agenda-titulo"),
        anterior: document.getElementById("agenda-anterior"),
        hoy: document.getElementById("agenda-hoy"),
        siguiente: document.getElementById("agenda-siguiente"),
        mostrarTecnico: true,
        cargar: async (desde, hasta) => {
            const r = await llamarApi("operacion", { accion: "agenda", desde, hasta, tecnico_id: agendaTecnico.value });
            if (r.success && agendaTecnico.options.length === 1) {
                r.tecnicos.forEach((t) => agendaTecnico.add(new Option(`${t.nombre} (${t.cuadrante})`, t.tecnico_id)));
            }
            return r.success ? r.citas : null;
        },
        alSeleccionar: (ticketId) => mostrarDetalle(ticketId),
    });
    agendaTecnico.addEventListener("change", () => agenda.recargar());

    cargarMonitoreo();
    cargarMetricas();
    cargarTickets();
    agenda.recargar();

    // ---------- monitoreo operativo: se actualiza solo cada minuto ----------
    document.getElementById("btn-mon-actualizar").addEventListener("click", cargarMonitoreo);
    setInterval(() => { if (!document.hidden) cargarMonitoreo(); }, 60000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) cargarMonitoreo(); });

    async function cargarMonitoreo() {
        const r = await llamarApi("gestion", { accion: "monitoreo" });
        if (!r.success) {
            document.getElementById("mon-fecha").textContent = r.message || "No se pudo actualizar el monitoreo.";
            return;
        }
        const n = (v) => Number(v || 0).toLocaleString("es-CO");
        const alerta = (v, texto) => (Number(v) > 0 ? `<span class="estado-mal">⚠ ${texto}</span>` : '<span class="estado-ok">✔ al día</span>');
        const tarjetas = [
            ["Casos nuevos hoy", n(r.nuevos_hoy), `${n(r.abiertos)} abiertos en total`],
            ["En diagnóstico con IA", n(r.en_diagnostico_ia), "conversando con el asistente"],
            ["Por asignar técnico", n(r.pendientes_asignacion), `${n(r.esperando_datos_visita)} esperando datos de visita`],
            ["Técnico en sitio", n(r.en_atencion), "visitas en curso"],
            ["Visitas de hoy", `${n(r.visitas_hoy_realizadas)} / ${n(r.visitas_hoy)}`, "realizadas / programadas"],
            ["Esperando confirmación", n(r.esperando_confirmacion), "encuesta del cliente"],
            ["SLA vencidos", n(r.sla_vencidos), alerta(r.sla_vencidos, "atender ya")],
            ["SLA por vencer (2 h)", n(r.sla_por_vencer), alerta(r.sla_por_vencer, "próximos a vencer")],
        ];
        document.getElementById("mon-tarjetas").innerHTML = tarjetas.map(([titulo, valor, sub]) => `
            <div class="stat-box"><div>
                <div class="stat-label">${titulo}</div>
                <div class="stat-number">${valor}</div>
                <div class="kpi-sub">${sub}</div>
            </div></div>`).join("");
        document.getElementById("mon-fecha").textContent = `Actualizado ${formatearFecha(r.actualizado_en)}`;

        const urgentes = document.getElementById("tabla-mon-urgentes");
        urgentes.querySelector("tbody").innerHTML = (r.atencion_inmediata || []).length ? r.atencion_inmediata.map((t) => `
            <tr data-ticket="${t.ticket_id}"><td>${t.ticket_id}</td><td>${escapeHtml(t.nombre_completo)}</td>
                <td>${etiquetaPrioridad(t.prioridad)}</td><td>${etiquetaEstado(t.estado)}</td>
                <td>${formatearFecha(t.fecha_limite_atencion)} ${etiquetaSla(t.vencido)}</td></tr>`).join("")
            : '<tr><td colspan="5" class="vacio">✔ No hay casos con SLA vencido ni por vencer.</td></tr>';
        etiquetarTabla(urgentes);
        urgentes.querySelectorAll("tr[data-ticket]").forEach((f) => f.addEventListener("click", () => mostrarDetalle(Number(f.dataset.ticket))));

        const tablaTec = document.getElementById("tabla-mon-tecnicos");
        const estadoHoy = (t) => t.ausente ? '<span class="badge-estado estado-agenda">Ausente</span>'
            : !t.trabaja_hoy ? '<span class="badge-estado estado-activo">No labora hoy</span>'
            : t.en_atencion ? '<span class="badge-estado estado-alerta">En sitio</span>'
            : '<span class="badge-estado estado-final">Disponible</span>';
        tablaTec.querySelector("tbody").innerHTML = (r.tecnicos_hoy || []).length ? r.tecnicos_hoy.map((t) => `
            <tr><td>${escapeHtml(t.nombre)}</td><td>${escapeHtml(t.cuadrante)}</td><td>${estadoHoy(t)}</td>
                <td>${t.realizadas_hoy} / ${t.visitas_hoy}</td><td>${t.proxima_visita ? formatearFecha(t.proxima_visita) : "—"}</td></tr>`).join("")
            : '<tr><td colspan="5" class="vacio">No hay técnicos activos.</td></tr>';
        etiquetarTabla(tablaTec);

        document.getElementById("mon-actividad").innerHTML = (r.actividad_reciente || []).length ? r.actividad_reciente.map((a) => `
            <li><span class="quien">${formatearFecha(a.fecha)} · Ticket #${a.ticket_id} · ${escapeHtml(a.actor || "sistema")}</span>
                ${escapeHtml(NOMBRES_ACCION[a.accion] || a.accion)}${a.estado_nuevo ? ` → ${escapeHtml(a.estado_nuevo)}` : ""}</li>`).join("")
            : '<li><span class="card-description">Sin actividad todavía.</span></li>';
    }

    // ---------- indicadores ----------
    async function cargarMetricas() {
        const r = await llamarApi("gestion", {
            accion: "dashboard",
            desde: document.getElementById("f-desde").value,
            hasta: document.getElementById("f-hasta").value,
        });
        if (!r.success) {
            mostrarAviso(aviso, r.message || "No se pudieron cargar los indicadores.");
            return;
        }
        const m = r.metricas;
        if (!document.getElementById("f-desde").value) {
            document.getElementById("f-desde").value = m.periodo.desde;
            document.getElementById("f-hasta").value = m.periodo.hasta;
        }
        const num = (v, sufijo = "") => (v === null || v === undefined ? "—" : `${Number(v).toLocaleString("es-CO")}${sufijo}`);
        const tarjetas = [
            ["Tickets en el periodo", num(m.total_tickets), `${num(m.abiertos)} abiertos`],
            ["Resueltos por la IA", num(m.tasa_resolucion_ia_pct, "%"), `${num(m.resueltos_ia)} de ${num(Number(m.resueltos_ia) + Number(m.cerrados))} cerrados`],
            ["Tiempo promedio de solución", num(m.tiempo_promedio_resolucion_horas, " h"), "desde la creación hasta el cierre"],
            ["Cumplimiento de SLA", num(m.cumplimiento_sla_pct, "%"), "cerrados dentro del tiempo límite"],
            ["SLA vencidos ahora", num(m.sla_vencidos_abiertos),
                Number(m.sla_vencidos_abiertos) > 0 ? '<span class="estado-mal">⚠ requieren atención</span>' : '<span class="estado-ok">✔ al día</span>'],
            ["Satisfacción del cliente", m.satisfaccion_promedio ? `${num(m.satisfaccion_promedio)} ★` : "—", `${num(m.encuestas_respondidas)} encuestas`],
            ["Confirmación de solución", num(m.confirmacion_cliente_pct, "%"), "clientes que confirman que se resolvió"],
            ["Resolución en primera visita", num(m.resolucion_primera_visita_pct, "%"), `${num(m.visitas_realizadas)} visitas realizadas`],
            ["Esperando confirmación", num(m.pendientes_confirmacion), "encuesta del cliente pendiente"],
            ["Cancelados", num(m.cancelados), "incluye cierres por inactividad"],
        ];
        document.getElementById("metricas").innerHTML = tarjetas.map(([titulo, valor, sub]) => `
            <div class="stat-box"><div>
                <div class="stat-label">${titulo}</div>
                <div class="stat-number">${valor}</div>
                <div class="kpi-sub">${sub}</div>
            </div></div>`).join("");
        const canales = Object.entries(m.por_canal || {}).map(([c, n]) => `${c}: ${n}`).join(" · ");
        document.getElementById("metricas-fecha").textContent =
            `Periodo ${m.periodo.desde} a ${m.periodo.hasta} · Por canal: ${canales || "—"} · Actualizado ${formatearFecha(m.actualizado_en)}`;

        const puntos = (m.tendencia || []).map((d) => ({
            etiqueta: new Date(`${d.dia}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }),
            creados: d.creados, cerrados: d.cerrados,
        }));
        graficoLineas(document.getElementById("grafico-tendencia"), puntos, [
            { clave: "creados", nombre: "Creados", color: "var(--serie-1)" },
            { clave: "cerrados", nombre: "Cerrados", color: "var(--serie-2)" },
        ]);
        document.getElementById("tabla-tendencia").innerHTML = `<table class="tabla"><thead><tr><th>Día</th><th>Creados</th><th>Cerrados</th></tr></thead>
            <tbody>${puntos.map((p) => `<tr><td>${escapeHtml(p.etiqueta)}</td><td>${p.creados}</td><td>${p.cerrados}</td></tr>`).join("")}</tbody></table>`;
        graficoBarras(document.getElementById("grafico-prioridad"), m.por_prioridad || {}, ORDEN_PRIORIDAD);
        graficoBarras(document.getElementById("grafico-estado"), m.por_estado || {});
        graficoBarras(document.getElementById("grafico-categoria"), m.por_categoria || {});
        graficoBarras(document.getElementById("grafico-zona"), m.por_zona || {});

        const tablaTec = document.getElementById("tabla-tecnicos");
        tablaTec.querySelector("tbody").innerHTML = (m.tecnicos || []).length ? m.tecnicos.map((t) => `
            <tr><td>${escapeHtml(t.nombre)}</td><td>${escapeHtml(t.cuadrante)}</td><td>${t.visitas}</td>
                <td>${t.resueltas}</td><td>${t.satisfaccion ? `${t.satisfaccion} ★` : "—"}</td><td>${t.proximas}</td></tr>`).join("")
            : `<tr><td colspan="6" class="vacio">No hay técnicos activos.</td></tr>`;
        etiquetarTabla(tablaTec);
    }

    // ---------- tickets ----------
    function filtros() {
        return {
            estado: document.getElementById("f-estado").value,
            prioridad: document.getElementById("f-prioridad").value,
            texto: document.getElementById("f-texto").value.trim(),
            solo_vencidos: document.getElementById("f-vencidos").checked,
            creado_desde: document.getElementById("f-creado-desde").value,
            creado_hasta: document.getElementById("f-creado-hasta").value,
        };
    }

    async function cargarTickets() {
        const r = await llamarApi("gestion", { accion: "tickets_admin", ...filtros(), pagina, tamano: TAMANO_PAGINA });
        if (!r.success) {
            mostrarAviso(aviso, r.message || "No se pudieron cargar los tickets.");
            return;
        }
        tecnicos = r.tecnicos || [];
        total = Number(r.total) || 0;
        const desde = total ? (pagina - 1) * TAMANO_PAGINA + 1 : 0;
        document.getElementById("pag-info").textContent = `${desde}–${Math.min(pagina * TAMANO_PAGINA, total)} de ${total}`;
        const tickets = r.tickets || [];
        tabla.innerHTML = tickets.length ? tickets.map((t) => `
            <tr data-id="${t.ticket_id}">
                <td>#${t.ticket_id}</td>
                <td>${escapeHtml(t.nombre_completo)}<br><small>${escapeHtml(t.canal_origen)}</small></td>
                <td class="texto-corto">${escapeHtml(t.descripcion)}</td>
                <td>${etiquetaPrioridad(t.prioridad)}</td>
                <td>${etiquetaEstado(t.estado)}</td>
                <td>${t.finalizado ? "—" : formatearFecha(t.fecha_limite_atencion)} ${etiquetaSla(t.sla_vencido)}</td>
                <td>${escapeHtml(t.tecnico_nombre || "—")}</td>
            </tr>`).join("") : `<tr><td colspan="7" class="vacio">No hay tickets con ese filtro.</td></tr>`;
        etiquetarTabla(document.getElementById("tabla-tickets-admin"));
        tabla.querySelectorAll("tr[data-id]").forEach((fila) => {
            fila.addEventListener("click", () => {
                tabla.querySelectorAll("tr").forEach((f) => f.classList.remove("seleccionado"));
                fila.classList.add("seleccionado");
                mostrarDetalle(fila.dataset.id);
            });
        });
    }

    async function exportarCsv() {
        const boton = document.getElementById("btn-csv");
        boton.disabled = true;
        const filas = [];
        for (let p = 1; p <= 50; p++) {
            const r = await llamarApi("gestion", { accion: "tickets_admin", ...filtros(), pagina: p, tamano: 100 });
            if (!r.success) break;
            filas.push(...r.tickets);
            if (filas.length >= r.total) break;
        }
        boton.disabled = false;
        const columnas = ["ticket_id", "fecha_creacion", "nombre_completo", "correo", "telefono", "canal_origen", "tipo_dispositivo",
                          "descripcion", "categoria", "prioridad", "motivo_prioridad", "estado", "fecha_limite_atencion",
                          "sla_vencido", "tecnico_nombre", "fecha_visita", "fecha_cierre", "tiene_acta"];
        const celda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csv = "﻿" + [columnas.join(";"), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(";"))].join("\r\n");
        const enlace = document.createElement("a");
        enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        enlace.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
    }

    // ---------- detalle y asignación ----------
    async function mostrarDetalle(ticketId) {
        const contenido = document.getElementById("detalle-contenido");
        document.getElementById("detalle-vacio").hidden = true;
        contenido.hidden = false;
        contenido.innerHTML = `<p class="card-description">Cargando...</p>`;
        formAsignar.hidden = true;

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
                <dt>Ticket</dt><dd>#${t.ticket_id} ${etiquetaEstado(t.estado)} ${etiquetaSla(t.sla_vencido)}</dd>
                <dt>Prioridad</dt><dd>${etiquetaPrioridad(t.prioridad)} <small>${escapeHtml(t.motivo_prioridad || "")}</small></dd>
                <dt>Atender antes de</dt><dd>${formatearFecha(t.fecha_limite_atencion)}</dd>
                <dt>Cliente</dt><dd>${escapeHtml(t.nombre_completo)} · ${escapeHtml(t.correo || "")}</dd>
                <dt>Teléfono</dt><dd>${escapeHtml(t.telefono || "—")}</dd>
                <dt>Dirección</dt><dd>${escapeHtml(t.direccion || "—")}</dd>
                <dt>Impacto</dt><dd>${escapeHtml(t.nivel_impacto || "—")} · ${escapeHtml(t.categoria || "")}</dd>
                <dt>Intentos IA</dt><dd>${t.intentos_ia}</dd>
                <dt>Visita</dt><dd>${formatearFecha(t.fecha_visita)} ${t.tecnico_nombre ? "· " + escapeHtml(t.tecnico_nombre) : ""}</dd>
                <dt>Problema</dt><dd>${escapeHtml(t.descripcion_problema)}</dd>
                ${res ? `<dt>Resultado</dt><dd><strong>${escapeHtml(res.resultado)}</strong> — ${escapeHtml(res.diagnostico)}</dd>` : ""}
            </dl>
            <p>
                <a class="btn btn-secundario" href="trazabilidadVentana.html?ticket=${t.ticket_id}" style="text-decoration:none;display:inline-block;">Ver trazabilidad completa</a>
                ${t.tiene_acta ? '<button type="button" class="btn btn-secundario" id="btn-acta">Descargar acta</button>' : ""}
                ${res ? `<button type="button" class="btn btn-secundario" id="btn-regenerar">${t.tiene_acta ? "Regenerar acta" : "Generar acta"}</button>` : ""}
            </p>
            <h3>Línea de tiempo</h3>
            ${pintarLineaTiempo(t.linea_tiempo)}`;
        document.getElementById("btn-acta")?.addEventListener("click", () => descargarActa(t.ticket_id, aviso));
        document.getElementById("btn-regenerar")?.addEventListener("click", async (e) => {
            e.target.disabled = true;
            const g = await llamarServidor("actas/generar", { ticket_id: t.ticket_id });
            e.target.disabled = false;
            mostrarAviso(aviso, g.message, g.success ? "ok" : "error");
            if (g.success) mostrarDetalle(t.ticket_id);
        });

        if (ESTADOS_ASIGNABLES.includes(t.estado)) {
            const select = document.getElementById("asig-tecnico");
            select.innerHTML = tecnicos.map((te) =>
                `<option value="${te.tecnico_id}">${escapeHtml(te.nombre)} (${escapeHtml(te.cuadrante)})</option>`).join("");
            formAsignar.hidden = false;
            await cargarHorarios();
        }
    }

    async function cargarHorarios() {
        const select = document.getElementById("asig-horario");
        select.innerHTML = '<option value="">Cargando horarios...</option>';
        const r = await llamarApi("operacion", { accion: "horarios_libres", tecnico_id: document.getElementById("asig-tecnico").value });
        const horarios = r.success ? r.horarios : [];
        select.innerHTML = horarios.length
            ? horarios.map((h) => `<option value="${h}">${new Date(h).toLocaleString("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</option>`).join("")
            : '<option value="">Sin horarios libres en los próximos 14 días</option>';
    }

    formAsignar.addEventListener("submit", async (e) => {
        e.preventDefault();
        const boton = document.getElementById("btn-asignar");
        boton.disabled = true;
        const r = await llamarApi("operacion", {
            accion: "asignar_tecnico",
            ticket_id: ticketSeleccionado,
            tecnico_id: document.getElementById("asig-tecnico").value,
            fecha_inicio: document.getElementById("asig-horario").value,
        });
        boton.disabled = false;
        mostrarAviso(aviso, r.message, r.success ? "ok" : "error");
        if (r.success) {
            formAsignar.hidden = true;
            await Promise.all([cargarTickets(), cargarMetricas(), agenda.recargar()]);
            mostrarDetalle(ticketSeleccionado);
        }
    });
});
