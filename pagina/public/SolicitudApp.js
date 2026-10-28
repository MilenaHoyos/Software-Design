document.addEventListener("DOMContentLoaded", () => {
    const usuario = requerirSesion();
    if (!usuario) return;
    prepararMenu(usuario);

    const soporteForm = document.getElementById("soporte-form");
    const aviso = document.getElementById("solicitud-aviso");

    // Datos de la cuenta: el ticket queda ligado al correo con el que se inició sesión
    document.getElementById("nombre").value = usuario.nombre || "";
    document.getElementById("correo").value = usuario.correo || "";

    // Sugerencias de la base de conocimiento mientras se describe el problema
    const descripcion = document.getElementById("descripcion");
    const sugerencias = document.getElementById("sugerencias");
    let espera = null;
    let ultimaBusqueda = "";
    descripcion.addEventListener("input", () => {
        clearTimeout(espera);
        espera = setTimeout(buscarSugerencias, 600);
    });
    async function buscarSugerencias() {
        const q = descripcion.value.trim();
        if (q.length < 12 || q === ultimaBusqueda) return;
        ultimaBusqueda = q;
        const r = await llamarApi("portal", { accion: "kb_buscar", q });
        const articulos = r.success ? (r.articulos || []).slice(0, 3) : [];
        sugerencias.hidden = !articulos.length;
        sugerencias.innerHTML = articulos.length ? `
            <h4>💡 Antes de enviar, quizá esto te ayude:</h4>
            ${articulos.map((a) => `<details><summary>${escapeHtml(a.titulo)}</summary><p>${escapeHtml(a.contenido)}</p></details>`).join("")}
            <p>Si no se soluciona, envía el reporte y el asistente te ayudará paso a paso.</p>` : "";
    }

    // Capturar el envío del formulario de soporte
    soporteForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Evita que la página se recargue

        const formData = {
            nombre: document.getElementById("nombre").value,
            identificacion: document.getElementById("identificacion").value,
            telefono: document.getElementById("telefono").value,
            tipo_dispositivo: document.getElementById("tipo_dispositivo").value,
            descripcion: document.getElementById("descripcion").value
        };

        const submitBtn = soporteForm.querySelector("button[type='submit']");
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Registrando...";
        submitBtn.disabled = true;

        // Flujo 01 de n8n: crea el ticket y envía la confirmación por correo
        const resultado = await llamarApi("solicitudes", formData);

        if (resultado.success) {
            // El chat arranca con la descripción como primer mensaje para la IA
            escribirLocal("ticket_id", resultado.ticket_id);
            window.location.href = `chatVen.html?ticket=${encodeURIComponent(resultado.ticket_id)}`;
            return;
        }
        mostrarAviso(aviso, resultado.message || "Hubo un error al registrar la solicitud.");
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });
});
