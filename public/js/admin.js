/* ==========================================================================
   ModaUSDT — Panel de administración (admin.html)
   Aviso: el control de acceso de esta página es solo visual (lado cliente).
   La protección real debe hacerse en el backend.
   ========================================================================== */
(() => {
    'use strict';
    const { api, esc, norm, usdt, imgOf, Auth, Modal, icons } = App;
    const $ = (id) => document.getElementById(id);

    /* ---------- Control de acceso ---------- */
    if (!Auth.isAdmin()) {
        location.replace('acceso.html?redirect=admin.html');
        return;
    }

    const state = { productos: [], categorias: [], q: '', cat: '' };

    /* ---------- Carga ---------- */
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
            render();
        } catch (err) {
            $('tabla-body').innerHTML = `<tr><td colspan="7" class="table-empty">${esc(err.message)}</td></tr>`;
            $('admin-count').textContent = '';
        }
    }

    /* ---------- Tabla ---------- */
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

        $('tabla-body').innerHTML = list.map((p) => {
            const active = Number(p.estado) === 1;
            const desc = p.descripcion ? esc(p.descripcion.length > 48 ? p.descripcion.slice(0, 48) + '…' : p.descripcion) : '';
            return `
            <tr>
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

    /* ---------- Formulario ---------- */
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
            await loadProductos();
        } catch (err) {
            setMsg(err.message, 'error');
        } finally {
            btn.disabled = false;
        }
    });

    /* ---------- Eventos ---------- */
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

    /* ---------- Inicio ---------- */
    $('admin-search-icon').innerHTML = icons.search();
    $('admin-close-icon').innerHTML = icons.close();
    loadCategorias().then(loadProductos);
})();
