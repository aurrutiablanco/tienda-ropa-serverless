// ==========================================================================
// ESTADO GLOBAL DEL PANEL DE ADMINISTRACIÓN
// ==========================================================================
const API_BASE_URL = '/api';

let state = {
    productos: [],
    categorias: [],
    usuario: JSON.parse(localStorage.getItem('user_usdt')) || null,
    filtroBusqueda: '',
    filtroCategoria: ''
};

// ==========================================================================
// INICIALIZACIÓN Y CONTROL DE ACCESO
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    verificarAccesoAdmin();
    initAdmin();
    setupEventListeners();
});

function verificarAccesoAdmin() {
    if (!state.usuario || state.usuario.rol !== 'admin') {
        alert('Acceso restringido. Inicia sesión con una cuenta de administrador.');
        window.location.href = 'index.html';
    }
}

async function initAdmin() {
    await cargarCategorias();
    await cargarProductosAdmin();
}

// ==========================================================================
// CARGA DE DATOS
// ==========================================================================
async function cargarCategorias() {
    try {
        const res = await fetch(`${API_BASE_URL}/categorias`);
        const json = await res.json();
        if (json.exito) {
            state.categorias = json.datos;
            poblarSelectCategorias();
        }
    } catch (error) {
        console.error('Error al cargar categorías:', error);
    }
}

function poblarSelectCategorias() {
    const selectFiltro = document.getElementById('admin-filtro-categoria');
    const selectModal = document.getElementById('prod-categoria');

    let htmlFiltro = '<option value="">Todas las Categorías</option>';
    let htmlModal = '<option value="">Selecciona una categoría</option>';

    state.categorias.forEach(cat => {
        htmlFiltro += `<option value="${cat.id_categoria}">${cat.nombre_categoria}</option>`;
        htmlModal += `<option value="${cat.id_categoria}">${cat.nombre_categoria}</option>`;
    });

    selectFiltro.innerHTML = htmlFiltro;
    selectModal.innerHTML = htmlModal;
}

