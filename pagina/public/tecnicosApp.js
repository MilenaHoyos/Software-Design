/**
 * Administración de técnicos, zonas de atención y disponibilidad (admin).
 */
document.addEventListener("DOMContentLoaded", () => {
    const usuario = requerirSesion(["admin"]);
    if (!usuario) return;
    prepararMenu(usuario);

    const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const aviso = document.getElementById("tec-aviso");
    const tabla = document.getElementById("tabla-tecnicos");
    const tablaZonas = document.getElementById("tabla-zonas");
    const formTecnico = document.getElementById("form-tecnico");
    const formAusencia = document.getElementById("form-ausencia");
    const formZona = document.getElementById("form-zona");
    let tecnicos = [];
    let zonas = [];
    let editando = 0;
    let editandoZona = 0;

    // Horas (0-24) y días de la semana del formulario
    const horas = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
        .map((h) => `<option value="${h}">${String(h).padStart(2, "0")}:00</option>`).join("");
    document.getElementById("tec-hora-inicio").innerHTML = horas(0, 23);
    document.getElementById("tec-hora-fin").innerHTML = horas(1, 24);
    document.getElementById("tec-dias").insertAdjacentHTML("beforeend", DIAS.map((d, i) =>
        `<label><input type="checkbox" name="dia" value="${i + 1}"> ${d}</label>`).join(""));

    document.getElementById("btn-nuevo").addEventListener("click", () => editar(null));
    document.getElementById("btn-nueva-zona").addEventListener("click", () => editarZona(null));
    document.getElementById("tec-filtro-zona").addEventListener("change", pintarTecnicos);
    cargar().then(() => editar(null));

    async function cargar() {
        const r = await llamarApi("gestion", { accion: "tecnicos_listar" });
        if (!r.success) return mostrarAviso(aviso, r.message || "No se pudo cargar la lista de técnicos.");
        tecnicos = r.tecnicos || [];
        zonas = r.zonas || [];
        const opciones = zonas.map((z) => `<option value="${escapeHtml(z.nombre)}">${escapeHtml(z.nombre)}${z.activo ? "" : " (inactiva)"}</option>`).join("");
        const filtro = document.getElementById("tec-filtro-zona");
        const filtroActual = filtro.value;
        filtro.innerHTML = `<option value="">Todas</option>${opciones}`;
        filtro.value = filtroActual;
        const zonaActual = document.getElementById("tec-zona").value;
        document.getElementById("tec-zona").innerHTML = opciones;
        if (zonaActual) document.getElementById("tec-zona").value = zonaActual;
        pintarTecnicos();
        pintarZonas();
    }

    function textoHorario(t) {
        const dias = (t.dias_laborales || []).map((d) => DIAS[d - 1]).join(", ");
        return `${String(t.hora_inicio).padStart(2, "0")}:00–${String(t.hora_fin).padStart(2, "0")}:00 · ${dias}`;
    }

    function estadoTecnico(t) {
        if (!t.activo) return '<span class="badge-estado estado-alerta">Inactivo</span>';
        const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
        if ((t.ausencias || []).some((a) => a.desde <= hoy && a.hasta >= hoy)) return '<span class="badge-estado estado-agenda">Ausente hoy</span>';
        if (!t.cuenta_activa) return '<span class="badge-estado estado-activo">Invitación pendiente</span>';
        return '<span class="badge-estado estado-final">Activo</span>';
    }

    function pintarTecnicos() {
        const zona = document.getElementById("tec-filtro-zona").value;
        const lista = tecnicos.filter((t) => !zona || t.cuadrante === zona);
        tabla.querySelector("tbody").innerHTML = lista.length ? lista.map((t) => `
            <tr data-id="${t.tecnico_id}" class="${t.tecnico_id === editando ? "seleccionado" : ""}">
                <td>${escapeHtml(t.nombre)}<br><small class="card-description">${escapeHtml(t.correo)}</small></td>
                <td>${escapeHtml(t.cuadrante || "—")}</td>
                <td>${escapeHtml(textoHorario(t))}</td>
                <td>${Number(t.citas_proximas)}</td>
                <td>${estadoTecnico(t)}</td>
            </tr>`).join("") : '<tr><td colspan="5" class="vacio">No hay técnicos registrados.</td></tr>';
        etiquetarTabla(tabla);
        tabla.querySelectorAll("tr[data-id]").forEach((f) => f.addEventListener("click", () =>
            editar(tecnicos.find((t) => t.tecnico_id === Number(f.dataset.id)))));
    }

    function editar(t) {
        editando = t ? t.tecnico_id : 0;
        document.getElementById("tec-titulo-form").textContent = t ? "Editar técnico" : "Nuevo técnico";
        document.getElementById("tec-nombre").value = t ? t.nombre : "";
        const correo = document.getElementById("tec-correo");
        correo.value = t ? t.correo : "";
        correo.disabled = !!t; // el correo es el usuario de acceso: no se cambia desde aquí
        document.getElementById("tec-telefono").value = t ? (t.telefono || "") : "";
        const primeraActiva = (zonas.find((z) => z.activo) || zonas[0] || {}).nombre || "";
        document.getElementById("tec-zona").value = t ? t.cuadrante : primeraActiva;
        document.getElementById("tec-hora-inicio").value = t ? t.hora_inicio : 8;
        document.getElementById("tec-hora-fin").value = t ? t.hora_fin : 17;
        const dias = t ? t.dias_laborales : [1, 2, 3, 4, 5, 6];
        formTecnico.querySelectorAll('input[name="dia"]').forEach((c) => { c.checked = dias.includes(Number(c.value)); });
        document.getElementById("tec-activo").checked = t ? t.activo : true;
        document.getElementById("tec-cuenta").textContent = !t
            ? "Al guardar se le enviará un correo para que active su cuenta y defina su contraseña."
            : `${t.cuenta_activa ? "Cuenta activa" : "Aún no ha activado su cuenta"} · ${Number(t.visitas_realizadas)} visita(s) realizada(s).`;
        document.getElementById("bloque-ausencias").hidden = !t;
        pintarAusencias(t);
        pintarTecnicos();
    }

    function pintarAusencias(t) {
        const lista = document.getElementById("lista-ausencias");
        const ausencias = (t && t.ausencias) || [];
        lista.innerHTML = ausencias.length ? ausencias.map((a) => `
            <li><span><strong>${formatearFecha(a.desde + "T12:00:00", false)} – ${formatearFecha(a.hasta + "T12:00:00", false)}</strong>
                ${a.motivo ? "· " + escapeHtml(a.motivo) : ""}</span>
                <button type="button" class="btn btn-secundario" data-ausencia="${a.id}">Quitar</button></li>`).join("")
            : '<li><span class="card-description">Sin ausencias programadas.</span></li>';
        lista.querySelectorAll("[data-ausencia]").forEach((b) => b.addEventListener("click", async () => {
            b.disabled = true;
            const r = await llamarApi("gestion", { accion: "ausencia_eliminar", ausencia_id: Number(b.dataset.ausencia) });
            if (r.success) await recargarEditando();
            mostrarAviso(aviso, r.message, r.success ? "ok" : "error");
        }));
    }

    async function recargarEditando() {
        await cargar();
        const t = tecnicos.find((x) => x.tecnico_id === editando);
        if (t) editar(t);
    }

    formTecnico.addEventListener("submit", async (e) => {
        e.preventDefault();
        const boton = formTecnico.querySelector("button[type=submit]");
        boton.disabled = true;
        const r = await llamarApi("gestion", {
            accion: "tecnico_guardar",
            tecnico_id: editando,
            nombre: document.getElementById("tec-nombre").value.trim(),
            correo_tecnico: document.getElementById("tec-correo").value.trim(),
            telefono: document.getElementById("tec-telefono").value.trim(),
            zona: document.getElementById("tec-zona").value,
            hora_inicio: Number(document.getElementById("tec-hora-inicio").value),
            hora_fin: Number(document.getElementById("tec-hora-fin").value),
            dias: [...formTecnico.querySelectorAll('input[name="dia"]:checked')].map((c) => Number(c.value)),
            activo: document.getElementById("tec-activo").checked,
        });
        boton.disabled = false;
        if (r.success) {
            editando = r.tecnico_id;
            await recargarEditando();
        }
        mostrarAviso(aviso, r.message, r.success ? "ok" : "error");
    });

    formAusencia.addEventListener("submit", async (e) => {
        e.preventDefault();
        const boton = formAusencia.querySelector("button[type=submit]");
        boton.disabled = true;
        const r = await llamarApi("gestion", {
            accion: "ausencia_guardar",
            tecnico_id: editando,
            aus_desde: document.getElementById("aus-desde").value,
            aus_hasta: document.getElementById("aus-hasta").value,
            motivo: document.getElementById("aus-motivo").value.trim(),
        });
        boton.disabled = false;
        if (r.success) {
            formAusencia.reset();
            await recargarEditando();
        }
        mostrarAviso(aviso, r.message, !r.success ? "error" : r.conflictos ? "info" : "ok");
    });

    function pintarZonas() {
        tablaZonas.querySelector("tbody").innerHTML = zonas.length ? zonas.map((z) => `
            <tr data-id="${z.zona_id}" class="${z.zona_id === editandoZona ? "seleccionado" : ""}">
                <td>${escapeHtml(z.nombre)}<br><small class="card-description">${escapeHtml(z.palabras_clave || "Sin palabras clave")}</small></td>
                <td>${Number(z.tecnicos_activos)}${z.activo && !Number(z.tecnicos_activos) ? ' <span class="badge-estado estado-alerta">Sin cobertura</span>' : ""}</td>
                <td>${z.activo ? '<span class="badge-estado estado-final">Activa</span>' : '<span class="badge-estado estado-alerta">Inactiva</span>'}</td>
            </tr>`).join("") : '<tr><td colspan="3" class="vacio">No hay zonas.</td></tr>';
        etiquetarTabla(tablaZonas);
        tablaZonas.querySelectorAll("tr[data-id]").forEach((f) => f.addEventListener("click", () =>
            editarZona(zonas.find((z) => z.zona_id === Number(f.dataset.id)))));
    }

    function editarZona(z) {
        editandoZona = z ? z.zona_id : 0;
        document.getElementById("zona-titulo-form").textContent = z ? "Editar zona" : "Nueva zona";
        document.getElementById("zona-nombre").value = z ? z.nombre : "";
        document.getElementById("zona-palabras").value = z ? z.palabras_clave : "";
        document.getElementById("zona-activo").checked = z ? z.activo : true;
        pintarZonas();
        document.getElementById("zona-nombre").focus();
    }

    formZona.addEventListener("submit", async (e) => {
        e.preventDefault();
        const boton = formZona.querySelector("button[type=submit]");
        boton.disabled = true;
        const r = await llamarApi("gestion", {
            accion: "zona_guardar",
            zona_id: editandoZona,
            zona: document.getElementById("zona-nombre").value.trim(),
            palabras_clave: document.getElementById("zona-palabras").value.trim(),
            activo: document.getElementById("zona-activo").checked,
        });
        boton.disabled = false;
        if (r.success) {
            editandoZona = r.id;
            await cargar();
        }
        mostrarAviso(aviso, r.message, r.success ? "ok" : "error");
    });
});
