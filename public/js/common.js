/* ==========================================================================
   ModaUSDT — Módulo compartido (se carga primero en todas las páginas)
   Expone window.App con: api, store, KEYS, esc, norm, usdt, money, sku,
   debounce, param, imgOf, icons, Auth, Cart, toast, Modal
   También monta la cabecera (#site-header) y el pie (#site-footer).
   ========================================================================== */
(() => {
    'use strict';

    /* ---------- Configuración ---------- */
    const API_BASE = '/api';
    const KEYS = {
        cart: 'cart_usdt',       // carrito persistente
        user: 'user_usdt',       // sesión
        direct: 'direct_usdt',   // pedido directo (sessionStorage)
        phone: 'cliente_tel'     // último teléfono usado en el checkout
    };
    const MAX_QTY = 99;

    /* ---------- Almacenamiento seguro ---------- */
    const store = {
        get(key, fallback = null, area = localStorage) {
            try {
                const raw = area.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            } catch { return fallback; }
        },
        set(key, value, area = localStorage) {
            try { area.setItem(key, JSON.stringify(value)); } catch { /* modo privado o cuota llena */ }
        },
        remove(key, area = localStorage) {
            try { area.removeItem(key); } catch { /* noop */ }
        }
    };

    /* ---------- API ---------- */
    async function api(path, { method = 'GET', body } = {}) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body !== undefined) options.body = JSON.stringify(body);

        let res;
        try {
            res = await fetch(API_BASE + path, options);
        } catch {
            throw new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
        }

        let json;
        try {
            json = await res.json();
        } catch {
            throw new Error(`El servidor respondió con un error (${res.status}).`);
        }
        if (!json.exito) throw new Error(json.mensaje || 'Ocurrió un error inesperado.');
        return json;
    }

    /* ---------- Utilidades ---------- */
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    // Minúsculas y sin acentos: "Camisa Azúl" -> "camisa azul"
    const norm = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
    const usdt = (n) => `${money(n)} USDT`;
    const sku = (id) => `MU-${String(id).padStart(4, '0')}`;
    const param = (name) => new URLSearchParams(location.search).get(name);

    function debounce(fn, wait = 200) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
    }

    const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#eef1f0"/>' +
        '<text x="200" y="206" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" letter-spacing="2" fill="#606562">SIN IMAGEN</text></svg>'
    );
    const imgOf = (p) => (p && p.imagen_url) || PLACEHOLDER;

    // Si una imagen falla, se sustituye una sola vez por el marcador
    document.addEventListener('error', (e) => {
        const img = e.target;
        if (img && img.tagName === 'IMG' && !img.dataset.fallback) {
            img.dataset.fallback = '1';
            img.src = PLACEHOLDER;
        }
    }, true);

    /* ---------- Iconos (trazo 1.5px, color heredado) ---------- */
    const svg = (paths, size = 22) =>
        `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    const icons = {
        search: (s = 16) => svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', s),
        user: () => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/>'),
        cart: () => svg('<path d="M3 4h2.5l2.2 11h10.6l2-8H6.4"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>'),
        close: (s = 20) => svg('<path d="M6 6l12 12M18 6L6 18"/>', s),
        plus: (s = 16) => svg('<path d="M12 5v14M5 12h14"/>', s),
        minus: (s = 16) => svg('<path d="M5 12h14"/>', s),
        trash: (s = 18) => svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', s)
    };

    /* ---------- Sesión ---------- */
    const Auth = {
        user: () => store.get(KEYS.user),
        isAdmin: () => Auth.user()?.rol === 'admin',
        set(user) { store.set(KEYS.user, user); },
        logout() { store.remove(KEYS.user); },
        // Solo permite redirigir a páginas internas (evita open-redirect)
        safeRedirect(target, fallback = 'index.html') {
            return /^[\w-]+\.html(\?[\w=&%.-]*)?$/i.test(target || '') ? target : fallback;
        }
    };

    /* ---------- Carrito ---------- */
    const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, parseInt(n, 10) || 1));

    const Cart = {
        // Convierte un producto del API en una línea de carrito/pedido
        toItem(p, cantidad = 1) {
            return {
                id_producto: Number(p.id_producto),
                nombre: p.nombre,
                precio_usdt: Number(p.precio_usdt),
                color: p.color,
                talla: p.talla,
                imagen_url: p.imagen_url || '',
                cantidad: clampQty(cantidad)
            };
        },
        items() {
            const list = store.get(KEYS.cart, []);
            return Array.isArray(list) ? list : [];
        },
        save(items) {
            store.set(KEYS.cart, items);
            document.dispatchEvent(new CustomEvent('cart:change'));
        },
        add(product, qty = 1) {
            const items = Cart.items();
            const line = items.find((i) => i.id_producto === Number(product.id_producto));
            if (line) line.cantidad = clampQty(line.cantidad + qty);
            else items.push(Cart.toItem(product, qty));
            Cart.save(items);
        },
        clear() { Cart.save([]); },
        count(items = Cart.items()) { return items.reduce((n, i) => n + i.cantidad, 0); },
        total(items = Cart.items()) { return items.reduce((s, i) => s + i.cantidad * i.precio_usdt, 0); },
        clampQty
    };

    /* ---------- Toast ---------- */
    function toast(message, { href, linkText } = {}) {
        let stack = document.querySelector('.toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            stack.setAttribute('role', 'status');
            stack.setAttribute('aria-live', 'polite');
            document.body.appendChild(stack);
        }
        const el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = esc(message) + (href ? `<a href="${esc(href)}">${esc(linkText || 'Ver')}</a>` : '');
        stack.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    /* ---------- Modales ---------- */
    const Modal = {
        open(id) {
            const m = document.getElementById(id);
            if (!m) return;
            m.classList.add('active');
            document.body.style.overflow = 'hidden';
            m.querySelector('input, select, textarea, button, a')?.focus();
        },
        close(id) {
            document.getElementById(id)?.classList.remove('active');
            if (!document.querySelector('.modal.active')) document.body.style.overflow = '';
        }
    };
    document.addEventListener('click', (e) => {
        const closer = e.target.closest('[data-close-modal]');
        if (closer) Modal.close(closer.closest('.modal').id);
        else if (e.target.classList?.contains('modal')) Modal.close(e.target.id);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.querySelectorAll('.modal.active').forEach((m) => Modal.close(m.id));
    });

    /* ---------- Cabecera y pie ---------- */
    function headerHTML(isAdmin) {
        const announce = isAdmin
            ? 'Panel de administración'
            : 'Precios en USDT. Envíos a todo el país.';

        if (isAdmin) {
            return `
            <div class="announcement"><p class="label label-lg">${announce}</p></div>
            <header class="site-header">
                <div class="container header-row admin">
                    <a class="logo" href="index.html">ModaUSDT <small>Admin</small></a>
                    <nav class="header-actions" aria-label="Administración">
                        <a class="icon-btn" href="index.html"><span class="label">Ver tienda</span></a>
                        <button class="icon-btn" id="btn-logout" type="button"><span class="label">Cerrar sesión</span></button>
                    </nav>
                </div>
            </header>`;
        }

        return `
        <div class="announcement"><p class="label label-lg">${announce}</p></div>
        <header class="site-header">
            <div class="container header-row">
                <a class="logo" href="index.html" aria-label="ModaUSDT, ir al inicio">ModaUSDT</a>
                <form class="search" id="site-search-form" role="search">
                    <span class="search-icon">${icons.search()}</span>
                    <label class="sr-only" for="site-search">Buscar productos</label>
                    <input id="site-search" type="text" autocomplete="off" enterkeyhint="search" placeholder="Buscar ropa, color, talla">
                    <button class="search-clear" id="site-search-clear" type="button" aria-label="Borrar búsqueda" hidden>${icons.close(16)}</button>
                </form>
                <nav class="header-actions" aria-label="Cuenta y carrito">
                    <a class="icon-btn" id="account-link" href="acceso.html" aria-label="Mi cuenta">
                        ${icons.user()}<span class="label" id="account-label">Ingresar</span>
                    </a>
                    <a class="icon-btn" href="carrito.html" aria-label="Carrito">
                        ${icons.cart()}<span class="cart-count" id="cart-count">0</span>
                    </a>
                </nav>
            </div>
        </header>`;
    }

    function footerHTML() {
        return `
        <footer class="site-footer">
            <div class="container">
                <div class="footer-row">
                    <div>
                        <a class="logo" href="index.html">ModaUSDT</a>
                        <p>Ropa con precios en USDT y envíos a todo el país.</p>
                    </div>
                    <nav class="footer-links label label-lg" aria-label="Pie de página">
                        <a href="index.html#catalogo">Catálogo</a>
                        <a href="carrito.html">Carrito</a>
                        <a href="acceso.html">Mi cuenta</a>
                    </nav>
                </div>
                <p class="footer-legal">&copy; ${new Date().getFullYear()} ModaUSDT. Todos los derechos reservados.</p>
            </div>
        </footer>`;
    }

    function refreshHeaderState() {
        const countEl = document.getElementById('cart-count');
        if (countEl) {
            const n = Cart.count();
            countEl.textContent = n;
            countEl.hidden = n === 0;
        }
        const user = Auth.user();
        const label = document.getElementById('account-label');
        const link = document.getElementById('account-link');
        if (label && link) {
            label.textContent = user ? (user.rol === 'admin' ? 'Admin' : String(user.nombre || '').split(' ')[0]) : 'Ingresar';
            link.setAttribute('href', user?.rol === 'admin' ? 'admin.html' : 'acceso.html');
        }
    }

    function bindSearch() {
        const form = document.getElementById('site-search-form');
        if (!form) return;
        const input = document.getElementById('site-search');
        const clear = document.getElementById('site-search-clear');
        const onIndex = document.body.dataset.page === 'index';
        const emit = (submit) => document.dispatchEvent(
            new CustomEvent('site:search', { detail: { q: input.value.trim(), submit } })
        );
        const emitLive = debounce(() => emit(false), 180);

        if (onIndex && param('q')) input.value = param('q');
        clear.hidden = !input.value;

        input.addEventListener('input', () => {
            clear.hidden = !input.value;
            if (onIndex) emitLive();
        });
        clear.addEventListener('click', () => {
            input.value = '';
            clear.hidden = true;
            input.focus();
            if (onIndex) emit(false);
        });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = input.value.trim();
            if (onIndex) emit(true);
            else location.href = q ? `index.html?q=${encodeURIComponent(q)}` : 'index.html#catalogo';
        });
    }

    function mountLayout() {
        const isAdmin = document.body.dataset.page === 'admin';
        const header = document.getElementById('site-header');
        const footer = document.getElementById('site-footer');
        if (header) header.innerHTML = headerHTML(isAdmin);
        if (footer) footer.innerHTML = footerHTML();

        bindSearch();
        refreshHeaderState();

        let lastCount = Cart.count();
        document.addEventListener('cart:change', () => {
            refreshHeaderState();
            const el = document.getElementById('cart-count');
            if (el && Cart.count() > lastCount) {
                el.classList.remove('bump');
                void el.offsetWidth; // reinicia la animación
                el.classList.add('bump');
            }
            lastCount = Cart.count();
        });
        // Sincroniza entre pestañas
        window.addEventListener('storage', refreshHeaderState);
    }

    window.App = { api, store, KEYS, esc, norm, money, usdt, sku, param, debounce, imgOf, PLACEHOLDER, icons, Auth, Cart, toast, Modal };

    mountLayout();
})();
