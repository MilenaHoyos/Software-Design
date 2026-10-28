/**
 * Agenda semanal (lunes a sábado) compartida por el técnico y la administración.
 * Las fechas se manejan en hora Colombia.
 */
function fechaBogota(fecha) {
    // "YYYY-MM-DD" de una fecha en hora Colombia
    return new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function sumarDias(isoDia, dias) {
    const d = new Date(`${isoDia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

function lunesDe(isoDia) {
    const d = new Date(`${isoDia}T12:00:00Z`);
    return sumarDias(isoDia, -((d.getUTCDay() + 6) % 7));
}

function crearAgenda({ contenedor, titulo, anterior, hoy, siguiente, cargar, alSeleccionar, mostrarTecnico = false }) {
    let lunes = lunesDe(fechaBogota(new Date()));

    async function pintar() {
        const sabado = sumarDias(lunes, 5);
        const formato = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
        titulo.textContent = `Semana del ${formato(lunes)} al ${formato(sabado)}`;
        contenedor.innerHTML = '<p class="card-description">Cargando agenda...</p>';
        const citas = await cargar(lunes, sumarDias(lunes, 6));
        if (citas === null) {
            contenedor.innerHTML = '<p class="aviso aviso-error">No se pudo cargar la agenda.</p>';
            return;
        }
        const hoyIso = fechaBogota(new Date());
        contenedor.innerHTML = [0, 1, 2, 3, 4, 5].map((n) => {
            const dia = sumarDias(lunes, n);
            const delDia = citas.filter((c) => fechaBogota(c.fecha_inicio) === dia);
            const nombreDia = new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', timeZone: 'UTC' });
            return `
                <div class="agenda-dia${dia === hoyIso ? ' hoy' : ''}">
                    <h4>${nombreDia}</h4>
                    ${delDia.length ? delDia.map((c) => `
                        <button type="button" class="agenda-cita${c.estado === 'Realizada' ? ' realizada' : ''}" data-ticket="${c.ticket_id}">
                            <strong>${new Date(c.fecha_inicio).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })} · #${c.ticket_id}</strong>
                            ${escapeHtml(c.nombre_completo)}<br>
                            ${etiquetaPrioridad(c.prioridad)} ${c.estado === 'Realizada' ? '✔ Realizada' : ''}
                            ${mostrarTecnico ? `<br><small>👷 ${escapeHtml(c.tecnico_nombre)} (${escapeHtml(c.cuadrante)})</small>` : ''}
                        </button>`).join('') : '<p class="agenda-vacio">Sin visitas</p>'}
                </div>`;
        }).join('');
        contenedor.querySelectorAll('.agenda-cita').forEach((b) => {
            b.addEventListener('click', () => alSeleccionar && alSeleccionar(Number(b.dataset.ticket)));
        });
    }

    anterior.addEventListener('click', () => { lunes = sumarDias(lunes, -7); pintar(); });
    siguiente.addEventListener('click', () => { lunes = sumarDias(lunes, 7); pintar(); });
    hoy.addEventListener('click', () => { lunes = lunesDe(fechaBogota(new Date())); pintar(); });
    return { recargar: pintar };
}
