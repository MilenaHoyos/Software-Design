/**
 * Utilidades compartidas por todas las ventanas: sesión, llamadas a la API,
 * menú superior y formato de datos.
 */
const API_URL = '/api';
const PAGINA_POR_ROL = {
    cliente: 'homeVentana.html',
    tecnico: 'tecnicoVentana.html',
    admin: 'dashboardVentana.html',
};
const ESTADOS_FINALES = ['Cerrado', 'Resuelto IA', 'Cancelado'];
const ESTADOS_ESPERANDO = ['Pendiente', 'En diagnóstico', 'Escalamiento pendiente', 'Escalado nivel 2', 'Pendiente de asignación'];

// ==========================================
// Sesión (guardada en el navegador)
// ==========================================
function leerLocal(clave) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
}
function escribirLocal(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ }
}
function borrarLocal(clave) {
    try { localStorage.removeItem(clave); } catch (e) { /* sin almacenamiento */ }
}

const Sesion = {
    token() {
        return leerLocal('session_token');
    },
    usuario() {
        try { return JSON.parse(leerLocal('user')); } catch (e) { return null; }
    },
    guardar(token, usuario) {
        escribirLocal('session_token', token);
        escribirLocal('user', JSON.stringify(usuario));
    },
    cerrar() {
        ['session_token', 'user', 'ticket_id'].forEach(borrarLocal);
    },
};

// ==========================================
// Llamadas al servidor (server.js las reenvía a n8n)
// ==========================================
async function llamarApi(servicio, datos = {}) {
    const cuerpo = { ...datos };
    const token = Sesion.token();
    if (token) cuerpo.session_token = token;

    let resultado;
    try {
        const respuesta = await fetch(`${API_URL}/${servicio}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo),
        });
        resultado = await respuesta.json();
    } catch (error) {
        console.error('Error de conexión:', error);
        return { success: false, status: 'network', message: 'No se pudo conectar con el servidor. Revisa que server.js y n8n estén encendidos.' };
    }

    if (resultado.status === 'unauthorized' && token) {
        Sesion.cerrar();
        window.location.href = `loginVentana.html?expirada=1&volver=${encodeURIComponent(paginaActual())}`;
    }
    return resultado;
}

// Rutas propias de server.js (resultado de visita con acta PDF)
async function llamarServidor(ruta, datos = {}) {
    try {
        const respuesta = await fetch(`${API_URL}/${ruta}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...datos, session_token: Sesion.token() }),
        });
        return await respuesta.json();
    } catch (error) {
        return { success: false, status: 'network', message: 'No se pudo conectar con el servidor.' };
    }
}

// Descarga segura del acta: el servidor revisa la sesión, el permiso y la huella del archivo.
async function descargarActa(ticketId, aviso) {
    try {
        const respuesta = await fetch(`${API_URL}/actas/descargar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_token: Sesion.token(), ticket_id: ticketId }),
        });
        if (!respuesta.ok) {
            const error = await respuesta.json().catch(() => ({}));
            mostrarAviso(aviso, error.message || 'No se pudo descargar el acta.');
            return;
        }
        const blob = await respuesta.blob();
        const enlace = document.createElement('a');
        enlace.href = URL.createObjectURL(blob);
        enlace.download = `acta-servicio-ticket-${ticketId}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
    } catch (error) {
        mostrarAviso(aviso, 'No se pudo descargar el acta.');
    }
}

function paginaActual() {
    return window.location.pathname.split('/').pop() + window.location.search;
}

// Redirige al login si no hay sesión, o a la página del rol si no tiene permiso.
function requerirSesion(rolesPermitidos) {
    const usuario = Sesion.usuario();
    if (!Sesion.token() || !usuario) {
        window.location.replace(`loginVentana.html?volver=${encodeURIComponent(paginaActual())}`);
        return null;
    }
    if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
        window.location.replace(PAGINA_POR_ROL[usuario.rol] || 'loginVentana.html');
        return null;
    }
    return usuario;
}

async function cerrarSesion() {
    await llamarApi('portal', { accion: 'logout' });
    Sesion.cerrar();
    window.location.href = 'loginVentana.html';
}

