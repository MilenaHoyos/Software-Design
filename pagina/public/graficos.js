/**
 * Gráficos simples sin librerías (compatibles con la política de seguridad del servidor).
 *  - graficoLineas: series en el tiempo, con cruz y tooltip al pasar el mouse.
 *  - graficoBarras: magnitudes por categoría, un solo color, con valor visible.
 */
let tooltipGrafico = null;
function mostrarTooltip(html, x, y) {
    if (!tooltipGrafico) {
        tooltipGrafico = document.createElement('div');
        tooltipGrafico.className = 'tooltip-grafico';
        document.body.appendChild(tooltipGrafico);
    }
    tooltipGrafico.innerHTML = html;
    tooltipGrafico.hidden = false;
    const ancho = tooltipGrafico.offsetWidth;
    tooltipGrafico.style.left = `${Math.min(x + 14, window.innerWidth - ancho - 8)}px`;
    tooltipGrafico.style.top = `${y + 14}px`;
}
function ocultarTooltip() { if (tooltipGrafico) tooltipGrafico.hidden = true; }

function maximoRedondo(valor) {
    if (valor <= 4) return 4;
    const paso = Math.pow(10, Math.floor(Math.log10(valor)));
    return Math.ceil(valor / paso) * paso;
}

// puntos: [{ etiqueta, ...valores }], series: [{ clave, nombre, color }]
function graficoLineas(contenedor, puntos, series) {
    const W = 640, H = 220, M = { arriba: 12, derecha: 70, abajo: 26, izquierda: 34 };
    const ancho = W - M.izquierda - M.derecha, alto = H - M.arriba - M.abajo;
    const max = maximoRedondo(Math.max(1, ...puntos.flatMap((p) => series.map((s) => Number(p[s.clave]) || 0))));
    const x = (i) => M.izquierda + (puntos.length <= 1 ? ancho / 2 : (i * ancho) / (puntos.length - 1));
    const y = (v) => M.arriba + alto - (v / max) * alto;
    const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
    const pasoEtiqueta = Math.max(1, Math.ceil(puntos.length / 6));

    const grilla = marcas.map((v) => `
        <line x1="${M.izquierda}" x2="${M.izquierda + ancho}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grilla)" stroke-width="1"/>
        <text class="eje" x="${M.izquierda - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
    const etiquetasX = puntos.map((p, i) => (i % pasoEtiqueta === 0 || i === puntos.length - 1)
        ? `<text class="eje" x="${x(i)}" y="${H - 6}" text-anchor="middle">${escapeHtml(p.etiqueta)}</text>` : '').join('');
    const lineas = series.map((s) => {
        const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(p[s.clave]) || 0).toFixed(1)}`).join(' ');
        const ultimo = puntos[puntos.length - 1] || {};
        return `<path d="${d}" fill="none" style="stroke: ${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
            <text class="valor" x="${x(puntos.length - 1) + 8}" y="${y(Number(ultimo[s.clave]) || 0) + 4}">${escapeHtml(s.nombre)} ${Number(ultimo[s.clave]) || 0}</text>`;
    }).join('');

    contenedor.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de líneas: ${series.map((s) => s.nombre).join(' y ')} por día">
            ${grilla}${etiquetasX}${lineas}
            <line class="cruz" y1="${M.arriba}" y2="${M.arriba + alto}" stroke="#9aabbd" stroke-width="1" stroke-dasharray="3 3" visibility="hidden"/>
            ${series.map((s, k) => `<circle class="punto-${k}" r="5" style="fill: ${s.color}" stroke="#fff" stroke-width="2" visibility="hidden"/>`).join('')}
            <rect class="zona" x="${M.izquierda}" y="${M.arriba}" width="${ancho}" height="${alto}" fill="transparent"/>
        </svg>`;

    const svg = contenedor.querySelector('svg');
    const cruz = svg.querySelector('.cruz');
    svg.querySelector('.zona').addEventListener('mousemove', (e) => {
        const caja = svg.getBoundingClientRect();
        const xSvg = ((e.clientX - caja.left) / caja.width) * W;
        const i = Math.max(0, Math.min(puntos.length - 1, Math.round(((xSvg - M.izquierda) / ancho) * (puntos.length - 1))));
        const p = puntos[i];
        cruz.setAttribute('x1', x(i)); cruz.setAttribute('x2', x(i)); cruz.setAttribute('visibility', 'visible');
        series.forEach((s, k) => {
            const c = svg.querySelector(`.punto-${k}`);
            c.setAttribute('cx', x(i)); c.setAttribute('cy', y(Number(p[s.clave]) || 0)); c.setAttribute('visibility', 'visible');
        });
        mostrarTooltip(`<strong>${escapeHtml(p.etiqueta)}</strong><br>${series.map((s) =>
            `<span style="color:${s.color}">●</span> ${escapeHtml(s.nombre)}: ${Number(p[s.clave]) || 0}`).join('<br>')}`, e.clientX, e.clientY);
    });
    svg.querySelector('.zona').addEventListener('mouseleave', () => {
        cruz.setAttribute('visibility', 'hidden');
        svg.querySelectorAll('circle').forEach((c) => c.setAttribute('visibility', 'hidden'));
        ocultarTooltip();
    });
}

// datos: { categoria: valor }, orden: lista opcional de categorías
function graficoBarras(contenedor, datos, orden) {
    const claves = orden ? orden.filter((k) => k in datos).concat(Object.keys(datos).filter((k) => !orden.includes(k)))
                         : Object.keys(datos).sort((a, b) => datos[b] - datos[a]);
    if (!claves.length) {
        contenedor.innerHTML = '<p class="card-description">Sin datos en el periodo.</p>';
        return;
    }
    const max = Math.max(1, ...claves.map((k) => Number(datos[k]) || 0));
    const total = claves.reduce((s, k) => s + (Number(datos[k]) || 0), 0);
    contenedor.innerHTML = claves.map((k) => {
        const v = Number(datos[k]) || 0;
        return `<div class="barra-fila" data-titulo="${escapeHtml(k)}" data-valor="${v}" data-pct="${total ? Math.round((100 * v) / total) : 0}">
            <span class="nombre" title="${escapeHtml(k)}">${escapeHtml(k)}</span>
            <span class="pista"><span class="relleno" style="width:${(100 * v) / max}%"></span></span>
            <span class="num">${v}</span>
        </div>`;
    }).join('');
    contenedor.querySelectorAll('.barra-fila').forEach((fila) => {
        fila.addEventListener('mousemove', (e) => mostrarTooltip(
            `<strong>${fila.dataset.titulo}</strong><br>${fila.dataset.valor} tickets · ${fila.dataset.pct}%`, e.clientX, e.clientY));
        fila.addEventListener('mouseleave', ocultarTooltip);
    });
}
