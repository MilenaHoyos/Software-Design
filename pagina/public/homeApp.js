/**
 * Lógica para la ventana Home / Inicio (cliente)
 */
document.addEventListener("DOMContentLoaded", async () => {
    const usuario = requerirSesion(["cliente"]);
    if (!usuario) return;
    prepararMenu(usuario);

    // Nombre en el saludo
    const homeUserName = document.getElementById("home-user-name");
    if (homeUserName) {
        homeUserName.textContent = (usuario.nombre || "Usuario").split(" ")[0];
    }

    // Estado del sistema: servidor y n8n con su tiempo de respuesta
    const sistema = document.getElementById("stat-sistema");
    fetch("/api/estado").then((r) => r.json()).then((e) => {
        sistema.textContent = e.success ? `🟢 Operativo (${e.tiempo_ms} ms)` : "🔴 Automatización sin conexión";
        sistema.style.color = e.success ? "#10b981" : "#c0392b";
    }).catch(() => {
        sistema.textContent = "🔴 Sin conexión";
        sistema.style.color = "#c0392b";
    });

    // Tarjetas de métricas con los tickets reales del cliente
    const resultado = await llamarApi("portal", { accion: "mis_tickets" });
    if (!resultado.success) return;
    const tickets = resultado.tickets || [];
    document.getElementById("stat-activos").textContent =
        tickets.filter((t) => !ESTADOS_FINALES.includes(t.estado)).length;
    document.getElementById("stat-resueltos").textContent =
        tickets.filter((t) => ["Resuelto IA", "Cerrado"].includes(t.estado)).length;

    const pendientes = tickets.filter((t) => t.encuesta_pendiente);
    if (pendientes.length) {
        const aviso = document.createElement("a");
        aviso.className = "aviso aviso-info";
        aviso.style.display = "block";
        aviso.style.textDecoration = "none";
        aviso.href = `misTickets.html?ticket=${pendientes[0].ticket_id}`;
        aviso.textContent = `★ Tienes ${pendientes.length} encuesta(s) pendiente(s). Cuéntanos si se resolvió tu problema →`;
        document.querySelector(".welcome-banner").after(aviso);
    }
});
