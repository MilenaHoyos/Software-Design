/**
 * Administración de la base de conocimiento (admin).
 */
document.addEventListener("DOMContentLoaded", () => {
    const usuario = requerirSesion(["admin"]);
    if (!usuario) return;
    prepararMenu(usuario);

    const aviso = document.getElementById("kb-aviso");
    const tabla = document.getElementById("tabla-kb");
    const form = document.getElementById("form-kb");
    let articulos = [];
    let editando = 0;

    document.getElementById("btn-nuevo").addEventListener("click", () => editar(null));
    document.getElementById("kb-filtro").addEventListener("input", pintarLista);
    cargar();

    async function cargar() {
        const r = await llamarApi("gestion", { accion: "kb_listar" });
        if (!r.success) return mostrarAviso(aviso, r.message || "No se pudo cargar la base de conocimiento.");
        articulos = r.articulos || [];
        document.getElementById("kb-categorias").innerHTML = [...new Set(articulos.map((a) => a.categoria).filter(Boolean))]
            .map((c) => `<option value="${escapeHtml(c)}">`).join("");
        pintarLista();
    }

    function pintarLista() {
        const filtro = document.getElementById("kb-filtro").value.trim().toLowerCase();
        const lista = articulos.filter((a) => !filtro || `${a.titulo} ${a.categoria || ""}`.toLowerCase().includes(filtro));
        tabla.querySelector("tbody").innerHTML = lista.length ? lista.map((a) => `
            <tr data-id="${a.id}" class="${a.id === editando ? "seleccionado" : ""}">
                <td>${escapeHtml(a.titulo)}</td><td>${escapeHtml(a.categoria || "—")}</td>
                <td>${a.activo ? '<span class="badge-estado estado-final">Activo</span>' : '<span class="badge-estado estado-alerta">Inactivo</span>'}</td>
            </tr>`).join("") : '<tr><td colspan="3" class="vacio">Sin artículos.</td></tr>';
        etiquetarTabla(tabla);
        tabla.querySelectorAll("tr[data-id]").forEach((f) => f.addEventListener("click", () =>
            editar(articulos.find((a) => a.id === Number(f.dataset.id)))));
    }

    function editar(a) {
        editando = a ? a.id : 0;
        document.getElementById("kb-titulo-form").textContent = a ? "Editar artículo" : "Nuevo artículo";
        document.getElementById("kb-titulo").value = a ? a.titulo : "";
        document.getElementById("kb-categoria").value = a ? (a.categoria || "") : "";
        document.getElementById("kb-contenido").value = a ? a.contenido : "";
        document.getElementById("kb-activo").checked = a ? a.activo : true;
        pintarLista();
        document.getElementById("kb-titulo").focus();
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const boton = form.querySelector("button[type=submit]");
        boton.disabled = true;
        const r = await llamarApi("gestion", {
            accion: "kb_guardar",
            id: editando,
            titulo: document.getElementById("kb-titulo").value.trim(),
            categoria: document.getElementById("kb-categoria").value.trim(),
            contenido: document.getElementById("kb-contenido").value.trim(),
            activo: document.getElementById("kb-activo").checked,
        });
        boton.disabled = false;
        if (r.success) {
            editando = r.id;
            await cargar();
        }
        mostrarAviso(aviso, r.message, r.success ? "ok" : "error");
    });
});
