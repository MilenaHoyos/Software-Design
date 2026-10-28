// Genera el acta de servicio técnico en PDF a partir del resultado de la visita.
const PDFDocument = require('pdfkit');

const COLOR_TITULO = '#102a43';
const COLOR_TEXTO = '#172b4d';
const COLOR_SUAVE = '#61738a';
const COLOR_LINEA = '#d9e2ec';
const COLOR_RESULTADO = { Resuelto: '#16834b', 'Requiere nueva visita': '#8a5300', 'No resuelto': '#b42318' };

// Las fuentes estándar del PDF solo tienen caracteres latinos: se reemplaza lo demás (emojis, etc.).
function limpiar(valor) {
    return String(valor ?? '').replace(/[^\u0009\u000a\u000d -ÿ–—‘’“”•…]/g, '');
}

function fecha(valor) {
    if (!valor) return '—';
    return new Date(valor).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' });
}

function duracion(inicio, fin) {
    if (!inicio || !fin) return '—';
    const minutos = Math.max(0, Math.round((new Date(fin) - new Date(inicio)) / 60000));
    return minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`;
}

function generarActaPdf(d) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: 50, bottom: 60, left: 55, right: 55 },
            info: {
                Title: `Acta de servicio técnico - Ticket ${d.ticket_id}`,
                Author: 'Plataforma de Soporte Técnico',
                Subject: 'Acta de servicio técnico',
                CreationDate: new Date(),
            },
        });
        const partes = [];
        doc.on('data', (p) => partes.push(p));
        doc.on('end', () => resolve(Buffer.concat(partes)));
        doc.on('error', reject);

        const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const izq = doc.page.margins.left;

        // Encabezado
        doc.rect(0, 0, doc.page.width, 92).fill(COLOR_TITULO);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(19).text('ACTA DE SERVICIO TÉCNICO', izq, 30);
        doc.font('Helvetica').fontSize(10).text('Plataforma Inteligente de Soporte Técnico', izq, 55);
        doc.font('Helvetica-Bold').fontSize(14).text(`Ticket #${d.ticket_id}`, izq, 30, { width: ancho, align: 'right' });
        doc.font('Helvetica').fontSize(9).text(`Emitida: ${fecha(new Date())}`, izq, 55, { width: ancho, align: 'right' });
        doc.y = 112;

        const seccion = (titulo) => {
            if (doc.y > doc.page.height - 140) doc.addPage();
            doc.moveDown(0.6);
            doc.fillColor(COLOR_TITULO).font('Helvetica-Bold').fontSize(11).text(limpiar(titulo).toUpperCase(), izq);
            const y = doc.y + 2;
            doc.moveTo(izq, y).lineTo(izq + ancho, y).lineWidth(0.8).strokeColor(COLOR_LINEA).stroke();
            doc.moveDown(0.5);
        };
        const campos = (pares) => {
            const col = ancho / 2;
            for (let i = 0; i < pares.length; i += 2) {
                const y = doc.y;
                let alto = 0;
                [pares[i], pares[i + 1]].forEach((par, k) => {
                    if (!par) return;
                    const x = izq + k * col;
                    doc.fillColor(COLOR_SUAVE).font('Helvetica').fontSize(8).text(limpiar(par[0]), x, y, { width: col - 12 });
                    doc.fillColor(COLOR_TEXTO).font('Helvetica').fontSize(10).text(limpiar(par[1]) || '—', x, doc.y, { width: col - 12 });
                    alto = Math.max(alto, doc.y - y);
                });
                doc.y = y + alto + 6;
            }
        };
        const parrafo = (texto) => {
            doc.fillColor(COLOR_TEXTO).font('Helvetica').fontSize(10).text(limpiar(texto) || '—', izq, doc.y, { width: ancho, align: 'left' });
        };

        seccion('Datos del cliente');
        campos([
            ['Nombre', d.nombre_completo], ['Identificación', d.identificacion],
            ['Teléfono', d.telefono], ['Correo electrónico', d.correo],
            ['Dirección de la visita', d.direccion], ['Dispositivo', d.tipo_dispositivo || 'No especificado'],
        ]);

        seccion('Datos del servicio');
        campos([
            ['Técnico', d.tecnico_nombre], ['Zona', d.cuadrante],
            ['Fecha programada', fecha(d.fecha_programada)], ['Prioridad', d.prioridad],
            ['Hora de llegada', fecha(d.hora_llegada)], ['Hora de salida', fecha(d.hora_salida)],
            ['Duración de la visita', duracion(d.hora_llegada, d.hora_salida)], ['Categoría', d.categoria],
        ]);

        seccion('Problema reportado por el cliente');
        parrafo(d.descripcion_problema);
        seccion('Diagnóstico');
        parrafo(d.diagnostico);
        seccion('Trabajo realizado');
        parrafo(d.trabajo_realizado);
        seccion('Repuestos y materiales');
        parrafo(d.repuestos || 'Ninguno');
        if (d.observaciones) {
            seccion('Observaciones');
            parrafo(d.observaciones);
        }

        // Resultado destacado
        if (doc.y > doc.page.height - 200) doc.addPage();
        doc.moveDown(1);
        const yRes = doc.y;
        const color = COLOR_RESULTADO[d.resultado] || COLOR_TITULO;
        doc.roundedRect(izq, yRes, ancho, 40, 6).lineWidth(1.2).strokeColor(color).stroke();
        doc.fillColor(COLOR_SUAVE).font('Helvetica').fontSize(8).text('RESULTADO DE LA VISITA', izq + 14, yRes + 8);
        doc.fillColor(color).font('Helvetica-Bold').fontSize(13).text(limpiar(d.resultado), izq + 14, yRes + 19);
        doc.y = yRes + 58;

        // Firmas
        doc.moveDown(2.5);
        const yFirma = doc.y;
        const anchoFirma = ancho / 2 - 30;
        [['Firma del técnico', d.tecnico_nombre], ['Firma del cliente', d.nombre_completo]].forEach(([titulo, nombre], k) => {
            const x = izq + k * (ancho / 2 + 30);
            doc.moveTo(x, yFirma).lineTo(x + anchoFirma, yFirma).lineWidth(0.8).strokeColor(COLOR_SUAVE).stroke();
            doc.fillColor(COLOR_TEXTO).font('Helvetica-Bold').fontSize(9).text(limpiar(titulo), x, yFirma + 6, { width: anchoFirma });
            doc.fillColor(COLOR_SUAVE).font('Helvetica').fontSize(9).text(limpiar(nombre), x, doc.y, { width: anchoFirma });
        });

        // Pie de página
        const pie = `Documento generado automáticamente. Registro de visita RV-${d.resultado_id} · Ticket #${d.ticket_id}. `
            + 'La integridad del archivo se verifica con su huella SHA-256 registrada en la plataforma.';
        // Sin margen inferior para que el pie no abra una página nueva
        doc.page.margins.bottom = 0;
        doc.fillColor(COLOR_SUAVE).font('Helvetica').fontSize(7.5)
            .text(limpiar(pie), izq, doc.page.height - 45, { width: ancho, align: 'center' });
        doc.end();
    });
}

module.exports = { generarActaPdf };
