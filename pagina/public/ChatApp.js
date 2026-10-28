document.addEventListener("DOMContentLoaded", async () => {
    const usuario = requerirSesion();
    if (!usuario) return;
    prepararMenu(usuario);

    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const chatMessages = document.getElementById("chat-messages");
    const welcomeScreen = document.getElementById("welcome-screen");
    const welcomeTexto = document.getElementById("welcome-texto");
    const escalationFormContainer = document.getElementById("escalation-form-container");
    const humanEscalationForm = document.getElementById("human-escalation-form");
    const btnPedirTecnico = document.getElementById("btn-pedir-tecnico");

    // El ticket llega en la URL (chatVen.html?ticket=12) o queda del último que se abrió.
    // Con ?nuevo=1 (o sin ningún ticket) el caso se crea con el primer mensaje del chat.
    const parametros = new URLSearchParams(window.location.search);
    const chatNuevo = parametros.has("nuevo") || (!parametros.get("ticket") && !leerLocal("ticket_id"));
    let currentTicketId = chatNuevo ? "" : (parametros.get("ticket") || leerLocal("ticket_id"));
    let procesando = false;
    let contadorMensajes = 0;
    cargarZonas();

    if (chatNuevo) {
        welcomeTexto.innerHTML = 'Cuéntame qué problema tienes con tu equipo o servicio y abriré tu caso automáticamente.'
            + '<br><small>¿Prefieres un formulario? <a href="VenSolicitud.html">Crear la solicitud con el formulario</a>.</small>';
        btnPedirTecnico.hidden = true;
        chatInput.focus();
    } else {
        escribirLocal("ticket_id", currentTicketId);
        await cargarTicket();
    }

    // ==========================================
    // Carga inicial del ticket y su historial
    // ==========================================
    async function cargarTicket() {
        const detalle = await llamarApi("portal", { accion: "detalle_ticket", ticket_id: currentTicketId });
        if (!detalle.success) {
            welcomeTexto.textContent = detalle.message || "No se pudo cargar el ticket.";
            bloquearChat("No disponible");
            return;
        }
        const ticket = detalle.data;
        document.getElementById("chat-ticket-prioridad").innerHTML = etiquetaPrioridad(ticket.prioridad);
        actualizarCabecera(ticket.estado, ticket.intentos_ia);

        const historial = ticket.historial || [];
        if (historial.length) {
            mostrarMensajes();
            historial.forEach((h) => (h.emisor === "usuario" ? appendUserMessage(h.mensaje) : appendAiMessage(h.mensaje)));
        } else {
            welcomeTexto.textContent = "Escribe tu consulta o describe el inconveniente para comenzar.";
        }

        if (ESTADOS_FINALES.includes(ticket.estado)) {
            appendAiMessage(`Este ticket ya está finalizado (${ticket.estado}).`);
            bloquearChat("Conversación finalizada.");
            if (ticket.encuesta_pendiente) mostrarEncuesta();
        } else if (ticket.estado === "Escalamiento pendiente") {
            triggerHumanEscalation();
        } else if (["Escalado nivel 2", "Pendiente de asignación", "Agendado", "En atención", "Pendiente de confirmación"].includes(ticket.estado)) {
            const visita = ticket.fecha_visita ? ` Visita programada: ${formatearFecha(ticket.fecha_visita)}.` : "";
            appendAiMessage(`Tu caso está con el equipo técnico (estado: ${ticket.estado}).${visita}`);
            bloquearChat("El equipo técnico continúa con tu caso.");
        } else if (!historial.length && ticket.descripcion_problema) {
            // Ticket recién creado: la descripción del formulario es el primer mensaje para la IA
            mostrarMensajes();
            appendUserMessage(ticket.descripcion_problema);
            sendRequestToN8n(ticket.descripcion_problema, "mensaje");
        } else if (historial.length && historial[historial.length - 1].emisor === "IA") {
            agregarBotones(chatMessages.lastElementChild);
        }
    }

    // Zonas activas para el formulario de visita (se administran en "Técnicos")
    async function cargarZonas() {
        const r = await llamarApi("portal", { accion: "zonas" });
        if (!r.success || !(r.zonas || []).length) return;
        const select = document.getElementById("esc-cuadrante");
        select.innerHTML = '<option value="">No sé / deducir de la dirección</option>'
            + r.zonas.map((z) => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join("");
    }

    // Primer mensaje de un chat nuevo: crea el caso (flujo 01, canal "chat") y luego lo envía a la IA
    async function crearCasoDesdeChat(texto) {
        procesando = true;
        chatInput.disabled = true;
        sendBtn.disabled = true;
        const cargandoId = appendAiMessage("", true);
        const r = await llamarApi("solicitudes", { canal: "chat", descripcion: texto });
        document.getElementById(cargandoId)?.remove();
        procesando = false;
        chatInput.disabled = false;
        sendBtn.disabled = false;
        if (!r.success || !r.ticket_id) {
            appendAiMessage(r.message || "No se pudo crear tu caso. Intenta de nuevo.");
            return;
        }
        currentTicketId = String(r.ticket_id);
        escribirLocal("ticket_id", currentTicketId);
        history.replaceState(null, "", `chatVen.html?ticket=${currentTicketId}`);
        document.getElementById("chat-ticket-prioridad").innerHTML = etiquetaPrioridad(r.prioridad);
        actualizarCabecera("Pendiente", 0);
        appendAiMessage(`Abrí tu caso **#${currentTicketId}**. Te enviamos la confirmación a tu correo. Ahora reviso cómo solucionarlo...`);
        sendRequestToN8n(texto, "mensaje");
    }

    // ==========================================
    // Envío de mensajes
    // ==========================================
    function handleSendMessage() {
        const text = chatInput.value.trim();
        if (text === "" || procesando) return;
        mostrarMensajes();
        quitarBotones();
        appendUserMessage(text);
        chatInput.value = "";
        if (!currentTicketId) crearCasoDesdeChat(text);
        else sendRequestToN8n(text, "mensaje");
    }

    sendBtn.addEventListener("click", handleSendMessage);
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSendMessage();
    });

    btnPedirTecnico.addEventListener("click", () => {
        if (procesando || !confirm("¿Quieres que un técnico revise tu caso?")) return;
        mostrarMensajes();
        quitarBotones();
        appendUserMessage("Prefiero hablar con un técnico.");
        sendRequestToN8n("", "escalar");
    });

    async function sendRequestToN8n(userMessage, accion) {
        procesando = true;
        chatInput.disabled = true;
        sendBtn.disabled = true;
        const loadingId = appendAiMessage("", true);

        // Flujo 02 de n8n: diagnóstico con IA y control de 3 intentos
        const data = await llamarApi("chat", { ticket_id: currentTicketId, mensaje: userMessage, accion });

        document.getElementById(loadingId)?.remove();
        procesando = false;
        chatInput.disabled = false;
        sendBtn.disabled = false;
        const aiText = data.message || "No se recibió respuesta del servidor.";

        if (data.status === "success") {
            actualizarCabecera("En diagnóstico", data.intentos_usados);
            appendAiMessageWithButtons(aiText);
        } else if (data.status === "escalar") {
            actualizarCabecera("Escalamiento pendiente");
            appendAiMessage(aiText);
            triggerHumanEscalation();
        } else if (data.status === "closed") {
            if (data.estado) actualizarCabecera(data.estado);
            appendAiMessage(aiText);
            bloquearChat("Conversación finalizada.");
            if (data.encuesta) mostrarEncuesta();
        } else if (data.status === "escalated") {
            appendAiMessage(aiText);
            bloquearChat("El equipo técnico continúa con tu caso.");
        } else {
            // continue (pide más detalles) o errores: se muestra el mensaje y se deja escribir
            appendAiMessage(aiText);
            chatInput.focus();
        }
    }

    // ==========================================
    // Escalamiento a soporte humano (flujo 03)
    // ==========================================
    function triggerHumanEscalation() {
        bloquearChat("Chat finalizado - completa los datos de soporte.");
        btnPedirTecnico.hidden = true;
        escalationFormContainer.style.display = "block";
        setTimeout(() => escalationFormContainer.scrollIntoView({ behavior: "smooth" }), 300);
    }

    humanEscalationForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const boton = document.getElementById("esc-enviar");
        boton.disabled = true;
        boton.textContent = "Buscando técnico disponible...";

        const resultado = await llamarApi("logistica", {
            ticket_id: currentTicketId,
            telefono: document.getElementById("esc-phone").value,
            direccion: document.getElementById("esc-direccion").value,
            cuadrante: document.getElementById("esc-cuadrante").value,
        });

        if (resultado.success) {
            const titulo = resultado.status === "appointment_scheduled" ? "✅ ¡Visita agendada!" : "✅ ¡Datos enviados con éxito!";
            escalationFormContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #21633c;">
                    <h3 style="margin-top: 0;">${titulo}</h3>
                    <p style="margin-bottom: 12px;">${escapeHtml(resultado.message)}</p>
                    <a href="misTickets.html" style="color: var(--accent-color);">Ver mis tickets</a>
                </div>`;
            actualizarCabecera(resultado.estado || (resultado.status === "appointment_scheduled" ? "Agendado" : "Escalado"));
            return;
        }
        mostrarAviso(document.getElementById("esc-aviso"), resultado.message || "Hubo un error al enviar tus datos. Inténtalo de nuevo.");
        boton.disabled = false;
        boton.textContent = "Enviar a Soporte Humano";
    });

    function mostrarEncuesta() {
        const zona = document.getElementById("encuesta-chat");
        zona.hidden = false;
        pintarEncuesta(zona, currentTicketId, {
            titulo: "¿Cómo te fue con el asistente?",
            alTerminar: (r) => {
                if (r.status === "reopened") {
                    // El cliente dijo que no se resolvió: se reabre y se pide la visita
                    actualizarCabecera("Escalamiento pendiente");
                    triggerHumanEscalation();
                }
            },
        });
        setTimeout(() => zona.scrollIntoView({ behavior: "smooth" }), 300);
    }

    // ==========================================
    // Utilidades de la interfaz
    // ==========================================
    function actualizarCabecera(estado, intentos) {
        document.getElementById("chat-ticket-info").hidden = false;
        document.getElementById("chat-ticket-num").textContent = `#${currentTicketId}`;
        document.getElementById("chat-ticket-estado").innerHTML = etiquetaEstado(estado);
        if (intentos !== undefined) {
            document.getElementById("chat-intentos").textContent = `Intentos con IA: ${intentos} de 3`;
        }
        btnPedirTecnico.hidden = !["Pendiente", "En diagnóstico"].includes(estado);
    }

    function mostrarMensajes() {
        if (welcomeScreen.style.display !== "none") {
            welcomeScreen.style.display = "none";
            chatMessages.style.display = "flex";
        }
    }

    function bloquearChat(texto) {
        chatInput.disabled = true;
        sendBtn.disabled = true;
        chatInput.placeholder = texto;
        btnPedirTecnico.hidden = true;
    }

    function appendUserMessage(message) {
        const messageDiv = document.createElement("div");
        messageDiv.className = "message user-message";
        messageDiv.innerHTML = `
            <div class="message-bubble">
                <div class="ai-body"><p>${escapeHtml(message)}</p></div>
            </div>`;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function appendAiMessage(text, cargando = false) {
        const messageId = `ai-msg-${Date.now()}-${contadorMensajes++}`;
        const messageDiv = document.createElement("div");
        messageDiv.className = "message ai-message";
        messageDiv.id = messageId;
        const cuerpo = cargando
            ? `<div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`
            : `<p>${formatearTextoIA(text)}</p>`;
        messageDiv.innerHTML = `
            <div class="message-bubble">
                <div class="ai-header">
                    <span class="ai-icon">✨</span><span>IA Soporte:</span>
                </div>
                <div class="ai-body">${cuerpo}</div>
            </div>`;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
        return messageId;
    }

    function appendAiMessageWithButtons(text) {
        agregarBotones(document.getElementById(appendAiMessage(text)));
    }

    function agregarBotones(messageDiv) {
        if (!messageDiv) return;
        const actionDiv = document.createElement("div");
        actionDiv.className = "chat-actions";
        actionDiv.style.marginTop = "10px";
        actionDiv.innerHTML = `
            <button class="btn-success">¡Sí, se solucionó!</button>
            <button class="btn-danger">No funcionó</button>
        `;
        messageDiv.querySelector(".message-bubble").appendChild(actionDiv);
        scrollToBottom();

        actionDiv.querySelector(".btn-success").addEventListener("click", () => {
            if (procesando) return;
            actionDiv.remove();
            appendUserMessage("👍 ¡Sí me solucionó el problema!");
            sendRequestToN8n("", "solucionado");
        });

        actionDiv.querySelector(".btn-danger").addEventListener("click", () => {
            if (procesando) return;
            actionDiv.remove();
            appendUserMessage("👎 No funcionó el método.");
            sendRequestToN8n("", "no_solucionado");
        });
    }

    function quitarBotones() {
        chatMessages.querySelectorAll(".chat-actions").forEach((el) => el.remove());
    }

    function scrollToBottom() {
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: "smooth" });
    }
});
