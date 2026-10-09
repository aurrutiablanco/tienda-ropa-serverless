/* ==========================================================================
   ModaUSDT — Ficha de producto (producto.html?id=ID)
   Acciones: agregar al carrito o iniciar un pedido directo (sin tocar el carrito).
   ========================================================================== */
(() => {
    'use strict';
    const { api, esc, usdt, sku, imgOf, param, store, KEYS, Cart, toast, icons } = App;
    const root = document.getElementById('product-root');
    let product = null;

    /* ---------- Estados ---------- */
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

    /* ---------- Ficha ---------- */
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
                <div class="product-media"><img src="${esc(imgOf(p))}" alt="${esc(p.nombre)}"></div>

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
                        <button class="btn btn-outline btn-block" type="button" id="btn-buy">Comprar ahora</button>
                    </div>

                    <ul class="notes">
                        <li>Pagas en USDT: coordinamos el pago contigo por WhatsApp.</li>
                        <li>Recibes el comprobante del pedido en PDF en tu correo.</li>
                    </ul>
                </div>
            </div>`;
        bindActions();
    }

    /* ---------- Acciones ---------- */
    function bindActions() {
        const qtyInput = document.getElementById('qty');
        const total = document.getElementById('buy-total');
        const getQty = () => Cart.clampQty(qtyInput.value);
        const setQty = (n) => {
            qtyInput.value = Cart.clampQty(n);
            total.textContent = usdt(product.precio_usdt * getQty());
        };

        document.getElementById('qty-minus').addEventListener('click', () => setQty(getQty() - 1));
        document.getElementById('qty-plus').addEventListener('click', () => setQty(getQty() + 1));
        qtyInput.addEventListener('change', () => setQty(qtyInput.value));

        document.getElementById('btn-add').addEventListener('click', () => {
            Cart.add(product, getQty());
            toast('Agregado al carrito.', { href: 'carrito.html', linkText: 'Ver carrito' });
        });

        // Pedido directo: se guarda solo esta prenda y se va al checkout sin mezclarla con el carrito
        document.getElementById('btn-buy').addEventListener('click', () => {
            store.set(KEYS.direct, Cart.toItem(product, getQty()), sessionStorage);
            location.href = 'carrito.html?directo=1';
        });
    }

    /* ---------- Relacionados ---------- */
    async function loadRelated() {
        try {
            const { datos } = await api('/productos');
            const others = datos.filter((p) => p.id_producto !== product.id_producto);
            const same = others.filter((p) => p.id_categoria === product.id_categoria);
            const list = (same.length ? same : others).slice(0, 4);
            if (!list.length) return;

            document.getElementById('related-grid').innerHTML = list.map((p) => `
                <article class="card">
                    <a class="card-link" href="producto.html?id=${p.id_producto}">
                        <div class="card-media"><img src="${esc(imgOf(p))}" alt="${esc(p.nombre)}" loading="lazy"></div>
                        <h3 class="card-title">${esc(p.nombre)}</h3>
                        <p class="card-meta">${esc(p.nombre_categoria || 'General')}</p>
                        <p class="card-price">${usdt(p.precio_usdt)}</p>
                    </a>
                </article>`).join('');
            document.getElementById('related-section').hidden = false;
        } catch { /* los relacionados son opcionales */ }
    }

    /* ---------- Inicio ---------- */
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
})();
