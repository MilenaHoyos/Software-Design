// Login, registro y recuperación van al flujo 04 de n8n a través de server.js (/api/portal).
const avisoAuth = () => document.getElementById('auth-aviso');

// Después de iniciar sesión se vuelve a la página que se pidió (por ejemplo, el enlace de un correo).
function destinoTrasLogin(rol) {
    const volver = new URLSearchParams(window.location.search).get('volver') || '';
    if (/^[A-Za-z]+\.html(\?[\w=&%.-]*)?$/.test(volver) && volver !== 'loginVentana.html') return volver;
    return PAGINA_POR_ROL[rol] || 'homeVentana.html';
}

// Si ya hay sesión, se entra directo; si venció, se avisa.
(function revisarSesionInicial() {
    const usuario = Sesion.usuario();
    if (Sesion.token() && usuario) {
        window.location.replace(destinoTrasLogin(usuario.rol));
        return;
    }
    if (new URLSearchParams(window.location.search).has('expirada')) {
        document.addEventListener('DOMContentLoaded', () => mostrarAviso(avisoAuth(), 'Tu sesión expiró. Inicia sesión nuevamente.', 'info'));
    }
})();

function bloquearBoton(form, bloqueado) {
    const boton = form.querySelector('button[type="submit"]');
    if (!boton) return;
    if (bloqueado) boton.dataset.texto = boton.textContent;
    boton.disabled = bloqueado;
    boton.textContent = bloqueado ? 'Procesando...' : (boton.dataset.texto || boton.textContent);
}

function switchAuthTab(view, direction = 'forward') {
    const tabsContainer = document.getElementById('authTabs');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const formForgot = document.getElementById('form-forgot');
    const tabBtns = tabsContainer.querySelectorAll('.nav-tab-btn');

    // Remover clases de animación previa
    [formLogin, formRegister, formForgot].forEach(form => {
        form.classList.remove('active-form', 'reverse');
        form.classList.add('hidden-form');
    });

    tabBtns.forEach(btn => btn.classList.remove('active'));

    if (view === 'login') {
        formLogin.classList.replace('hidden-form', 'active-form');
        if (direction === 'reverse') {
            formLogin.classList.add('reverse');
        }
        tabBtns[0].classList.add('active');
        tabsContainer.classList.remove('hidden-tabs');
        tabsContainer.style.display = 'flex';

    } else if (view === 'register') {
        formRegister.classList.replace('hidden-form', 'active-form');
        tabBtns[1].classList.add('active');
        tabsContainer.classList.remove('hidden-tabs');
        tabsContainer.style.display = 'flex';

    } else if (view === 'forgot') {
        formForgot.classList.replace('hidden-form', 'active-form');
        tabsContainer.classList.add('hidden-tabs');
    }
}

// 1. Inicio de sesión
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    bloquearBoton(form, true);
    const result = await llamarApi('portal', {
        action: 'login',
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
    });
    bloquearBoton(form, false);

    if (result.success) {
        Sesion.guardar(result.session_token, result.data);
        window.location.href = destinoTrasLogin(result.data.rol);
    } else {
        mostrarAviso(avisoAuth(), result.message || 'Credenciales incorrectas o cuenta inactiva.');
    }
}

// 2. Registro (crea cuentas con rol cliente)
async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    bloquearBoton(form, true);
    const result = await llamarApi('portal', {
        action: 'register',
        name: document.getElementById('reg-name').value,
        cedula: document.getElementById('reg-cedula').value,
        phone: document.getElementById('reg-phone').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
    });
    bloquearBoton(form, false);

    if (result.success) {
        form.reset();
        switchAuthTab('login', 'reverse');
        document.getElementById('login-email').value = result.data?.correo || '';
        mostrarAviso(avisoAuth(), result.message || 'Cuenta creada. Ya puedes iniciar sesión.', 'ok');
    } else {
        mostrarAviso(avisoAuth(), result.message || 'No se pudo completar el registro.');
    }
}

// 3. Recuperación de contraseña
async function handleForgot(e) {
    e.preventDefault();
    const form = e.target;
    bloquearBoton(form, true);
    const result = await llamarApi('portal', {
        action: 'forgot',
        email: document.getElementById('forgot-email').value,
    });
    bloquearBoton(form, false);

    if (result.success) {
        switchAuthTab('login', 'reverse');
        mostrarAviso(avisoAuth(), result.message, 'ok');
    } else {
        mostrarAviso(avisoAuth(), result.message || 'No se pudo enviar el correo de recuperación.');
    }
}

// Eventos (sin atributos onclick: la política de seguridad del servidor no permite scripts en línea)
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('form-register').addEventListener('submit', handleRegister);
    document.getElementById('form-forgot').addEventListener('submit', handleForgot);
    document.querySelectorAll('[data-vista]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            switchAuthTab(el.dataset.vista, el.dataset.direccion || 'forward');
        });
    });
});
