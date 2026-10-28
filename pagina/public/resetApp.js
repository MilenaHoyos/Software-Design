// Restablecimiento de contraseña con el enlace recibido por correo
const aviso = document.getElementById('reset-aviso');
const token = new URLSearchParams(window.location.search).get('token') || '';
if (!token) mostrarAviso(aviso, 'El enlace no es válido. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".');

document.getElementById('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const clave = document.getElementById('reset-password').value;
    if (clave !== document.getElementById('reset-password2').value) {
        mostrarAviso(aviso, 'Las contraseñas no coinciden.');
        return;
    }
    const boton = e.target.querySelector('button[type="submit"]');
    boton.disabled = true;
    const result = await llamarApi('portal', { action: 'reset_password', token, new_password: clave });
    boton.disabled = false;
    if (result.success) {
        e.target.reset();
        mostrarAviso(aviso, result.message + ' Te llevamos al inicio de sesión...', 'ok');
        setTimeout(() => { window.location.href = 'loginVentana.html'; }, 2500);
    } else {
        mostrarAviso(aviso, result.message || 'No se pudo actualizar la contraseña.');
    }
});
