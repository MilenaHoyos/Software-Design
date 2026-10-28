// Servidor de la plataforma de soporte técnico.
//  - Sirve la página (carpeta public/).
//  - Reenvía las peticiones de la página a los webhooks de n8n (el navegador nunca
//    habla directo con n8n y no hay problemas de CORS).
//  - Genera el acta PDF de cada visita, la guarda en una carpeta privada y solo la
//    entrega a quien tenga permiso (verificando que el archivo no fue modificado).
//  - Aplica límites de peticiones, cabeceras de seguridad y mide tiempos de respuesta.
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { generarActaPdf } = require('./acta-pdf');

const PORT = Number(process.env.PORT || 3000);
// Usa /webhook (flujos activos). Para depurar en el editor de n8n usa /webhook-test.
const N8N_WEBHOOK_URL = (process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook').replace(/\/$/, '');
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
// Carpeta privada de actas (no se sirve como archivos estáticos). Puede apuntar a un disco compartido.
const CARPETA_ACTAS = path.resolve(process.env.ACTAS_DIR || path.join(__dirname, 'actas'));

const SERVICIOS = {
    portal: 'soporte/portal-tecnico',
    solicitudes: 'soporte/solicitudes',
    chat: 'soporte/chat',
    logistica: 'soporte/logistica',
    operacion: 'soporte/operacion',
    gestion: 'soporte/gestion',
};
// Acciones que solo puede usar este servidor (para que el acta siempre se genere).
const ACCIONES_INTERNAS = ['registrar_resultado', 'datos_acta', 'adjuntar_acta'];

fs.mkdirSync(CARPETA_ACTAS, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

// ---------- rendimiento: tiempo de respuesta de cada petición ----------
app.use((req, res, next) => {
    const inicio = process.hrtime.bigint();
    const original = res.writeHead;
    res.writeHead = function (...args) {
        const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
        res.setHeader('X-Response-Time', `${ms.toFixed(1)}ms`);
        if (req.path.startsWith('/api/') && ms > 3000) {
            console.warn(`[lento] ${req.method} ${req.path} ${ms.toFixed(0)} ms`);
        }
        return original.apply(this, args);
    };
    next();
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'"],
            // En localhost (http) no se debe forzar https.
            upgradeInsecureRequests: null,
        },
    },
    hsts: PUBLIC_URL.startsWith('https://'),
}));
app.use(compression());
app.use(express.json({ limit: '200kb' }));

// ---------- límites de peticiones por IP ----------
const limiteGeneral = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.LIMITE_PETICIONES || 600),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, status: 'rate_limited', message: 'Demasiadas peticiones. Espera unos minutos.' },
});
const ACCIONES_SENSIBLES = ['login', 'register', 'forgot', 'reset_password'];
const limiteCuentas = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.LIMITE_CUENTAS || 30),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => !ACCIONES_SENSIBLES.includes(String(req.body?.action ?? req.body?.accion ?? '')),
    message: { success: false, status: 'rate_limited', message: 'Demasiados intentos desde este equipo. Espera 15 minutos.' },
});
app.use('/api/', limiteGeneral);

// ---------- conexión con n8n ----------
class ErrorN8n extends Error {}

async function llamarN8n(servicio, cuerpo) {
    const url = `${N8N_WEBHOOK_URL}/${SERVICIOS[servicio]}`;
    let respuesta;
    try {
        respuesta = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo),
            signal: AbortSignal.timeout(90000),
        });
    } catch (error) {
        throw new ErrorN8n(`No se pudo conectar con n8n en ${url} (${error.cause?.code || error.message}). `
            + '¿Está abierto n8n? ¿Es esa la dirección y el puerto con que abres n8n en el navegador?');
    }
    const texto = await respuesta.text();
    if (respuesta.status === 404) {
        throw new ErrorN8n(`n8n no tiene registrado el webhook ${url}. El flujo no está activo/publicado, `
            + 'o hay un flujo viejo con la misma ruta, o la URL de n8n es distinta.');
    }
    if (!respuesta.ok) {
        throw new ErrorN8n(`El flujo de ${SERVICIOS[servicio]} falló dentro de n8n (HTTP ${respuesta.status}). `
            + `Abre n8n → Executions y mira el nodo en rojo. Respuesta: ${texto.slice(0, 300)}`);
    }
    if (!texto) {
        throw new ErrorN8n(`El flujo de ${SERVICIOS[servicio]} terminó sin responder. `
            + 'Abre n8n → Executions y revisa en qué nodo se detuvo.');
    }
    try {
        return JSON.parse(texto);
    } catch (error) {
        throw new ErrorN8n(`n8n respondió algo que no es JSON: ${texto.slice(0, 200)}`);
    }
}