// ==========================================
// Menú superior: enlaces según el rol, nombre, salir e indicador animado
// ==========================================
function prepararMenu(usuario) {
    const inicio = document.querySelector('[data-nav="inicio"]');
    if (inicio) inicio.href = PAGINA_POR_ROL[usuario.rol] || 'homeVentana.html';

    const panel = document.querySelector('[data-nav="dashboard"]');
    if (panel) {
        const destino = { admin: 'dashboardVentana.html', tecnico: 'tecnicoVentana.html', cliente: 'misTickets.html' };
        const textos = { admin: 'Dashboard', tecnico: 'Mis visitas', cliente: 'Mis tickets' };
        panel.href = destino[usuario.rol];
        const icono = panel.querySelector('img');
        panel.textContent = ' ' + textos[usuario.rol];
        if (icono) panel.prepend(icono);
    }

    // Administración: accesos a trazabilidad y base de conocimiento en lugar de "Ajustes"
    const ajustes = document.querySelector('.nav-link[title="Próximamente"]');
    if (usuario.rol === 'admin' && ajustes) {
        const actual = window.location.pathname.split('/').pop();
        [['trazabilidadVentana.html', 'Trazabilidad', 'Iconos/HomeNegro.png'],
         ['tecnicosVentana.html', 'Técnicos', 'Iconos/usuariGris.png'],
         ['conocimientoVentana.html', 'Conocimiento', 'Iconos/ajustes.png']].forEach(([href, texto, icono]) => {
            const enlace = document.createElement('a');
            enlace.href = href;
            enlace.className = 'nav-link' + (actual === href ? ' active' : '');
            enlace.innerHTML = `<img width="30" height="30" src="${icono}" alt="" class="custom-icon"> ${texto}`;
            ajustes.before(enlace);
        });
        ajustes.remove();
        if (['trazabilidadVentana.html', 'tecnicosVentana.html', 'conocimientoVentana.html'].includes(actual)) {
            document.querySelectorAll('.nav-link').forEach((l) => { if (!l.href.endsWith(actual)) l.classList.remove('active'); });
        }
    }

    document.querySelectorAll('.user-name').forEach((el) => { el.textContent = usuario.nombre || 'Usuario'; });

    const pie = document.querySelector('.sidebar-footer');
    if (pie && !pie.querySelector('.btn-logout')) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn-logout';
        boton.textContent = 'Salir';
        boton.addEventListener('click', cerrarSesion);
        pie.appendChild(boton);
    }
    iniciarIndicadorMenu();
}

function iniciarIndicadorMenu() {
    const menu = document.querySelector('.nav-menu');
    const indicador = document.querySelector('.nav-indicator');
    const enlaces = document.querySelectorAll('.nav-link');
    if (!menu) return;

    const transicion = 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), width 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease';
    function mover(elemento, animado = true) {
        if (!elemento || !indicador) return;
        const rMenu = menu.getBoundingClientRect();
        const rEnlace = elemento.getBoundingClientRect();
        indicador.style.transition = animado ? transicion : 'none';
        indicador.style.width = `${rEnlace.width}px`;
        indicador.style.transform = `translateX(${rEnlace.left - rMenu.left}px)`;
        indicador.style.opacity = '1';
    }

    const activo = () => document.querySelector('.nav-link.active');
    mover(activo(), false);
    window.addEventListener('load', () => mover(activo(), false));
    window.addEventListener('resize', () => mover(activo(), false));

    enlaces.forEach((enlace) => {
        enlace.addEventListener('click', (e) => {
            const destino = enlace.getAttribute('href');
            if (!destino || destino === '#') {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            enlaces.forEach((l) => l.classList.remove('active'));
            enlace.classList.add('active');
            mover(enlace);
            setTimeout(() => { window.location.href = destino; }, 220);
        });
    });
}

