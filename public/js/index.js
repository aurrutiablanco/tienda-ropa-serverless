/* ==========================================================================
   ModaUSDT — Catálogo (index.html)
   Descarga el catálogo una vez y filtra/ordena en el navegador:
   la búsqueda es instantánea, ignora acentos y busca en nombre, descripción,
   color, talla y categoría.
   ========================================================================== */
(() => {
    'use strict';
    const { api, esc, norm, usdt, imgOf, param, Cart, toast } = App;
    const $ = (id) => document.getElementById(id);

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

    /* ---------- Carga ---------- */
    async function load() {
        renderSkeleton();
        try {
            const [prod, cats] = await Promise.all([
                api('/productos'),
                api('/categorias').catch(() => ({ datos: [] })) // las categorías son opcionales
            ]);

            state.all = (prod.datos || []).map((p) => ({
                ...p,
                precio_usdt: Number(p.precio_usdt),
                _name: norm(p.nombre),
                _text: norm([p.nombre, p.descripcion, p.color, p.talla, p.nombre_categoria].join(' ')),
                _words: new Set(norm([p.nombre, p.color, p.talla, p.nombre_categoria].join(' ')).split(/[^a-z0-9]+/))
            }));
            state.categorias = cats.datos || [];
            state.newestIds = new Set(
                [...state.all].sort(SORTS.recientes).slice(0, 4).map((p) => p.id_producto)
            );
            if (state.cat && !state.categorias.some((c) => String(c.id_categoria) === state.cat)) state.cat = '';

            $('sort').value = state.sort;
            renderHero();
            renderChips();
            render();
        } catch (err) {
            renderError(err.message);
        }
    }

    /* ---------- Filtro y orden ---------- */
    const FILLER = new Set(['talla', 'color']); // "talla xl" o "color negro" se entienden igual que "xl" y "negro"

    function searchTokens(q) {
        const tokens = norm(q).split(/\s+/).filter(Boolean);
        const meaningful = tokens.filter((t) => !FILLER.has(t));
        return meaningful.length ? meaningful : tokens;
    }

    // Los términos de 1-2 letras (tallas como s, m, xl o 32) deben coincidir como palabra completa
    const matches = (p, t) => (t.length <= 2 ? p._words.has(t) : p._text.includes(t));

    function visibleProducts() {
        const tokens = searchTokens(state.q);

        const list = state.all.filter((p) =>
            (!state.cat || String(p.id_categoria) === state.cat) &&
            tokens.every((t) => matches(p, t))
        );

        if (tokens.length && state.sort === 'recientes') {
            // Con texto de búsqueda, los que coinciden en el nombre van primero
            const score = (p) => tokens.reduce((s, t) => s + (p._name.includes(t) ? 2 : 0), 0);
            return list.sort((a, b) => score(b) - score(a) || SORTS.recientes(a, b));
        }
        return list.sort(SORTS[state.sort]);
    }

    /* ---------- Render ---------- */
    function renderHero() {
        const withImage = state.all.find((p) => p.imagen_url);
        if (!withImage) return;
        $('hero-media').innerHTML = `<img src="${esc(withImage.imagen_url)}" alt="">`;
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

    /* ---------- URL (para compartir y volver atrás) ---------- */
    function syncUrl() {
        const p = new URLSearchParams();
        if (state.q) p.set('q', state.q);
        if (state.cat) p.set('cat', state.cat);
        if (state.sort !== 'recientes') p.set('sort', state.sort);
        const qs = p.toString();
        history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    }

    function update() { syncUrl(); render(); }

    /* ---------- Eventos ---------- */
    $('chips').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        state.cat = btn.dataset.cat;
        renderChips();
        update();
    });

    $('sort').addEventListener('change', (e) => { state.sort = e.target.value; update(); });

    $('grid').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-add]');
        if (!btn) return;
        const product = state.all.find((p) => p.id_producto === Number(btn.dataset.add));
        if (!product) return;
        Cart.add(product, 1);
        toast('Agregado al carrito.', { href: 'carrito.html', linkText: 'Ver carrito' });
    });

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

    load();
})();
