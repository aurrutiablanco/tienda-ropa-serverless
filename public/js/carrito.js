/* ==========================================================================
   ModaUSDT — Carrito y checkout (carrito.html)
   Modo normal:  usa el carrito guardado.
   Modo directo: carrito.html?directo=1 usa solo la prenda de "Comprar ahora".
   ========================================================================== */
(() => {
    'use strict';
    const { api, esc, usdt, money, sku, imgOf, store, KEYS, Auth, Cart, Modal, toast, icons } = App;
    const $ = (id) => document.getElementById(id);

    const isDirect = new URLSearchParams(location.search).get('directo') === '1';
    let items = [];

    /* ---------- Persistencia (carrito o pedido directo) ---------- */
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
    function rowHTML(it) {
        const subtotal = it.cantidad * it.precio_usdt;
        return `
        <tr data-id="${it.id_producto}">
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

    function render() {
        const empty = items.length === 0;
        $('cart-empty').hidden = !empty;
        $('cart-layout').hidden = empty;
        $('direct-banner').hidden = !isDirect || empty;

        const units = Cart.count(items);
        $('cart-sub').textContent = empty ? '' : `${units} artículo${units === 1 ? '' : 's'} en tu pedido.`;
        if (empty) return;

        $('inv-body').innerHTML = items.map(rowHTML).join('');
        const total = Cart.total(items);
        $('tot-items').textContent = units;
        $('tot-sub').textContent = money(total);
        $('tot-total').textContent = usdt(total);
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
        render();
    });

    $('inv-body').addEventListener('change', (e) => {
        if (e.target.dataset.act !== 'set') return;
        const id = Number(e.target.closest('tr').dataset.id);
        const line = items.find((i) => i.id_producto === id);
        if (line) line.cantidad = Cart.clampQty(e.target.value);
        persist();
        render();
    });

    /* ---------- Sincroniza precios y disponibilidad con el catálogo ---------- */
    async function syncWithCatalog() {
        if (!items.length) return;
        try {
            const { datos } = await api('/productos');
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
            render();
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
            render();
            Modal.open('modal-confirmacion');
        } catch (err) {
            setMsg(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Confirmar pedido';
        }
    });

    /* ---------- Inicio ---------- */
    $('conf-close-icon').innerHTML = icons.close();
    items = loadItems();
    render();
    prefillClient();
    syncWithCatalog();
})();