// ==========================================
// Formato
// ==========================================
function escapeHtml(texto) {
    const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(texto ?? '').replace(/[&<>"']/g, (c) => mapa[c]);
}

// Texto de la IA: se escapa y se permite **negrita** y saltos de línea.
function formatearTextoIA(texto) {
    return escapeHtml(texto).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function formatearFecha(fecha, conHora = true) {
    if (!fecha) return '—';
    const opciones = conHora ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
    return new Date(fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota', ...opciones });
}

function claseEstado(estado) {
    if (ESTADOS_FINALES.includes(estado)) return 'estado-final';
    if (['Escalamiento pendiente', 'Escalado nivel 2', 'Pendiente de asignación'].includes(estado)) return 'estado-alerta';
    if (['Agendado', 'En atención'].includes(estado)) return 'estado-agenda';
    return 'estado-activo';
}

function etiquetaEstado(estado) {
    return `<span class="badge-estado ${claseEstado(estado)}">${escapeHtml(estado || '—')}</span>`;
}

// Historial del chat de un ticket (detalle_ticket)
function pintarHistorial(historial) {
    if (!historial || !historial.length) return `<p class="card-description">Sin mensajes.</p>`;
    const nombres = { usuario: "Cliente", IA: "Asistente IA", sistema: "Sistema" };
    return `<ul class="historial">${historial.map((h) => `
        <li class="emisor-${escapeHtml(h.emisor)}">
            <span class="quien">${escapeHtml(nombres[h.emisor] || h.emisor)} · ${formatearFecha(h.fecha)}</span>
            ${formatearTextoIA(h.mensaje)}
        </li>`).join("")}</ul>`;
}

// Prioridad: ícono + texto (nunca solo color)
function etiquetaPrioridad(prioridad) {
    if (!prioridad) return '';
    const iconos = { 'Crítica': '▲▲', 'Alta': '▲', 'Media': '■', 'Baja': '▽' };
    const clase = { 'Crítica': 'prio-critica', 'Alta': 'prio-alta', 'Media': 'prio-media', 'Baja': 'prio-baja' }[prioridad] || 'prio-media';
    return `<span class="badge-prioridad ${clase}" title="Prioridad ${escapeHtml(prioridad)}"><span aria-hidden="true">${iconos[prioridad] || ''}</span> ${escapeHtml(prioridad)}</span>`;
}

function etiquetaSla(vencido) {
    return vencido ? '<span class="badge-sla" title="Superó su tiempo límite de atención">⏱ SLA vencido</span>' : '';
}

// Etiquetas de columna en cada celda: en celular las tablas se muestran como tarjetas
function etiquetarTabla(tabla) {
    const titulos = [...tabla.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    tabla.querySelectorAll('tbody tr').forEach((fila) => {
        [...fila.children].forEach((celda, i) => {
            if (titulos[i] && !celda.hasAttribute('colspan')) celda.dataset.label = titulos[i];
        });
    });
}

// Línea de tiempo (auditoría) del ticket
const NOMBRES_ACCION = {
    ticket_creado: 'Ticket creado', confirmacion_solucion: 'Cliente confirmó la solución de la IA',
    escalamiento_solicitado: 'Caso escalado a soporte humano', cita_agendada: 'Visita agendada automáticamente',
    sin_cupo: 'Sin cupo: queda pendiente de asignación', escalamiento_nivel_2: 'Escalado a soporte nivel 2',
    asignacion_manual: 'Técnico asignado por administración', inicio_visita: 'El técnico llegó a la visita',
    resultado_visita: 'Resultado de la visita registrado', acta_generada: 'Acta PDF generada',
    encuesta_confirma_solucion: 'Cliente confirmó la solución en la encuesta', encuesta_reabre_caso: 'Cliente reabrió el caso en la encuesta',
    cierre_automatico: 'Cierre automático por falta de respuesta', cierre_por_inactividad: 'Cerrado por inactividad',
    cambio_estado: 'Cambio de estado', cierre_tecnico: 'Cierre técnico',
};
function pintarLineaTiempo(eventos) {
    if (!eventos || !eventos.length) return '<p class="card-description">Sin eventos registrados.</p>';
    return `<ol class="linea-tiempo">${eventos.map((e) => `
        <li>
            <span class="lt-fecha">${formatearFecha(e.fecha)}</span>
            <span class="lt-titulo">${escapeHtml(NOMBRES_ACCION[e.accion] || e.accion || e.titulo)}</span>
            ${e.estado_nuevo ? `<span class="lt-estado">${e.estado_anterior ? escapeHtml(e.estado_anterior) + ' → ' : ''}${escapeHtml(e.estado_nuevo)}</span>` : ''}
            ${e.actor ? `<span class="lt-actor">${escapeHtml(e.actor)}</span>` : ''}
        </li>`).join('')}</ol>`;
}

// Encuesta de satisfacción: ¿se resolvió? + estrellas + comentario
function pintarEncuesta(contenedor, ticketId, { titulo = '¿Se resolvió tu problema?', alTerminar } = {}) {
    contenedor.innerHTML = `
        <form class="encuesta" novalidate>
            <h3>${escapeHtml(titulo)}</h3>
            <div class="encuesta-opciones" role="radiogroup" aria-label="¿Se resolvió el problema?">
                <label><input type="radio" name="resuelto" value="true" required> Sí, quedó resuelto</label>
                <label><input type="radio" name="resuelto" value="false"> No, sigue fallando</label>
            </div>
            <fieldset class="estrellas">
                <legend>¿Cómo calificas la atención?</legend>
                <div class="estrellas-fila">
                    ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="estrella-${ticketId}-${n}" name="calificacion" value="${n}">
                    <label for="estrella-${ticketId}-${n}" title="${n} de 5">★</label>`).join('')}
                </div>
            </fieldset>
            <label class="encuesta-comentario">Comentario (opcional)
                <textarea class="campo" name="comentario" rows="2" maxlength="1000" placeholder="Cuéntanos qué tal fue la atención"></textarea>
            </label>
            <p class="aviso" hidden></p>
            <button type="submit" class="btn">Enviar respuesta</button>
        </form>`;
    const form = contenedor.querySelector('form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const aviso = form.querySelector('.aviso');
        const resuelto = form.querySelector('input[name="resuelto"]:checked');
        const calificacion = form.querySelector('input[name="calificacion"]:checked');
        if (!resuelto) return mostrarAviso(aviso, 'Indica si el problema quedó resuelto.');
        if (!calificacion) return mostrarAviso(aviso, 'Elige una calificación de 1 a 5 estrellas.');
        const boton = form.querySelector('button');
        boton.disabled = true;
        const r = await llamarApi('portal', {
            accion: 'responder_encuesta', ticket_id: ticketId,
            resuelto: resuelto.value === 'true', calificacion: Number(calificacion.value),
            comentario: form.comentario.value,
        });
        boton.disabled = false;
        if (!r.success) return mostrarAviso(aviso, r.message || 'No se pudo enviar la encuesta.');
        contenedor.innerHTML = `<p class="aviso aviso-ok">${escapeHtml(r.message)}</p>`;
        if (alTerminar) alTerminar(r);
    });
}

function mostrarAviso(elemento, mensaje, tipo = 'error') {
    if (!elemento) { alert(mensaje); return; }
    elemento.textContent = mensaje;
    elemento.className = `aviso aviso-${tipo}`;
    elemento.hidden = !mensaje;
}