function responderError(res, contexto, error) {
    console.error(`[${contexto}]`, error.message);
    res.status(502).json({
        success: false,
        status: 'n8n_error',
        message: error instanceof ErrorN8n
            ? error.message
            : 'El servidor de automatización (n8n) no respondió. Revisa que esté encendido y que los flujos estén activos.',
    });
}

// ---------- actas PDF ----------
// Pide los datos del acta a n8n, genera el PDF, lo guarda y lo asocia al ticket (n8n lo envía al cliente).
async function generarYGuardarActa(sessionToken, ticketId) {
    const datos = await llamarN8n('operacion', { accion: 'datos_acta', session_token: sessionToken, ticket_id: ticketId });
    if (!datos.success) return datos;

    const pdf = await generarActaPdf(datos.data);
    const sha256 = crypto.createHash('sha256').update(pdf).digest('hex');
    const archivo = `ticket-${Number(ticketId)}-${crypto.randomBytes(12).toString('hex')}.pdf`;
    await fs.promises.writeFile(path.join(CARPETA_ACTAS, archivo), pdf, { flag: 'wx' });

    const adjunto = await llamarN8n('operacion', {
        accion: 'adjuntar_acta', session_token: sessionToken, ticket_id: ticketId,
        archivo, sha256, pdf_base64: pdf.toString('base64'),
    });
    if (!adjunto.success) {
        await fs.promises.unlink(path.join(CARPETA_ACTAS, archivo)).catch(() => {});
        return adjunto;
    }
    return { success: true, archivo, sha256 };
}

// Registro del resultado de la visita + generación automática del acta
app.post('/api/visitas/resultado', async (req, res) => {
    try {
        const cuerpo = { ...req.body, accion: 'registrar_resultado' };
        cacheIndicadores.clear();
        const registro = await llamarN8n('operacion', cuerpo);
        if (!registro.success) return res.json(registro);

        const acta = await generarYGuardarActa(cuerpo.session_token, cuerpo.ticket_id);
        res.json({
            success: true,
            status: 'ok',
            ticket_id: registro.ticket_id,
            estado: registro.estado,
            acta_generada: acta.success,
            message: acta.success
                ? 'Resultado registrado. El acta PDF se generó y se envió al cliente.'
                : `Resultado registrado, pero el acta no se pudo generar: ${acta.message || 'error desconocido'}. Usa "Regenerar acta".`,
        });
    } catch (error) {
        responderError(res, 'visitas', error);
    }
});

// Regenerar el acta (técnico de la visita o admin)
app.post('/api/actas/generar', async (req, res) => {
    try {
        const acta = await generarYGuardarActa(req.body.session_token, req.body.ticket_id);
        res.json(acta.success ? { success: true, status: 'ok', message: 'Acta generada y enviada al cliente.' } : acta);
    } catch (error) {
        responderError(res, 'actas', error);
    }
});

