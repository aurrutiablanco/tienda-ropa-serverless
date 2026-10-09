/* ==========================================================================
   ModaUSDT — Acceso (acceso.html)
   Parámetros opcionales:  ?tab=registro   ?redirect=carrito.html
   ========================================================================== */
(() => {
    'use strict';
    const { api, Auth, param } = App;
    const $ = (id) => document.getElementById(id);

    const redirectTo = Auth.safeRedirect(param('redirect'), 'index.html');

    /* ---------- Vistas ---------- */
    function showView() {
        const user = Auth.user();
        $('auth-guest').hidden = !!user;
        $('auth-user').hidden = !user;
        if (user) {
            $('user-name').textContent = user.nombre;
            $('user-email').textContent = user.correo;
            $('user-admin').hidden = user.rol !== 'admin';
        }
    }

    function selectTab(name) {
        const login = name !== 'registro';
        $('tab-login').setAttribute('aria-selected', String(login));
        $('tab-registro').setAttribute('aria-selected', String(!login));
        $('form-login').hidden = !login;
        $('form-registro').hidden = login;
        $('login-msg').textContent = '';
        $('reg-msg').textContent = '';
    }

    function setMsg(el, text, type) {
        el.textContent = text;
        el.className = `form-msg ${type || ''}`;
    }

    function afterAuth(user) {
        Auth.set(user);
        location.href = user.rol === 'admin' ? 'admin.html' : redirectTo;
    }

    /* ---------- Login ---------- */
    $('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const correo = $('login-correo').value.trim();
        const clave = $('login-clave').value;
        const msg = $('login-msg');
        const btn = $('btn-login');

        if (!correo || !clave) return setMsg(msg, 'Escribe tu correo y tu contraseña.', 'error');

        btn.disabled = true;
        setMsg(msg, 'Iniciando sesión...', 'ok');
        try {
            const { datos } = await api('/auth/login', { method: 'POST', body: { correo, clave } });
            afterAuth(datos);
        } catch (err) {
            setMsg(msg, err.message, 'error');
            btn.disabled = false;
        }
    });

    /* ---------- Registro ---------- */
    $('form-registro').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = $('reg-nombre').value.trim();
        const correo = $('reg-correo').value.trim();
        const clave = $('reg-clave').value;
        const msg = $('reg-msg');
        const btn = $('btn-registro');

        if (!nombre || !correo || !clave) return setMsg(msg, 'Completa todos los campos.', 'error');
        if (clave.length < 6) return setMsg(msg, 'La contraseña debe tener al menos 6 caracteres.', 'error');

        btn.disabled = true;
        setMsg(msg, 'Creando tu cuenta...', 'ok');
        try {
            const { datos } = await api('/auth/registro', { method: 'POST', body: { nombre, correo, clave } });
            afterAuth(datos);
        } catch (err) {
            setMsg(msg, err.message, 'error');
            btn.disabled = false;
        }
    });

    /* ---------- Otros eventos ---------- */
    $('tab-login').addEventListener('click', () => selectTab('login'));
    $('tab-registro').addEventListener('click', () => selectTab('registro'));
    $('btn-logout').addEventListener('click', () => {
        Auth.logout();
        location.href = 'index.html';
    });

    selectTab(param('tab'));
    showView();
})();