async function cargarProductosAdmin() {
    const loader = document.getElementById('admin-loader');
    const tbody = document.getElementById('tabla-productos-body');

    loader.classList.remove('hidden');
    tbody.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE_URL}/productos/admin`);
        const json = await res.json();

        if (json.exito) {
            state.productos = json.datos;
            renderTablaProductos();
        } else {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${json.mensaje}</td></tr>`;
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error de conexión al cargar productos.</td></tr>`;
    } finally {
        loader.classList.add('hidden');
    }
}

// ==========================================================================
// RENDERIZADO DE LA TABLA
// ==========================================================================
function renderTablaProductos() {
    const tbody = document.getElementById('tabla-productos-body');

    let productosFiltrados = state.productos.filter(p => {
        const cumpleBusqueda = !state.filtroBusqueda ||
            p.nombre.toLowerCase().includes(state.filtroBusqueda.toLowerCase()) ||
            p.color.toLowerCase().includes(state.filtroBusqueda.toLowerCase()) ||
            p.talla.toLowerCase().includes(state.filtroBusqueda.toLowerCase());

        const cumpleCategoria = !state.filtroCategoria ||
            String(p.id_categoria) === String(state.filtroCategoria);

        return cumpleBusqueda && cumpleCategoria;
    });

    if (productosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay productos que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    tbody.innerHTML = productosFiltrados.map(p => `
        <tr>
            <td>
                <img src="${p.imagen_url || 'https://via.placeholder.com/45?text=Ropa'}" alt="${p.nombre}" class="img-thumb" onerror="this.src='https://via.placeholder.com/45?text=NA'">
            </td>
            <td>
                <strong>${p.nombre}</strong>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${p.descripcion ? p.descripcion.substring(0, 40) + '...' : ''}</div>
            </td>
            <td>${p.nombre_categoria || 'General'}</td>
            <td><strong>$${parseFloat(p.precio_usdt).toFixed(2)} USDT</strong></td>
            <td>${p.color} / ${p.talla}</td>
            <td>
                <span class="status-badge ${p.estado === 1 ? 'status-active' : 'status-inactive'}">
                    ${p.estado === 1 ? 'Disponible' : 'Agotado'}
                </span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn-warning btn-sm" onclick="prepararEdicion(${p.id_producto})">✏️ Editar</button>
                    ${p.estado === 1 ? `<button class="btn-danger btn-sm" onclick="desactivarProducto(${p.id_producto})">🚫 Desactivar</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// ==========================================================================
// FUNCIONALIDAD CRUD
// ==========================================================================
function prepararNuevoProducto() {
    document.getElementById('modal-title-prod').textContent = 'Crear Nuevo Producto';
    document.getElementById('prod-id').value = '';
    document.getElementById('form-producto').reset();
    document.getElementById('prod-estado').value = '1';
    document.getElementById('form-prod-mensaje').textContent = '';
    abrirModal('modal-form-producto');
}

function prepararEdicion(id_producto) {
    const p = state.productos.find(item => item.id_producto === id_producto);
    if (!p) return;

    document.getElementById('modal-title-prod').textContent = 'Editar Producto';
    document.getElementById('prod-id').value = p.id_producto;
    document.getElementById('prod-nombre').value = p.nombre;
    document.getElementById('prod-precio').value = p.precio_usdt;
    document.getElementById('prod-categoria').value = p.id_categoria || '';
    document.getElementById('prod-color').value = p.color;
    document.getElementById('prod-talla').value = p.talla;
    document.getElementById('prod-imagen').value = p.imagen_url || '';
    document.getElementById('prod-descripcion').value = p.descripcion || '';
    document.getElementById('prod-estado').value = p.estado;

    document.getElementById('form-prod-mensaje').textContent = '';
    abrirModal('modal-form-producto');
}

async function desactivarProducto(id_producto) {
    if (!confirm('¿Seguro que deseas desactivar este producto del catálogo público?')) return;

    try {
        const res = await fetch(`${API_BASE_URL}/productos/${id_producto}`, {
            method: 'DELETE'
        });
        const json = await res.json();

        if (json.exito) {
            await cargarProductosAdmin();
        } else {
            alert(`Error: ${json.mensaje}`);
        }
    } catch (error) {
        alert('Error de conexión al intentar desactivar el producto.');
    }
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
    // Cerrar Sesión Admin
    document.getElementById('btn-logout-admin').addEventListener('click', () => {
        localStorage.removeItem('user_usdt');
        window.location.href = 'index.html';
    });

    // Abrir Modal Crear Producto
    document.getElementById('btn-nuevo-producto').addEventListener('click', prepararNuevoProducto);

    // Cerrar Modal Formulario
    document.getElementById('close-modal-form').addEventListener('click', () => cerrarModal('modal-form-producto'));

    // Filtros
    document.getElementById('admin-busqueda').addEventListener('input', (e) => {
        state.filtroBusqueda = e.target.value.trim();
        renderTablaProductos();
    });

    document.getElementById('admin-filtro-categoria').addEventListener('change', (e) => {
        state.filtroCategoria = e.target.value;
        renderTablaProductos();
    });

    // Submit Crear / Editar Producto
    document.getElementById('form-producto').addEventListener('submit', async (e) => {
        e.preventDefault();

        const id_producto = document.getElementById('prod-id').value;
        const nombre = document.getElementById('prod-nombre').value.trim();
        const precio_usdt = parseFloat(document.getElementById('prod-precio').value) || 0;
        const id_categoria = document.getElementById('prod-categoria').value;
        const color = document.getElementById('prod-color').value.trim();
        const talla = document.getElementById('prod-talla').value.trim();
        const imagen_url = document.getElementById('prod-imagen').value.trim();
        const descripcion = document.getElementById('prod-descripcion').value.trim();
        const estado = parseInt(document.getElementById('prod-estado').value);

        const msg = document.getElementById('form-prod-mensaje');
        const btnGuardar = document.getElementById('btn-guardar-prod');

        msg.style.color = 'var(--text-muted)';
        msg.textContent = 'Guardando cambios...';
        btnGuardar.disabled = true;

        const payload = {
            nombre,
            precio_usdt,
            id_categoria: id_categoria ? parseInt(id_categoria) : null,
            color,
            talla,
            imagen_url,
            descripcion,
            estado
        };

        try {
            let url = `${API_BASE_URL}/productos`;
            let method = 'POST';

            if (id_producto) {
                url = `${API_BASE_URL}/productos/${id_producto}`;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.exito) {
                cerrarModal('modal-form-producto');
                await cargarProductosAdmin();
            } else {
                msg.style.color = 'var(--danger-color)';
                msg.textContent = json.mensaje;
            }
        } catch (error) {
            msg.style.color = 'var(--danger-color)';
            msg.textContent = 'Error de conexión al guardar el producto.';
        } finally {
            btnGuardar.disabled = false;
        }
    });
}

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================
function abrirModal(idModal) {
    document.getElementById(idModal).classList.add('active');
}

function cerrarModal(idModal) {
    document.getElementById(idModal).classList.remove('active');
}