// Descarga segura: solo con sesión y permiso sobre el ticket; se verifica la huella SHA-256.
app.post('/api/actas/descargar', async (req, res) => {
    try {
        const detalle = await llamarN8n('portal', {
            action: 'detalle_ticket', session_token: req.body.session_token, ticket_id: req.body.ticket_id,
        });
        if (!detalle.success) return res.status(403).json(detalle);
        const { archivo_acta: archivo, acta_sha256: huella, ticket_id: ticketId } = detalle.data;
        if (!archivo || !/^ticket-\d+-[0-9a-f]{24}\.pdf$/.test(archivo)) {
            return res.status(404).json({ success: false, status: 'not_found', message: 'Este ticket todavía no tiene acta.' });
        }
        const contenido = await fs.promises.readFile(path.join(CARPETA_ACTAS, archivo)).catch(() => null);
        if (!contenido) {
            return res.status(404).json({ success: false, status: 'not_found', message: 'No se encontró el archivo del acta.' });
        }
        const calculada = crypto.createHash('sha256').update(contenido).digest('hex');
        if (huella && calculada !== huella.trim()) {
            console.error(`[actas] huella distinta para ${archivo}`);
            return res.status(409).json({ success: false, status: 'tampered', message: 'El acta guardada no coincide con la original. Avisa a administración.' });
        }
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="acta-servicio-ticket-${ticketId}.pdf"`,
            'Cache-Control': 'private, no-store',
            'X-Acta-SHA256': calculada,
        });
        res.send(contenido);
    } catch (error) {
        responderError(res, 'actas', error);
    }
});

// Estado del sistema (para monitoreo y para la página de inicio)
app.get('/api/estado', async (req, res) => {
    const inicio = Date.now();
    let n8n = 'ok';
    try {
        const base = new URL(N8N_WEBHOOK_URL);
        const r = await fetch(`${base.origin}/healthz`, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) n8n = `HTTP ${r.status}`;
    } catch (error) {
        n8n = 'sin conexión';
    }
    res.json({ success: n8n === 'ok', servidor: 'ok', n8n, tiempo_ms: Date.now() - inicio });
});

// Reenvío general hacia n8n
app.post('/api/:servicio', limiteCuentas, async (req, res) => {
    const { servicio } = req.params;
    if (!SERVICIOS[servicio]) {
        return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
    }
    const accion = String(req.body?.accion ?? req.body?.action ?? '');
    if (servicio === 'operacion' && ACCIONES_INTERNAS.includes(accion)) {
        return res.status(403).json({ success: false, status: 'forbidden', message: 'Esta acción se hace desde el formulario de resultado de visita.' });
    }
    if (!ACCIONES_SOLO_LECTURA.includes(accion)) cacheIndicadores.clear();
    try {
        // Los indicadores gerenciales se guardan 30 s: muchos administradores mirando el
        // dashboard no recalculan todo cada vez (solo se cachea si la sesión es válida).
        if (servicio === 'gestion' && accion === 'dashboard') {
            const clave = `${req.body.session_token}|${req.body.desde || ''}|${req.body.hasta || ''}`;
            const guardado = cacheIndicadores.get(clave);
            if (guardado && guardado.vence > Date.now()) {
                res.set('X-Cache', 'HIT');
                return res.json(guardado.datos);
            }
            const datos = await llamarN8n(servicio, { ...req.body, ip_cliente: req.ip });
            if (datos.success) {
                if (cacheIndicadores.size > 500) cacheIndicadores.clear();
                cacheIndicadores.set(clave, { datos, vence: Date.now() + 30000 });
            }
            return res.json(datos);
        }
        res.json(await llamarN8n(servicio, { ...req.body, ip_cliente: req.ip }));
    } catch (error) {
        responderError(res, servicio, error);
    }
});
const cacheIndicadores = new Map();
// Consultas que no cambian datos (cualquier otra acción vacía la caché de indicadores)
const ACCIONES_SOLO_LECTURA = ['dashboard', 'me', 'mis_tickets', 'detalle_ticket', 'kb_buscar', 'cola_tecnico', 'agenda',
    'horarios_libres', 'tickets_admin', 'trazabilidad', 'accesos', 'kb_listar', 'monitoreo', 'tecnicos_listar', 'zonas'];

app.get('/', (req, res) => res.redirect('/loginVentana.html'));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m' }));

app.listen(PORT, () => {
    console.log(`Plataforma de soporte en ${PUBLIC_URL}`);
    console.log(`Reenviando peticiones a n8n en ${N8N_WEBHOOK_URL}`);
    console.log(`Actas PDF en ${CARPETA_ACTAS}`);
});
