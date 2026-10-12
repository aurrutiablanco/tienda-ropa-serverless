/* ==========================================================================
   ModaUSDT — script.js (todo el JS en un solo archivo)
   Reemplaza common.js, index.js, producto.js, acceso.js, carrito.js y admin.js.
   En cada HTML deja solo:   <script src="js/script.js"></script>

   Cada página se detecta con <body data-page="...">:
   index | producto | acceso | carrito | admin
   (producto.html se detecta además por la existencia de #product-root)

   Aviso: el control de acceso del panel admin es solo visual (lado cliente).
   La protección real debe hacerse en el backend.
   ========================================================================== */
(() => {
    'use strict';

    /* ======================================================================
       1. NÚCLEO COMPARTIDO
       ====================================================================== */
    const API_BASE = '/api';
    const KEYS = {
        cart: 'cart_usdt',
        user: 'user_usdt',
        direct: 'direct_usdt',
        phone: 'cliente_tel'
    };
    const MAX_QTY = 99;
    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    const norm = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
    const usdt = (n) => `${money(n)} USDT`;
    const sku = (id) => `MU-${String(id).padStart(4, '0')}`;
    const param = (name) => new URLSearchParams(location.search).get(name);
    const $ = (id) => document.getElementById(id);

    function debounce(fn, wait = 200) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
    }

    const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#eef1f0"/>' +
        '<text x="200" y="206" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" letter-spacing="2" fill="#606562">SIN IMAGEN</text></svg>'
    );
    const imgOf = (p) => (p && p.imagen_url) || PLACEHOLDER;

    document.addEventListener('error', (e) => {
        const img = e.target;
        if (img && img.tagName === 'IMG' && !img.dataset.fallback) {
            img.dataset.fallback = '1';
            img.src = PLACEHOLDER;
        }
    }, true);

    /* ---------- Iconos ---------- */
    const svg = (paths, size = 22, sw = 1.5) =>
        `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    const icons = {
        search: (s = 16) => svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', s),
        user: () => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/>'),
        cart: () => svg('<path d="M3 4h2.5l2.2 11h10.6l2-8H6.4"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>'),
        close: (s = 20) => svg('<path d="M6 6l12 12M18 6L6 18"/>', s),
        plus: (s = 16) => svg('<path d="M12 5v14M5 12h14"/>', s),
        minus: (s = 16) => svg('<path d="M5 12h14"/>', s),
        trash: (s = 18) => svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', s),
        left: (s = 20) => svg('<path d="M15 5l-7 7 7 7"/>', s),
        right: (s = 20) => svg('<path d="M9 5l7 7-7 7"/>', s),
        up: (s = 20) => svg('<path d="M12 19V5M5 12l7-7 7 7"/>', s),
        star: (s = 18) => svg('<path d="M12 2l2.4 7.6H22l-6.2 4.5 2.4 7.6L12 17.2 5.8 21.7l2.4-7.6L2 9.6h7.6z"/>', s, 1.2),
        coin: (s = 24) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.8 1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/>', s),
        truck: (s = 24) => svg('<path d="M2 6h11v10H2zM13 10h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>', s),
        file: (s = 24) => svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>', s),
        chat: (s = 24) => svg('<path d="M4 5h16v11H9l-5 4z"/>', s),
        shield: (s = 22) => svg('<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>', s),
        bag: (s = 64) => svg('<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2"/>', s, 1),
        check: (s = 30) => svg('<path d="M5 12.5l4.5 4.5L19 7"/>', s, 2.4)
    };

    /* ---------- Sesión ---------- */
    const Auth = {
        user: () => store.get(KEYS.user),
        isAdmin: () => Auth.user()?.rol === 'admin',
        set(user) { store.set(KEYS.user, user); },
        logout() { store.remove(KEYS.user); },
        safeRedirect(target, fallback = 'index.html') {
            return /^[\w-]+\.html(\?[\w=&%.-]*)?$/i.test(target || '') ? target : fallback;
        }
    };

    /* ---------- Carrito ---------- */
    const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, parseInt(n, 10) || 1));

    const Cart = {
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
            const m = $(id);
            if (!m) return;
            m.classList.add('active');
            document.body.style.overflow = 'hidden';
            m.querySelector('input, select, textarea, button, a')?.focus();
        },
        close(id) {
            $(id)?.classList.remove('active');
            if (!document.querySelector('.modal.active') && !Drawer.isOpen()) document.body.style.overflow = '';
        }
    };
    document.addEventListener('click', (e) => {
        const closer = e.target.closest('[data-close-modal]');
        if (closer) Modal.close(closer.closest('.modal').id);
        else if (e.target.classList?.contains('modal')) Modal.close(e.target.id);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach((m) => Modal.close(m.id));
            Drawer.close();
        }
    });

    /* ---------- Efectos: reveal, conteo, vuelo, confeti ---------- */
    const io = ('IntersectionObserver' in window && !REDUCED)
        ? new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
        : null;

    // Marca elementos para que aparezcan al hacer scroll. Con "stagger" escalona los hermanos.
    function reveal(scope = document, selector = '[data-reveal]', stagger = true) {
        const nodes = typeof scope === 'string' ? document.querySelectorAll(scope) : scope.querySelectorAll(selector);
        nodes.forEach((el, i) => {
            if (el.dataset.rv) return;
            el.dataset.rv = '1';
            if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
            if (stagger) el.style.setProperty('--d', `${(i % 8) * 70}ms`);
            if (!io) { el.classList.add('in'); return; }
            io.observe(el);
        });
    }
    function revealAll(selector, stagger = true) {
        document.querySelectorAll(selector).forEach((el, i) => {
            if (el.dataset.rv) return;
            el.dataset.rv = '1';
            el.setAttribute('data-reveal', '');
            if (stagger) el.style.setProperty('--d', `${(i % 8) * 70}ms`);
            if (!io) { el.classList.add('in'); return; }
            io.observe(el);
        });
    }

    function countUp(el, to, duration = 1400) {
        if (REDUCED || !to) { el.textContent = to; return; }
        const start = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(to * eased);
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }
    function onVisible(el, fn) {
        if (!io) { fn(); return; }
        const o = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) { fn(); o.disconnect(); }
        }, { threshold: 0.4 });
        o.observe(el);
    }

    // Pequeña imagen que vuela desde un botón hasta el icono del carrito
    function fly(fromEl, src) {
        if (REDUCED || !fromEl) return;
        const target = $('cart-link');
        if (!target) return;
        const a = fromEl.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        const dot = document.createElement('img');
        dot.className = 'fly';
        dot.alt = '';
        dot.src = src || PLACEHOLDER;
        const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
        dot.style.left = `${ax}px`;
        dot.style.top = `${ay}px`;
        document.body.appendChild(dot);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            dot.style.transform = `translate(${b.left + b.width / 2 - ax}px, ${b.top + b.height / 2 - ay}px) scale(0.25)`;
            dot.style.opacity = '0.3';
        }));
        setTimeout(() => dot.remove(), 800);
    }

    function confetti(amount = 70) {
        if (REDUCED) return;
        const colors = ['#d4ff3f', '#1a211e', '#ffffff', '#cccfcd', '#606562'];
        for (let i = 0; i < amount; i++) {
            const c = document.createElement('i');
            c.className = 'confetti';
            c.style.left = `${Math.random() * 100}vw`;
            c.style.background = colors[i % colors.length];
            c.style.setProperty('--x', `${(Math.random() - 0.5) * 240}px`);
            c.style.setProperty('--r', `${Math.random() * 900 - 450}deg`);
            c.style.setProperty('--t', `${1.6 + Math.random() * 1.6}s`);
            c.style.animationDelay = `${Math.random() * 0.4}s`;
            c.style.borderRadius = i % 3 === 0 ? '50%' : '2px';
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 3800);
        }
    }

    function pop(el) {
        if (!el) return;
        el.classList.remove('tick');
        void el.offsetWidth;
        el.classList.add('tick');
    }

    // Parte un título en palabras para animarlas una a una
    function splitWords(el) {
        if (!el || el.dataset.split) return;
        el.dataset.split = '1';
        const words = el.textContent.trim().split(/\s+/);
        el.setAttribute('aria-label', el.textContent.trim());
        el.innerHTML = words.map((w, i) =>
            `<span class="w" aria-hidden="true"><span class="wi" style="--i:${i}">${esc(w)}</span></span>`
        ).join(' ');
    }

    /* ---------- Cajón de carrito (mini-carrito) ---------- */
    const Drawer = {
        mounted: false,
        isOpen: () => !!$('drawer')?.classList.contains('open'),
        mount() {
            if (Drawer.mounted) return;
            Drawer.mounted = true;
            document.body.insertAdjacentHTML('beforeend', `
                <div class="drawer-backdrop" id="drawer-backdrop"></div>
                <aside class="drawer" id="drawer" aria-label="Carrito" aria-hidden="true">
                    <div class="drawer-head">
                        <h2 class="h-md">Tu carrito</h2>
                        <button class="drawer-close" type="button" data-drawer-close aria-label="Cerrar carrito">${icons.close()}</button>
                    </div>
                    <div class="drawer-body" id="drawer-body"></div>
                    <div class="drawer-foot" id="drawer-foot"></div>
                </aside>`);

            $('drawer-backdrop').addEventListener('click', Drawer.close);
            $('drawer').addEventListener('click', (e) => {
                if (e.target.closest('[data-drawer-close]')) return Drawer.close();
                const btn = e.target.closest('[data-d-act]');
                if (!btn) return;
                const id = Number(btn.dataset.id);
                const items = Cart.items();
                const line = items.find((i) => i.id_producto === id);
                if (!line) return;
                if (btn.dataset.dAct === 'plus') line.cantidad = clampQty(line.cantidad + 1);
                if (btn.dataset.dAct === 'minus') line.cantidad = clampQty(line.cantidad - 1);
                Cart.save(btn.dataset.dAct === 'remove' ? items.filter((i) => i.id_producto !== id) : items);
            });
            document.addEventListener('cart:change', () => { if (Drawer.isOpen()) Drawer.render(); });
        },
        render() {
            const items = Cart.items();
            const body = $('drawer-body');
            const foot = $('drawer-foot');
            if (!items.length) {
                body.innerHTML = `
                    <div class="drawer-empty">
                        ${icons.bag(64)}
                        <h3 class="h-md" style="margin-bottom:8px">Tu carrito está vacío</h3>
                        <p>Agrega prendas y aparecerán aquí.</p>
                        <a class="btn btn-solid" href="index.html#catalogo" data-drawer-close>Ver catálogo</a>
                    </div>`;
                foot.hidden = true;
                return;
            }
            foot.hidden = false;
            body.innerHTML = items.map((it, i) => `
                <div class="drawer-line" style="animation-delay:${i * 50}ms">
                    <a class="line-img" href="producto.html?id=${it.id_producto}"><img src="${esc(imgOf(it))}" alt="${esc(it.nombre)}"></a>
                    <div>
                        <a class="line-name" href="producto.html?id=${it.id_producto}">${esc(it.nombre)}</a>
                        <p class="line-meta">${esc(it.color)} / Talla ${esc(it.talla)}</p>
                        <div class="qty qty-sm" role="group" aria-label="Cantidad de ${esc(it.nombre)}">
                            <button type="button" data-d-act="minus" data-id="${it.id_producto}" aria-label="Disminuir" ${it.cantidad <= 1 ? 'disabled' : ''}>${icons.minus(14)}</button>
                            <input type="number" value="${it.cantidad}" readonly aria-label="Cantidad">
                            <button type="button" data-d-act="plus" data-id="${it.id_producto}" aria-label="Aumentar" ${it.cantidad >= MAX_QTY ? 'disabled' : ''}>${icons.plus(14)}</button>
                        </div>
                    </div>
                    <div>
                        <p class="price">${money(it.cantidad * it.precio_usdt)}</p>
                        <button class="line-remove" type="button" data-d-act="remove" data-id="${it.id_producto}" aria-label="Quitar ${esc(it.nombre)}">${icons.trash(16)}</button>
                    </div>
                </div>`).join('');
            foot.innerHTML = `
                <div class="drawer-total"><span class="label">Total</span><strong>${usdt(Cart.total(items))}</strong></div>
                <p class="muted small">Envío a coordinar por WhatsApp.</p>
                <a class="btn btn-solid btn-block" href="carrito.html">Confirmar pedido <span class="arrow">→</span></a>
                <button class="btn btn-ghost" type="button" data-drawer-close>Seguir comprando</button>`;
        },
        open() {
            Drawer.mount();
            Drawer.render();
            $('drawer-backdrop').classList.add('open');
            const d = $('drawer');
            d.classList.add('open');
            d.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        },
        close() {
            if (!Drawer.mounted) return;
            $('drawer-backdrop').classList.remove('open');
            const d = $('drawer');
            d.classList.remove('open');
            d.setAttribute('aria-hidden', 'true');
            if (!document.querySelector('.modal.active')) document.body.style.overflow = '';
        }
    };

    /* ---------- Cabecera y pie ---------- */
    const ANNOUNCE = [
        'Precios en USDT. Envíos a todo el país.',
        'Comprobante en PDF directo a tu correo',
        'Coordina tu pago por WhatsApp'
    ];

    function headerHTML(isAdmin) {
        if (isAdmin) {
            return `
            <div class="announcement"><p class="label label-lg">Panel de administración</p></div>
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
        <div class="announcement"><p class="label label-lg" id="announce-text">${ANNOUNCE[0]}</p></div>
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
                    <a class="icon-btn" id="cart-link" href="carrito.html" aria-label="Carrito">
                        ${icons.cart()}<span class="cart-count" id="cart-count">0</span>
                    </a>
                </nav>
            </div>
        </header>`;
    }

    function footerHTML(isAdmin) {
        if (isAdmin) {
            return `
            <footer class="site-footer">
                <div class="container">
                    <p class="footer-legal" style="margin-top:0;border:0;padding:0"><span>&copy; ${new Date().getFullYear()} ModaUSDT — Panel de administración</span></p>
                </div>
            </footer>`;
        }
        return `
        <footer class="site-footer">
            <div class="container">
                <div class="footer-top">
                    <h2 class="display" style="font-size:clamp(40px,5vw,64px)">Viste bien. <em>Paga en USDT.</em></h2>
                    <a class="btn btn-light" href="index.html#catalogo">Explorar catálogo <span class="arrow">→</span></a>
                </div>

                <div class="footer-cols">
                    <div class="footer-brand">
                        <a class="logo" href="index.html">ModaUSDT</a>
                        <p>Ropa con precios en USDT y envíos a todo el país. Pedido claro, comprobante en PDF y pago coordinado por WhatsApp.</p>
                        <div class="footer-pay">
                            <span class="pill">USDT</span><span class="pill">WhatsApp</span><span class="pill">PDF</span>
                        </div>
                    </div>
                    <nav class="footer-col" aria-label="Tienda">
                        <h4 class="label label-lg">Tienda</h4>
                        <ul>
                            <li><a href="index.html#novedades">Novedades</a></li>
                            <li><a href="index.html#catalogo">Catálogo</a></li>
                            <li><a href="index.html#como-comprar">Cómo comprar</a></li>
                            <li><a href="index.html#faq">Preguntas frecuentes</a></li>
                        </ul>
                    </nav>
                    <nav class="footer-col" aria-label="Mi cuenta">
                        <h4 class="label label-lg">Mi cuenta</h4>
                        <ul>
                            <li><a href="acceso.html">Iniciar sesión</a></li>
                            <li><a href="acceso.html?tab=registro">Crear cuenta</a></li>
                            <li><a href="carrito.html">Mi carrito</a></li>
                        </ul>
                    </nav>
                    <div class="footer-col">
                        <h4 class="label label-lg">Compra segura</h4>
                        <ul>
                            <li>Precios claros en USDT</li>
                            <li>Comprobante en tu correo</li>
                            <li>Pago acordado contigo</li>
                        </ul>
                    </div>
                </div>

                <div class="footer-word" aria-hidden="true">ModaUSDT</div>

                <div class="footer-legal">
                    <span>&copy; ${new Date().getFullYear()} ModaUSDT. Todos los derechos reservados.</span>
                    <button type="button" id="footer-top">Volver arriba ↑</button>
                </div>
            </div>
        </footer>`;
    }

    function refreshHeaderState() {
        const countEl = $('cart-count');
        if (countEl) {
            const n = Cart.count();
            countEl.textContent = n;
            countEl.hidden = n === 0;
        }
        const user = Auth.user();
        const label = $('account-label');
        const link = $('account-link');
        if (label && link) {
            label.textContent = user ? (user.rol === 'admin' ? 'Admin' : String(user.nombre || '').split(' ')[0]) : 'Ingresar';
            link.setAttribute('href', user?.rol === 'admin' ? 'admin.html' : 'acceso.html');
        }
    }

    function bindSearch() {
        const form = $('site-search-form');
        if (!form) return;
        const input = $('site-search');
        const clear = $('site-search-clear');
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

    // Anuncio rotatorio
    function bindAnnouncements() {
        const el = $('announce-text');
        if (!el || REDUCED) return;
        let i = 0;
        setInterval(() => {
            el.classList.add('out');
            setTimeout(() => {
                i = (i + 1) % ANNOUNCE.length;
                el.textContent = ANNOUNCE[i];
                el.classList.remove('out');
            }, 260);
        }, 4200);
    }

    // Barra de progreso, cabecera compacta y botón de subir
    function bindScroll() {
        const header = document.querySelector('.site-header');
        const bar = document.createElement('div');
        bar.className = 'scroll-progress';
        const top = document.createElement('button');
        top.className = 'to-top';
        top.type = 'button';
        top.setAttribute('aria-label', 'Volver arriba');
        top.innerHTML = icons.up();
        document.body.append(bar, top);
        top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));

        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const y = window.scrollY;
                const h = document.documentElement.scrollHeight - window.innerHeight;
                bar.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`;
                header?.classList.toggle('scrolled', y > 8);
                document.body.classList.toggle('show-top', y > 600);
                document.dispatchEvent(new CustomEvent('site:scroll', { detail: { y } }));
                ticking = false;
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    function mountLayout() {
        const page = document.body.dataset.page;
        const isAdmin = page === 'admin';
        const header = $('site-header');
        const footer = $('site-footer');
        if (header) header.innerHTML = headerHTML(isAdmin);
        if (footer) footer.innerHTML = footerHTML(isAdmin);

        bindSearch();
        bindAnnouncements();
        bindScroll();
        refreshHeaderState();
        $('footer-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));

        // Mini-carrito: en el resto de páginas el icono abre el cajón
        if (!isAdmin) {
            Drawer.mount();
            $('cart-link')?.addEventListener('click', (e) => {
                if (page === 'carrito' || e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                Drawer.open();
            });
        }

        let lastCount = Cart.count();
        document.addEventListener('cart:change', () => {
            refreshHeaderState();
            const el = $('cart-count');
            if (el && Cart.count() > lastCount) {
                el.classList.remove('bump');
                void el.offsetWidth;
                el.classList.add('bump');
            }
            lastCount = Cart.count();
        });
        window.addEventListener('storage', refreshHeaderState);

        reveal(document.querySelector('.site-footer') || document, '.footer-col, .footer-brand, .footer-top');
    }

    window.App = {
        api, store, KEYS, esc, norm, money, usdt, sku, param, debounce, imgOf, PLACEHOLDER,
        icons, Auth, Cart, toast, Modal, Drawer, reveal, countUp, fly, confetti
    };

    mountLayout();

    /* ======================================================================
       2. INDEX — catálogo, hero, novedades y secciones nuevas
       ====================================================================== */
    function initIndex() {
        const SORTS = {
            recientes: (a, b) => b.id_producto - a.id_producto,
            'precio-asc': (a, b) => a.precio_usdt - b.precio_usdt,
            'precio-desc': (a, b) => b.precio_usdt - a.precio_usdt,
            nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es')
        };

        const state = {
            all: [],
            categorias: [],
            newestIds: new Set(),
            cat: param('cat') || '',
            q: (param('q') || '').trim(),
            sort: SORTS[param('sort')] ? param('sort') : 'recientes'
        };

        /* ---------- Secciones nuevas (se inyectan, el HTML no cambia) ---------- */
        function injectSections() {
            const star = icons.star(20);
            const marqueeItems = ['Precios en USDT', 'Envíos a todo el país', 'Comprobante en PDF', 'Pago por WhatsApp', 'Nueva colección']
                .map((t) => `<span class="marquee-item">${t}${star}</span>`).join('');

            // Marquesina (después del hero)
            document.querySelector('.hero')?.insertAdjacentHTML('afterend', `
                <div class="marquee" aria-hidden="true">
                    <div class="marquee-track">${marqueeItems}${marqueeItems}${marqueeItems}${marqueeItems}</div>
                </div>`);

            // Novedades (antes del catálogo)
            $('catalogo')?.insertAdjacentHTML('beforebegin', `
                <section class="section" id="novedades" aria-labelledby="novedades-title">
                    <div class="container">
                        <div class="section-head">
                            <div>
                                <span class="label label-lg eyebrow">Recién llegado</span>
                                <h2 class="h-lg" id="novedades-title">Novedades —</h2>
                            </div>
                            <div class="rail-nav">
                                <button class="rail-btn" type="button" id="rail-prev" aria-label="Anterior">${icons.left()}</button>
                                <button class="rail-btn" type="button" id="rail-next" aria-label="Siguiente">${icons.right()}</button>
                            </div>
                        </div>
                        <div class="rail" id="rail" tabindex="0" aria-label="Novedades"></div>
                    </div>
                </section>`);

            // Beneficios + estadísticas (después del catálogo)
            $('catalogo')?.insertAdjacentHTML('afterend', `
                <section class="section dark benefits" id="beneficios" aria-labelledby="benef-title">
                    <div class="container">
                        <div class="section-head">
                            <div>
                                <span class="label label-lg eyebrow">Por qué comprar aquí</span>
                                <h2 class="h-lg" id="benef-title">Compra sin complicaciones —</h2>
                            </div>
                        </div>
                        <div class="benefits-grid">
                            <article class="benefit"><span class="benefit-icon">${icons.coin()}</span><h3>Precios en USDT</h3><p>Ves el precio final desde el catálogo, sin conversiones confusas.</p></article>
                            <article class="benefit"><span class="benefit-icon">${icons.truck()}</span><h3>Envíos a todo el país</h3><p>Coordinamos el envío contigo según tu destino.</p></article>
                            <article class="benefit"><span class="benefit-icon">${icons.file()}</span><h3>Comprobante en PDF</h3><p>Al confirmar tu pedido recibes la factura en tu correo.</p></article>
                            <article class="benefit"><span class="benefit-icon">${icons.chat()}</span><h3>Pago por WhatsApp</h3><p>Hablas directo con nosotros para acordar el pago.</p></article>
                        </div>
                        <div class="stats" id="stats">
                            <div class="stat"><strong data-count="0" id="stat-prod">0</strong><span>Prendas disponibles</span></div>
                            <div class="stat"><strong data-count="0" id="stat-cat">0</strong><span>Categorías</span></div>
                            <div class="stat"><strong data-count="3">0</strong><span>Pasos para comprar</span></div>
                        </div>
                    </div>
                </section>`);

            // Corrige el título de "Cómo comprar"
            const como = $('como-title');
            if (como) como.textContent = 'Cómo comprar —';

            // FAQ + banner final (después de "Cómo comprar")
            const faqs = [
                ['¿Cómo pago mi pedido?', 'Los precios están en USDT. Al confirmar el pedido te escribimos por WhatsApp para acordar el pago.'],
                ['¿Cuánto cuesta el envío?', 'Se coordina contigo según tu destino. Lo acordamos por WhatsApp antes de pagar.'],
                ['¿Recibo algún comprobante?', 'Sí. Al confirmar el pedido enviamos la factura proforma en PDF a tu correo.'],
                ['¿Necesito una cuenta para comprar?', 'No es obligatoria. Con cuenta tus datos se completan solos al confirmar un pedido.'],
                ['¿Puedo comprar una sola prenda?', 'Claro. Con “Comprar ahora” haces un pedido directo sin mezclarlo con tu carrito.']
            ];
            $('como-comprar')?.insertAdjacentHTML('afterend', `
                <section class="section" id="faq" aria-labelledby="faq-title">
                    <div class="container faq-layout">
                        <div>
                            <span class="label label-lg eyebrow muted">Resolvemos tus dudas</span>
                            <h2 class="h-lg" id="faq-title">Preguntas frecuentes —</h2>
                            <p class="muted" style="margin-top:16px;max-width:36ch">¿Algo más? Escríbenos por WhatsApp al confirmar tu pedido.</p>
                        </div>
                        <div class="faq-list">
                            ${faqs.map(([q, a], i) => `
                            <div class="faq-item">
                                <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-${i}">
                                    <span>${esc(q)}</span><span class="plus">${icons.plus(16)}</span>
                                </button>
                                <div class="faq-a" id="faq-a-${i}" role="region"><div><p>${esc(a)}</p></div></div>
                            </div>`).join('')}
                        </div>
                    </div>
                </section>
                <section class="section" aria-label="Llamado a la acción">
                    <div class="container">
                        <div class="cta-banner">
                            <div>
                                <h2 class="display" style="font-size:clamp(40px,5vw,64px)">Estrena algo nuevo —</h2>
                                <p>Elige tu prenda, confirma el pedido y coordinamos el resto contigo.</p>
                            </div>
                            <a class="btn btn-light" href="#catalogo">Ver catálogo <span class="arrow">→</span></a>
                        </div>
                    </div>
                </section>`);

            // FAQ acordeón
            document.querySelector('.faq-list')?.addEventListener('click', (e) => {
                const q = e.target.closest('.faq-q');
                if (!q) return;
                const item = q.closest('.faq-item');
                const open = !item.classList.contains('open');
                item.parentElement.querySelectorAll('.faq-item.open').forEach((i) => {
                    i.classList.remove('open');
                    i.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
                });
                item.classList.toggle('open', open);
                q.setAttribute('aria-expanded', String(open));
            });

            // Reveal de las secciones
            revealAll('.section-head, .step, .benefit, .stat, .faq-item, .cta-banner, .rail-nav', true);
        }

        /* ---------- Carga ---------- */
        async function load() {
            renderSkeleton();
            try {
                const [prod, cats] = await Promise.all([
                    api('/productos'),
                    api('/categorias').catch(() => ({ datos: [] }))
                ]);

                state.all = (prod.datos || []).map((p) => ({
                    ...p,
                    precio_usdt: Number(p.precio_usdt),
                    _name: norm(p.nombre),
                    _text: norm([p.nombre, p.descripcion, p.color, p.talla, p.nombre_categoria].join(' ')),
                    _words: new Set(norm([p.nombre, p.color, p.talla, p.nombre_categoria].join(' ')).split(/[^a-z0-9]+/))
                }));
                state.categorias = cats.datos || [];
                state.newestIds = new Set([...state.all].sort(SORTS.recientes).slice(0, 4).map((p) => p.id_producto));
                if (state.cat && !state.categorias.some((c) => String(c.id_categoria) === state.cat)) state.cat = '';

                $('sort').value = state.sort;
                renderHero();
                renderChips();
                renderRail();
                renderStats();
                render();
            } catch (err) {
                renderError(err.message);
            }
        }

        /* ---------- Filtro y orden ---------- */
        const FILLER = new Set(['talla', 'color']);

        function searchTokens(q) {
            const tokens = norm(q).split(/\s+/).filter(Boolean);
            const meaningful = tokens.filter((t) => !FILLER.has(t));
            return meaningful.length ? meaningful : tokens;
        }

        const matches = (p, t) => (t.length <= 2 ? p._words.has(t) : p._text.includes(t));

        function visibleProducts() {
            const tokens = searchTokens(state.q);
            const list = state.all.filter((p) =>
                (!state.cat || String(p.id_categoria) === state.cat) &&
                tokens.every((t) => matches(p, t))
            );
            if (tokens.length && state.sort === 'recientes') {
                const score = (p) => tokens.reduce((s, t) => s + (p._name.includes(t) ? 2 : 0), 0);
                return list.sort((a, b) => score(b) - score(a) || SORTS.recientes(a, b));
            }
            return list.sort(SORTS[state.sort]);
        }

        /* ---------- Render ---------- */
        let heroTimer = null;
        function renderHero() {
            const media = $('hero-media');
            const slides = state.all.filter((p) => p.imagen_url).sort(SORTS.recientes).slice(0, 4);
            if (!slides.length) return;

            media.removeAttribute('aria-hidden');
            media.innerHTML = slides.map((p, i) => `
                <a class="hero-slide ${i === 0 ? 'active' : ''}" href="producto.html?id=${p.id_producto}" ${i ? 'tabindex="-1"' : ''} aria-label="${esc(p.nombre)}">
                    <img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" ${i ? 'loading="lazy"' : ''}>
                </a>`).join('') + `
                <div class="hero-tag" aria-live="polite">
                    <span class="label" id="hero-tag-name"></span>
                    <strong id="hero-tag-price"></strong>
                </div>
                <div class="hero-dots">${slides.map((_, i) => `<button type="button" class="${i === 0 ? 'active' : ''}" aria-label="Ver prenda ${i + 1}"></button>`).join('')}</div>`;

            let idx = 0;
            const els = [...media.querySelectorAll('.hero-slide')];
            const dots = [...media.querySelectorAll('.hero-dots button')];
            const setTag = () => {
                $('hero-tag-name').textContent = slides[idx].nombre;
                $('hero-tag-price').textContent = usdt(slides[idx].precio_usdt);
            };
            const go = (n) => {
                idx = (n + slides.length) % slides.length;
                els.forEach((el, i) => { el.classList.toggle('active', i === idx); el.tabIndex = i === idx ? 0 : -1; });
                dots.forEach((d, i) => d.classList.toggle('active', i === idx));
                setTag();
            };
            const start = () => {
                clearInterval(heroTimer);
                if (slides.length > 1 && !REDUCED) heroTimer = setInterval(() => go(idx + 1), 4800);
            };
            dots.forEach((d, i) => d.addEventListener('click', () => { go(i); start(); }));
            media.addEventListener('mouseenter', () => clearInterval(heroTimer));
            media.addEventListener('mouseleave', start);
            setTag();
            start();
        }

        function renderChips() {
            const chip = (id, label) =>
                `<button class="chip" type="button" data-cat="${esc(id)}" aria-pressed="${String(state.cat) === String(id)}">${esc(label)}</button>`;
            $('chips').innerHTML = chip('', 'Todas') +
                state.categorias.map((c) => chip(c.id_categoria, c.nombre_categoria)).join('');
        }

        function cardHTML(p) {
            return `
            <article class="card">
                <a class="card-link" href="producto.html?id=${p.id_producto}">
                    <div class="card-media">
                        ${state.newestIds.has(p.id_producto) ? '<span class="badge">Nuevo</span>' : ''}
                        <img src="${esc(imgOf(p))}" alt="${esc(p.nombre)}" loading="lazy">
                    </div>
                    <h3 class="card-title">${esc(p.nombre)}</h3>
                    <p class="card-meta">${esc(p.nombre_categoria || 'General')}</p>
                    <p class="card-meta mono">${esc(p.color)} / ${esc(p.talla)}</p>
                    <p class="card-price">${usdt(p.precio_usdt)}</p>
                </a>
                <button class="btn btn-ghost card-add" type="button" data-add="${p.id_producto}">Agregar al carrito +</button>
            </article>`;
        }

        function render() {
            const list = visibleProducts();
            const n = list.length;
            const grid = $('grid');
            const status = $('status');

            $('result-count').textContent = state.q
                ? `${n} resultado${n === 1 ? '' : 's'} para “${state.q}”`
                : `${n} producto${n === 1 ? '' : 's'}`;

            if (n === 0) {
                grid.innerHTML = '';
                const filtered = state.q || state.cat;
                status.innerHTML = `
                    <div class="status-box">
                        <h3 class="h-md">${filtered ? 'No encontramos productos con esos filtros.' : 'Aún no hay productos disponibles.'}</h3>
                        <p class="muted">${filtered ? 'Prueba con otra palabra, revisa la ortografía o quita los filtros.' : 'Vuelve pronto: estamos actualizando el catálogo.'}</p>
                        ${filtered ? '<button class="btn btn-outline" type="button" id="btn-reset">Quitar filtros</button>' : ''}
                    </div>`;
                return;
            }
            status.innerHTML = '';
            grid.innerHTML = list.map(cardHTML).join('');
            reveal(grid, '.card');
        }

        function renderRail() {
            const rail = $('rail');
            if (!rail) return;
            const newest = [...state.all].sort(SORTS.recientes).slice(0, 8);
            if (!newest.length) { $('novedades').hidden = true; return; }
            $('novedades').hidden = false;
            rail.innerHTML = newest.map(cardHTML).join('');
            reveal(rail, '.card');
            updateRailButtons();
        }

        function renderStats() {
            const prod = $('stat-prod');
            const cat = $('stat-cat');
            if (prod) prod.dataset.count = state.all.length;
            if (cat) cat.dataset.count = state.categorias.length;
            const wrap = $('stats');
            if (!wrap) return;
            onVisible(wrap, () => wrap.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count))));
        }

        function renderSkeleton() {
            $('status').innerHTML = '';
            $('grid').innerHTML = Array.from({ length: 8 }, () => `
                <div class="card skeleton" aria-hidden="true">
                    <div class="card-media"></div>
                    <div class="line"></div><div class="line w60"></div><div class="line w40"></div>
                </div>`).join('');
        }

        function renderError(message) {
            $('grid').innerHTML = '';
            $('result-count').textContent = '';
            $('status').innerHTML = `
                <div class="status-box">
                    <h3 class="h-md">No pudimos cargar los productos.</h3>
                    <p class="error-text">${esc(message)}</p>
                    <button class="btn btn-outline" type="button" id="btn-retry">Reintentar</button>
                </div>`;
        }

        /* ---------- Carrusel ---------- */
        function updateRailButtons() {
            const rail = $('rail');
            if (!rail) return;
            $('rail-prev').disabled = rail.scrollLeft <= 4;
            $('rail-next').disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
        }
        function bindRail() {
            const rail = $('rail');
            if (!rail) return;
            const step = () => Math.max(240, rail.clientWidth * 0.8);
            $('rail-prev').addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
            $('rail-next').addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
            rail.addEventListener('scroll', debounce(updateRailButtons, 60), { passive: true });
            window.addEventListener('resize', debounce(updateRailButtons, 120));

            // Arrastrar con el ratón
            let down = false, startX = 0, startLeft = 0, moved = false;
            rail.addEventListener('pointerdown', (e) => {
                if (e.pointerType !== 'mouse') return;
                down = true; moved = false; startX = e.clientX; startLeft = rail.scrollLeft;
            });
            window.addEventListener('pointermove', (e) => {
                if (!down) return;
                const dx = e.clientX - startX;
                if (Math.abs(dx) > 5) { moved = true; rail.classList.add('dragging'); }
                if (moved) rail.scrollLeft = startLeft - dx;
            });
            window.addEventListener('pointerup', () => {
                if (!down) return;
                down = false;
                setTimeout(() => rail.classList.remove('dragging'), 0);
            });
        }

        /* ---------- URL ---------- */
        function syncUrl() {
            const p = new URLSearchParams();
            if (state.q) p.set('q', state.q);
            if (state.cat) p.set('cat', state.cat);
            if (state.sort !== 'recientes') p.set('sort', state.sort);
            const qs = p.toString();
            history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
        }
        function update() { syncUrl(); render(); }

        /* ---------- Agregar al carrito (grid y carrusel) ---------- */
        function onAdd(e) {
            const btn = e.target.closest('[data-add]');
            if (!btn) return;
            const product = state.all.find((p) => p.id_producto === Number(btn.dataset.add));
            if (!product) return;
            Cart.add(product, 1);
            fly(btn, imgOf(product));
            toast('Agregado al carrito.', { href: 'carrito.html', linkText: 'Ver carrito' });
        }

        /* ---------- Eventos ---------- */
        $('chips').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-cat]');
            if (!btn) return;
            state.cat = btn.dataset.cat;
            renderChips();
            update();
        });
        $('sort').addEventListener('change', (e) => { state.sort = e.target.value; update(); });
        $('grid').addEventListener('click', onAdd);

        $('status').addEventListener('click', (e) => {
            if (e.target.id === 'btn-retry') load();
            if (e.target.id === 'btn-reset') {
                state.q = ''; state.cat = '';
                $('site-search').value = '';
                $('site-search-clear').hidden = true;
                renderChips();
                update();
            }
        });

        document.addEventListener('site:search', (e) => {
            state.q = e.detail.q;
            update();
            if (e.detail.submit) $('catalogo').scrollIntoView({ behavior: 'smooth' });
        });

        // Parallax suave de la imagen del hero
        document.addEventListener('site:scroll', (e) => {
            if (REDUCED || e.detail.y > 900) return;
            $('hero-media').style.setProperty('--py', `${e.detail.y * 0.07}px`);
        });

        /* ---------- Inicio ---------- */
        splitWords($('hero-title'));
        injectSections();
        revealAll('#catalogo .section-head, #chips', false);
        bindRail();
        // La categoría/búsqueda de la URL no debe saltar hasta el catálogo si hay hash
        load().then(() => {
            if (location.hash) $(location.hash.slice(1))?.scrollIntoView();
        });
    }

    /* ======================================================================
       3. PRODUCTO
       ====================================================================== */
    function initProducto() {
        const root = $('product-root');
        let product = null;

        function renderSkeleton() {
            root.innerHTML = `
                <div class="product-layout skeleton" aria-hidden="true">
                    <div class="product-media"></div>
                    <div>
                        <div class="line w40"></div><div class="line" style="height:40px;margin-top:16px"></div>
                        <div class="line w60" style="margin-top:24px"></div>
                        <div class="line" style="height:96px;margin-top:24px"></div>
                    </div>
                </div>`;
        }

        function renderMessage(title, text, isError = false) {
            root.innerHTML = `
                <div class="status-box">
                    <h1 class="h-md" style="margin-bottom:12px">${esc(title)}</h1>
                    <p class="${isError ? 'error-text' : 'muted'}">${esc(text)}</p>
                    <a class="btn btn-outline" href="index.html#catalogo">Volver al catálogo</a>
                </div>`;
        }

        function renderProduct(p) {
            document.title = `${p.nombre} — ModaUSDT`;
            const cat = p.nombre_categoria || 'General';
            const catLink = p.id_categoria ? `index.html?cat=${encodeURIComponent(p.id_categoria)}#catalogo` : 'index.html#catalogo';

            root.innerHTML = `
                <nav class="breadcrumb label" aria-label="Ruta de navegación">
                    <a href="index.html">Tienda</a><span aria-hidden="true">/</span>
                    <a href="${catLink}">${esc(cat)}</a><span aria-hidden="true">/</span>
                    <span aria-current="page">${esc(p.nombre)}</span>
                </nav>

                <div class="product-layout">
                    <div class="product-media" id="product-media"><img id="product-img" src="${esc(imgOf(p))}" alt="${esc(p.nombre)}"></div>

                    <div class="product-info">
                        <p class="label">${esc(cat)}</p>
                        <h1 class="product-title">${esc(p.nombre)}</h1>
                        <p class="product-price">${usdt(p.precio_usdt)}</p>
                        <p class="product-desc">${esc(p.descripcion) || 'Esta prenda aún no tiene descripción.'}</p>

                        <dl class="specs">
                            <div><dt>Color</dt><dd>${esc(p.color)}</dd></div>
                            <div><dt>Talla</dt><dd>${esc(p.talla)}</dd></div>
                            <div><dt>Referencia</dt><dd class="mono">${sku(p.id_producto)}</dd></div>
                        </dl>

                        <div class="buy-box">
                            <div class="buy-qty">
                                <div class="qty" role="group" aria-label="Cantidad">
                                    <button type="button" id="qty-minus" aria-label="Disminuir cantidad">${icons.minus()}</button>
                                    <input type="number" id="qty" value="1" min="1" max="99" inputmode="numeric" aria-label="Cantidad">
                                    <button type="button" id="qty-plus" aria-label="Aumentar cantidad">${icons.plus()}</button>
                                </div>
                                <p class="buy-total">Total: <strong id="buy-total">${usdt(p.precio_usdt)}</strong></p>
                            </div>
                            <button class="btn btn-solid btn-block" type="button" id="btn-add">Agregar al carrito</button>
                            <button class="btn btn-outline btn-block" type="button" id="btn-buy">Comprar ahora <span class="arrow">→</span></button>
                        </div>

                        <ul class="notes">
                            <li>Pagas en USDT: coordinamos el pago contigo por WhatsApp.</li>
                            <li>Recibes el comprobante del pedido en PDF en tu correo.</li>
                        </ul>
                    </div>
                </div>`;
            bindActions();
            revealAll('.product-media, .product-info > *', true);
        }

        function bindActions() {
            const qtyInput = $('qty');
            const total = $('buy-total');
            const getQty = () => Cart.clampQty(qtyInput.value);
            const setQty = (n) => {
                qtyInput.value = Cart.clampQty(n);
                total.textContent = usdt(product.precio_usdt * getQty());
                pop(total);
            };

            $('qty-minus').addEventListener('click', () => setQty(getQty() - 1));
            $('qty-plus').addEventListener('click', () => setQty(getQty() + 1));
            qtyInput.addEventListener('change', () => setQty(qtyInput.value));

            $('btn-add').addEventListener('click', (e) => {
                Cart.add(product, getQty());
                fly($('product-img') || e.currentTarget, imgOf(product));
                toast('Agregado al carrito.', { href: 'carrito.html', linkText: 'Ver carrito' });
            });

            $('btn-buy').addEventListener('click', () => {
                store.set(KEYS.direct, Cart.toItem(product, getQty()), sessionStorage);
                location.href = 'carrito.html?directo=1';
            });

            // Zoom que sigue al cursor
            const media = $('product-media');
            media.addEventListener('mousemove', (e) => {
                const r = media.getBoundingClientRect();
                media.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
                media.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
            });
        }

        async function loadRelated() {
            try {
                const { datos } = await api('/productos');
                const others = datos.filter((p) => p.id_producto !== product.id_producto);
                const same = others.filter((p) => p.id_categoria === product.id_categoria);
                const list = (same.length ? same : others).slice(0, 4);
                if (!list.length) return;

                $('related-grid').innerHTML = list.map((p) => `
                    <article class="card">
                        <a class="card-link" href="producto.html?id=${p.id_producto}">
                            <div class="card-media"><img src="${esc(imgOf(p))}" alt="${esc(p.nombre)}" loading="lazy"></div>
                            <h3 class="card-title">${esc(p.nombre)}</h3>
                            <p class="card-meta">${esc(p.nombre_categoria || 'General')}</p>
                            <p class="card-price">${usdt(p.precio_usdt)}</p>
                        </a>
                    </article>`).join('');
                $('related-section').hidden = false;
                reveal($('related-grid'), '.card');
            } catch { /* los relacionados son opcionales */ }
        }

        async function init() {
            const id = parseInt(param('id'), 10);
            if (!id) return renderMessage('Producto no encontrado', 'El enlace no incluye un producto válido.');

            renderSkeleton();
            try {
                const { datos } = await api(`/productos/${id}`);
                if (Number(datos.estado) !== 1) {
                    return renderMessage('Producto no disponible', 'Esta prenda está agotada o fue retirada del catálogo.');
                }
                product = { ...datos, precio_usdt: Number(datos.precio_usdt) };
                renderProduct(product);
                loadRelated();
            } catch (err) {
                renderMessage('No pudimos cargar el producto', err.message, true);
            }
        }

        init();
    }

    /* ======================================================================
       4. ACCESO
       ====================================================================== */
    function initAcceso() {
        const redirectTo = Auth.safeRedirect(param('redirect'), 'index.html');

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

        // Botón mostrar / ocultar contraseña
        document.querySelectorAll('input[type="password"]').forEach((input) => {
            const wrap = document.createElement('div');
            wrap.className = 'input-wrap';
            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(input);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pw-toggle label';
            btn.textContent = 'Ver';
            btn.setAttribute('aria-label', 'Mostrar contraseña');
            btn.addEventListener('click', () => {
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                btn.textContent = show ? 'Ocultar' : 'Ver';
                btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
            });
            wrap.appendChild(btn);
        });

        // Burbujas decorativas del panel
        const panel = document.querySelector('.auth-panel');
        if (panel) panel.insertAdjacentHTML('afterbegin', '<div class="hero-blobs" aria-hidden="true"><span></span><span></span><span></span></div>');
        splitWords(document.querySelector('.auth-panel .display'));

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

        $('tab-login').addEventListener('click', () => selectTab('login'));
        $('tab-registro').addEventListener('click', () => selectTab('registro'));
        $('btn-logout').addEventListener('click', () => {
            Auth.logout();
            location.href = 'index.html';
        });

        selectTab(param('tab'));
        showView();
    }

    /* ======================================================================
       5. CARRITO Y CHECKOUT
       ====================================================================== */
    function initCarrito() {
        const isDirect = new URLSearchParams(location.search).get('directo') === '1';
        let items = [];
        let catalog = [];
        let lastTotal = null;

        /* ---------- Piezas inyectadas: pasos, herramientas y confianza ---------- */
        document.querySelector('.page-head')?.insertAdjacentHTML('afterend', `
            <ol class="cart-steps" id="cart-steps" aria-label="Progreso del pedido">
                <li class="cart-step active" data-step="1"><i>1</i><span class="label">Carrito</span></li>
                <li class="cart-sep" aria-hidden="true"></li>
                <li class="cart-step" data-step="2"><i>2</i><span class="label">Tus datos</span></li>
                <li class="cart-sep" aria-hidden="true"></li>
                <li class="cart-step" data-step="3"><i>3</i><span class="label">Confirmación</span></li>
            </ol>`);

        document.querySelector('.invoice-table')?.insertAdjacentHTML('beforebegin', `
            <div class="invoice-tools">
                <a class="btn btn-ghost" href="index.html#catalogo">← Seguir comprando</a>
                <button class="btn btn-ghost danger" type="button" id="btn-clear" ${isDirect ? 'hidden' : ''}>Vaciar carrito</button>
            </div>`);

        $('form-checkout')?.insertAdjacentHTML('afterend', `
            <ul class="trust">
                <li>${icons.shield(20)}<span>Tus datos solo se usan para tu pedido.</span></li>
                <li>${icons.file(20)}<span>Comprobante en PDF en tu correo.</span></li>
                <li>${icons.chat(20)}<span>Pago y envío acordados por WhatsApp.</span></li>
            </ul>`);

        document.querySelector('.page.container, .container.page')?.insertAdjacentHTML('beforeend', `
            <section class="suggest" id="cart-suggest" hidden aria-labelledby="suggest-title">
                <div class="section-head"><h2 class="h-lg" id="suggest-title">Completa tu pedido —</h2></div>
                <div class="grid" id="suggest-grid"></div>
            </section>`);

        function setStep(n) {
            document.querySelectorAll('#cart-steps .cart-step').forEach((el) => {
                const s = Number(el.dataset.step);
                el.classList.toggle('active', s === n);
                el.classList.toggle('done', s < n);
                el.querySelector('i').innerHTML = s < n ? icons.check(14) : String(s);
            });
        }

        /* ---------- Persistencia ---------- */
        function loadItems() {
            if (isDirect) {
                const item = store.get(KEYS.direct, null, sessionStorage);
                return item ? [item] : [];
            }
            return Cart.items();
        }

        function persist() {
            if (isDirect) {
                if (items[0]) store.set(KEYS.direct, items[0], sessionStorage);
                else store.remove(KEYS.direct, sessionStorage);
            } else {
                Cart.save(items);
            }
        }

        /* ---------- Render ---------- */
        function rowHTML(it, i) {
            const subtotal = it.cantidad * it.precio_usdt;
            return `
            <tr data-id="${it.id_producto}" style="animation-delay:${i * 50}ms">
                <td class="col-product">
                    <div class="line-product">
                        <a class="line-img" href="producto.html?id=${it.id_producto}"><img src="${esc(imgOf(it))}" alt="${esc(it.nombre)}"></a>
                        <div>
                            <a class="line-name" href="producto.html?id=${it.id_producto}">${esc(it.nombre)}</a>
                            <p class="line-meta">${esc(it.color)} / Talla ${esc(it.talla)}</p>
                            <p class="line-meta mono">${sku(it.id_producto)}</p>
                            <p class="line-meta line-unit">${usdt(it.precio_usdt)} c/u</p>
                        </div>
                    </div>
                </td>
                <td class="col-price num">${money(it.precio_usdt)}</td>
                <td class="col-qty center">
                    <div class="qty" role="group" aria-label="Cantidad de ${esc(it.nombre)}">
                        <button type="button" data-act="minus" aria-label="Disminuir cantidad" ${it.cantidad <= 1 ? 'disabled' : ''}>${icons.minus()}</button>
                        <input type="number" data-act="set" value="${it.cantidad}" min="1" max="99" inputmode="numeric" aria-label="Cantidad">
                        <button type="button" data-act="plus" aria-label="Aumentar cantidad" ${it.cantidad >= 99 ? 'disabled' : ''}>${icons.plus()}</button>
                    </div>
                </td>
                <td class="col-sub num">${money(subtotal)}</td>
                <td class="col-rm">
                    <button class="line-remove" type="button" data-act="remove" aria-label="Quitar ${esc(it.nombre)}">${icons.trash()}</button>
                </td>
            </tr>`;
        }

        function render(animateRows = true) {
            const empty = items.length === 0;
            $('cart-empty').hidden = !empty;
            $('cart-layout').hidden = empty;
            $('direct-banner').hidden = !isDirect || empty;
            $('cart-steps').hidden = empty && !$('modal-confirmacion').classList.contains('active');

            if (empty && !$('cart-empty').dataset.art) {
                $('cart-empty').dataset.art = '1';
                $('cart-empty').insertAdjacentHTML('afterbegin', `<span class="empty-art">${icons.bag(72)}</span>`);
            }

            const units = Cart.count(items);
            $('cart-sub').textContent = empty ? '' : `${units} artículo${units === 1 ? '' : 's'} en tu pedido.`;
            renderSuggest();
            if (empty) return;

            $('inv-body').innerHTML = items.map(rowHTML).join('');
            if (!animateRows) $('inv-body').querySelectorAll('tr').forEach((tr) => { tr.style.animation = 'none'; });

            const total = Cart.total(items);
            $('tot-items').textContent = units;
            $('tot-sub').textContent = money(total);
            $('tot-total').textContent = usdt(total);
            if (lastTotal !== null && lastTotal !== total) pop($('tot-total'));
            lastTotal = total;
        }

        function renderSuggest() {
            const box = $('cart-suggest');
            if (!box) return;
            if (isDirect || !items.length || !catalog.length) { box.hidden = true; return; }
            const inCart = new Set(items.map((i) => i.id_producto));
            const list = catalog.filter((p) => !inCart.has(p.id_producto)).slice(0, 4);
            if (!list.length) { box.hidden = true; return; }
            box.hidden = false;
            $('suggest-grid').innerHTML = list.map((p) => `
                <article class="card">
                    <a class="card-link" href="producto.html?id=${p.id_producto}">
                        <div class="card-media"><img src="${esc(imgOf(p))}" alt="${esc(p.nombre)}" loading="lazy"></div>
                        <h3 class="card-title">${esc(p.nombre)}</h3>
                        <p class="card-meta mono">${esc(p.color)} / ${esc(p.talla)}</p>
                        <p class="card-price">${usdt(p.precio_usdt)}</p>
                    </a>
                    <button class="btn btn-ghost card-add" type="button" data-suggest="${p.id_producto}">Agregar al pedido +</button>
                </article>`).join('');
            reveal($('suggest-grid'), '.card');
        }

        /* ---------- Acciones sobre las líneas ---------- */
        $('inv-body').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (!btn || btn.tagName === 'INPUT') return;
            const id = Number(btn.closest('tr').dataset.id);
            const line = items.find((i) => i.id_producto === id);
            if (!line) return;

            if (btn.dataset.act === 'plus') line.cantidad = Cart.clampQty(line.cantidad + 1);
            if (btn.dataset.act === 'minus') line.cantidad = Cart.clampQty(line.cantidad - 1);
            if (btn.dataset.act === 'remove') items = items.filter((i) => i.id_producto !== id);

            persist();
            render(btn.dataset.act === 'remove');
        });

        $('inv-body').addEventListener('change', (e) => {
            if (e.target.dataset.act !== 'set') return;
            const id = Number(e.target.closest('tr').dataset.id);
            const line = items.find((i) => i.id_producto === id);
            if (line) line.cantidad = Cart.clampQty(e.target.value);
            persist();
            render(false);
        });

        $('btn-clear')?.addEventListener('click', () => {
            if (!items.length || !confirm('¿Vaciar todo el carrito?')) return;
            items = [];
            persist();
            render();
        });

        $('suggest-grid')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-suggest]');
            if (!btn) return;
            const p = catalog.find((x) => x.id_producto === Number(btn.dataset.suggest));
            if (!p) return;
            fly(btn, imgOf(p));
            Cart.add({ ...p, precio_usdt: Number(p.precio_usdt) }, 1);
            items = Cart.items();
            render(false);
            toast('Agregado a tu pedido.');
        });

        /* ---------- Sincroniza con el catálogo ---------- */
        async function syncWithCatalog() {
            try {
                const { datos } = await api('/productos');
                catalog = datos;
                if (!items.length) { renderSuggest(); return; }
                const byId = new Map(datos.map((p) => [p.id_producto, p]));
                const before = items.length;

                items = items.filter((it) => {
                    const p = byId.get(it.id_producto);
                    if (!p) return false;
                    Object.assign(it, {
                        nombre: p.nombre,
                        precio_usdt: Number(p.precio_usdt),
                        color: p.color,
                        talla: p.talla,
                        imagen_url: p.imagen_url || ''
                    });
                    return true;
                });

                persist();
                render(false);
                if (items.length < before) toast('Quitamos del pedido las prendas que ya no están disponibles.');
            } catch { /* sin conexión: se muestran los datos guardados */ }
        }

        /* ---------- Datos del cliente ---------- */
        function prefillClient() {
            const user = Auth.user();
            if (user) {
                $('cliente-nombre').value = user.nombre || '';
                $('cliente-correo').value = user.correo || '';
            }
            $('cliente-telefono').value = store.get(KEYS.phone, '') || '';
            $('login-hint').hidden = !!user;
            updateInvoiceClient();
        }

        function updateInvoiceClient() {
            const name = $('cliente-nombre').value.trim();
            $('inv-client').textContent = `Cliente: ${name || 'sin nombre'}`;
        }
        $('cliente-nombre').addEventListener('input', updateInvoiceClient);
        $('form-checkout').addEventListener('focusin', () => {
            if (!$('modal-confirmacion').classList.contains('active')) setStep(2);
        });
        $('inv-date').textContent = new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });

        /* ---------- Checkout ---------- */
        $('form-checkout').addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = $('checkout-msg');
            const btn = $('btn-procesar');
            const setMsg = (text, type) => { msg.textContent = text; msg.className = `form-msg ${type || ''}`; };

            const cliente_nombre = $('cliente-nombre').value.trim();
            const cliente_correo = $('cliente-correo').value.trim();
            const cliente_telefono = $('cliente-telefono').value.trim();

            if (!items.length) return;
            if (!cliente_nombre || !cliente_correo || !cliente_telefono) return setMsg('Completa todos los datos para continuar.', 'error');
            if (!/^\S+@\S+\.\S+$/.test(cliente_correo)) return setMsg('Escribe un correo válido.', 'error');
            if (!/^[0-9+\s()-]{7,20}$/.test(cliente_telefono)) return setMsg('Escribe un teléfono válido, por ejemplo 04120000000.', 'error');

            btn.disabled = true;
            btn.textContent = 'Procesando pedido...';
            setMsg('');

            try {
                const { datos } = await api('/checkout', {
                    method: 'POST',
                    body: {
                        id_usuario: Auth.user()?.id_usuario ?? null,
                        cliente_nombre,
                        cliente_correo,
                        cliente_telefono,
                        items: items.map(({ id_producto, nombre, precio_usdt, color, talla, cantidad }) =>
                            ({ id_producto, nombre, precio_usdt, color, talla, cantidad }))
                    }
                });

                store.set(KEYS.phone, cliente_telefono);
                items = [];
                if (isDirect) store.remove(KEYS.direct, sessionStorage);
                else Cart.clear();

                $('conf-id').textContent = `#${datos.id_pedido}`;
                $('conf-total').textContent = usdt(datos.total_usdt);
                $('conf-whatsapp').href = datos.whatsapp_url;
                setStep(4);
                Modal.open('modal-confirmacion');
                render();
                confetti();
            } catch (err) {
                setMsg(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Confirmar pedido';
            }
        });

        /* ---------- Inicio ---------- */
        $('conf-close-icon').innerHTML = icons.close();
        $('conf-title').insertAdjacentHTML('beforebegin', `<div class="success-mark">${icons.check(30)}</div>`);
        items = loadItems();
        render();
        prefillClient();
        syncWithCatalog();
        revealAll('.page-head, .cart-steps, .invoice, .checkout', true);
    }

    /* ======================================================================
       6. ADMIN
       ====================================================================== */
    function initAdmin() {
        if (!Auth.isAdmin()) {
            location.replace('acceso.html?redirect=admin.html');
            return;
        }

        const state = { productos: [], categorias: [], q: '', cat: '' };

        document.querySelector('.admin-bar')?.insertAdjacentHTML('beforebegin', `
            <div class="stats-row" id="admin-stats">
                <div class="stat-card"><p class="label">Productos</p><strong id="st-total">0</strong></div>
                <div class="stat-card"><p class="label">Disponibles</p><strong id="st-on">0</strong></div>
                <div class="stat-card"><p class="label">Agotados</p><strong id="st-off">0</strong></div>
                <div class="stat-card"><p class="label">Valor disponible (USDT)</p><strong id="st-val">0</strong></div>
            </div>`);

        function renderStats() {
            const on = state.productos.filter((p) => Number(p.estado) === 1);
            const value = on.reduce((s, p) => s + Number(p.precio_usdt || 0), 0);
            countUp($('st-total'), state.productos.length, 900);
            countUp($('st-on'), on.length, 900);
            countUp($('st-off'), state.productos.length - on.length, 900);
            countUp($('st-val'), Math.round(value), 1200);
        }

        async function loadCategorias() {
            try {
                state.categorias = (await api('/categorias')).datos || [];
            } catch { state.categorias = []; }

            const options = state.categorias
                .map((c) => `<option value="${esc(c.id_categoria)}">${esc(c.nombre_categoria)}</option>`).join('');
            $('admin-categoria').innerHTML = `<option value="">Todas las categorías</option>${options}`;
            $('prod-categoria').innerHTML = `<option value="">Selecciona una categoría</option>${options}`;
        }

        async function loadProductos() {
            try {
                state.productos = (await api('/productos/admin')).datos || [];
                renderStats();
                render();
            } catch (err) {
                $('tabla-body').innerHTML = `<tr><td colspan="7" class="table-empty">${esc(err.message)}</td></tr>`;
                $('admin-count').textContent = '';
            }
        }

        function filtered() {
            const tokens = norm(state.q).split(/\s+/).filter(Boolean);
            return state.productos.filter((p) => {
                const text = norm([p.nombre, p.color, p.talla, p.descripcion].join(' '));
                return tokens.every((t) => text.includes(t)) &&
                    (!state.cat || String(p.id_categoria) === state.cat);
            });
        }

        function render() {
            const list = filtered();
            $('admin-count').textContent = `${list.length} de ${state.productos.length}`;

            if (!list.length) {
                $('tabla-body').innerHTML = '<tr><td colspan="7" class="table-empty">No hay productos que coincidan con la búsqueda.</td></tr>';
                return;
            }

            $('tabla-body').innerHTML = list.map((p, i) => {
                const active = Number(p.estado) === 1;
                const desc = p.descripcion ? esc(p.descripcion.length > 48 ? p.descripcion.slice(0, 48) + '…' : p.descripcion) : '';
                return `
                <tr style="animation-delay:${Math.min(i, 14) * 25}ms">
                    <td><img class="thumb" src="${esc(imgOf(p))}" alt="" loading="lazy"></td>
                    <td><div class="cell-title">${esc(p.nombre)}</div><div class="cell-sub">${desc}</div></td>
                    <td>${esc(p.nombre_categoria || 'General')}</td>
                    <td><strong>${usdt(p.precio_usdt)}</strong></td>
                    <td>${esc(p.color)} / ${esc(p.talla)}</td>
                    <td><span class="badge badge-inline ${active ? '' : 'badge-outline'}">${active ? 'Disponible' : 'Agotado'}</span></td>
                    <td>
                        <div class="row-actions">
                            <button class="btn btn-outline btn-sm" type="button" data-edit="${p.id_producto}">Editar</button>
                            ${active ? `<button class="btn btn-ghost btn-sm" type="button" data-off="${p.id_producto}">Desactivar</button>` : ''}
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        function setMsg(text, type) {
            $('prod-msg').textContent = text;
            $('prod-msg').className = `form-msg ${type || ''}`;
        }

        function openForm(p) {
            $('form-producto').reset();
            $('modal-prod-title').textContent = p ? 'Editar producto' : 'Crear producto';
            $('prod-id').value = p ? p.id_producto : '';
            $('prod-estado').value = p ? String(p.estado) : '1';
            if (p) {
                $('prod-nombre').value = p.nombre;
                $('prod-precio').value = p.precio_usdt;
                $('prod-categoria').value = p.id_categoria ?? '';
                $('prod-color').value = p.color;
                $('prod-talla').value = p.talla;
                $('prod-imagen').value = p.imagen_url || '';
                $('prod-descripcion').value = p.descripcion || '';
            }
            setMsg('');
            Modal.open('modal-producto');
        }

        $('form-producto').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = $('prod-id').value;
            const payload = {
                nombre: $('prod-nombre').value.trim(),
                precio_usdt: parseFloat($('prod-precio').value) || 0,
                id_categoria: $('prod-categoria').value ? parseInt($('prod-categoria').value, 10) : null,
                color: $('prod-color').value.trim(),
                talla: $('prod-talla').value.trim(),
                imagen_url: $('prod-imagen').value.trim(),
                descripcion: $('prod-descripcion').value.trim(),
                estado: parseInt($('prod-estado').value, 10)
            };

            if (!payload.nombre || payload.precio_usdt <= 0 || !payload.color || !payload.talla) {
                return setMsg('Completa nombre, precio, color y talla.', 'error');
            }
            if (!payload.id_categoria) return setMsg('Selecciona una categoría.', 'error');

            const btn = $('btn-guardar');
            btn.disabled = true;
            setMsg('Guardando cambios...', 'ok');
            try {
                await api(id ? `/productos/${id}` : '/productos', { method: id ? 'PUT' : 'POST', body: payload });
                Modal.close('modal-producto');
                toast(id ? 'Producto actualizado.' : 'Producto creado.');
                await loadProductos();
            } catch (err) {
                setMsg(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });

        $('btn-nuevo').addEventListener('click', () => openForm(null));

        $('tabla-body').addEventListener('click', async (e) => {
            const edit = e.target.closest('[data-edit]');
            const off = e.target.closest('[data-off]');
            if (edit) {
                openForm(state.productos.find((p) => p.id_producto === Number(edit.dataset.edit)));
            } else if (off) {
                if (!confirm('¿Desactivar este producto? Dejará de verse en el catálogo público.')) return;
                try {
                    await api(`/productos/${off.dataset.off}`, { method: 'DELETE' });
                    toast('Producto desactivado.');
                    await loadProductos();
                } catch (err) { alert(err.message); }
            }
        });

        $('admin-busqueda').addEventListener('input', (e) => { state.q = e.target.value; render(); });
        $('admin-categoria').addEventListener('change', (e) => { state.cat = e.target.value; render(); });

        $('btn-logout').addEventListener('click', () => {
            Auth.logout();
            location.href = 'index.html';
        });

        $('admin-search-icon').innerHTML = icons.search();
        $('admin-close-icon').innerHTML = icons.close();
        loadCategorias().then(loadProductos);
        revealAll('.section-head, .stat-card, .admin-bar, .table-wrap', true);
    }

    /* ======================================================================
       7. ARRANQUE SEGÚN LA PÁGINA
       ====================================================================== */
    const page = document.body.dataset.page || ($('product-root') ? 'producto' : '');
    const pages = {
        index: initIndex,
        producto: initProducto,
        acceso: initAcceso,
        carrito: initCarrito,
        admin: initAdmin
    };
    pages[page]?.();
})();