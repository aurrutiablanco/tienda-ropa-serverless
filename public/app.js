// ==========================================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================================================
const API_BASE_URL = '/api';

let state = {
    productos: [],
    categorias: [],
    carrito: JSON.parse(localStorage.getItem('cart_usdt')) || [],
    usuario: JSON.parse(localStorage.getItem('user_usdt')) || null,
    categoriaSeleccionada: '',
    busquedaActual: '',
    productoDetalleActual: null
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    actualizarEstadoUsuario();
    actualizarContadorCarrito();
    await cargarCategorias();
    await cargarProductos();
}

// ==========================================================================
// CARGA DE DATOS DESDE LA API
// ==========================================================================
async function cargarCategorias() {
    try {
        const res = await fetch(`${API_BASE_URL}/categorias`);
        const json = await res.json();
        if (json.exito) {
            state.categorias = json.datos;
            renderCategorias();
        }
    } catch (error) {
        console.error('Error al cargar categorías:', error);
    }
}

async function cargarProductos() {
    const loader = document.getElementById('loader');
    const grid = document.getElementById('grid-productos');
    
    loader.classList.remove('hidden');
    grid.innerHTML = '';

    try {
        let url = `${API_BASE_URL}/productos?categoria=${encodeURIComponent(state.categoriaSeleccionada)}&busqueda=${encodeURIComponent(state.busquedaActual)}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.exito) {
            state.productos = json.datos;
            renderProductos();
        } else {
            grid.innerHTML = `<p class="muted-text text-center" style="grid-column: 1/-1;">${json.mensaje}</p>`;
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
        grid.innerHTML = '<p class="muted-text text-center" style="grid-column: 1/-1;">Error de conexión al cargar los productos.</p>';
    } finally {
        loader.classList.add('hidden');
    }
}

// ==========================================================================
// RENDERIZADO DE COMPONENTES
// ==========================================================================
function renderCategorias() {
    const contenedor = document.getElementById('contenedor-categorias');
    let html = `<button class="cat-chip ${state.categoriaSeleccionada === '' ? 'active' : ''}" data-cat="">Todas</button>`;

    state.categorias.forEach(cat => {
        const active = String(state.categoriaSeleccionada) === String(cat.id_categoria) ? 'active' : '';
        html += `<button class="cat-chip ${active}" data-cat="${cat.id_categoria}">${cat.nombre_categoria}</button>`;
    });

    contenedor.innerHTML = html;

    // Asignar eventos a los chips de categoría
    contenedor.querySelectorAll('.cat-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.categoriaSeleccionada = e.target.getAttribute('data-cat');
            renderCategorias();
            cargarProductos();
        });
    });
}

function renderProductos() {
    const grid = document.getElementById('grid-productos');
    const totalCount = document.getElementById('total-productos-count');

    totalCount.textContent = `${state.productos.length} producto(s)`;

    if (state.productos.length === 0) {
        grid.innerHTML = '<p class="muted-text text-center" style="grid-column: 1/-1; padding: 30px;">No se encontraron productos disponibles.</p>';
        return;
    }

    grid.innerHTML = state.productos.map(p => `
        <div class="product-card" onclick="abrirModalDetalle(${p.id_producto})">
            <div class="product-img-container">
                <img src="${p.imagen_url || 'https://via.placeholder.com/300x300?text=Ropa'}" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/300x300?text=Sin+Imagen'">
            </div>
            <div class="product-card-body">
                <div>
                    <span class="product-tag-cat">${p.nombre_categoria || 'General'}</span>
                    <h4 class="product-card-title">${p.nombre}</h4>
                    <div class="product-card-details">
                        <span>Color: <strong>${p.color}</strong></span> | 
                        <span>Talla: <strong>${p.talla}</strong></span>
                    </div>
                </div>
                <div class="product-card-bottom">
                    <span class="price-tag">$${parseFloat(p.precio_usdt).toFixed(2)} USDT</span>
                    <button class="btn-add-quick" onclick="event.stopPropagation(); agregarRapidoAlCarrito(${p.id_producto})">
                        + 🛒
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================================================
// MODAL: DETALLE DE PRODUCTO
// ==========================================================================
function abrirModalDetalle(id_producto) {
    const producto = state.productos.find(p => p.id_producto === id_producto);
    if (!producto) return;

    state.productoDetalleActual = producto;

    document.getElementById('det-img').src = producto.imagen_url || 'https://via.placeholder.com/300x300?text=Ropa';
    document.getElementById('det-categoria').textContent = producto.nombre_categoria || 'General';
    document.getElementById('det-nombre').textContent = producto.nombre;
    document.getElementById('det-descripcion').textContent = producto.descripcion || 'Sin descripción detallada.';
    document.getElementById('det-color').textContent = producto.color;
    document.getElementById('det-talla').textContent = producto.talla;
    document.getElementById('det-precio').textContent = `$${parseFloat(producto.precio_usdt).toFixed(2)} USDT`;
    document.getElementById('det-cantidad').value = 1;

    abrirModal('modal-producto');
}

// ==========================================================================
// LÓGICA DEL CARRITO
// ==========================================================================
function agregarRapidoAlCarrito(id_producto) {
    const producto = state.productos.find(p => p.id_producto === id_producto);
    if (producto) {
        agregarAlCarrito(producto, 1);
    }
}

function agregarAlCarrito(producto, cantidad) {
    const existeIndex = state.carrito.findIndex(item => item.id_producto === producto.id_producto);

    if (existeIndex > -1) {
        state.carrito[existeIndex].cantidad += cantidad;
    } else {
        state.carrito.push({
            id_producto: producto.id_producto,
            nombre: producto.nombre,
            precio_usdt: producto.precio_usdt,
            color: producto.color,
            talla: producto.talla,
            cantidad: cantidad
        });
    }

    guardarCarrito();
    actualizarContadorCarrito();
    
    // Feedback visual
    const btnCart = document.getElementById('btn-modal-cart');
    btnCart.style.transform = 'scale(1.15)';
    setTimeout(() => btnCart.style.transform = 'scale(1)', 200);
}

function eliminarDelCarrito(index) {
    state.carrito.splice(index, 1);
    guardarCarrito();
    actualizarContadorCarrito();
    renderCarritoModal();
}

function guardarCarrito() {
    localStorage.setItem('cart_usdt', JSON.stringify(state.carrito));
}

function actualizarContadorCarrito() {
    const totalItems = state.carrito.reduce((acc, item) => acc + item.cantidad, 0);
    document.getElementById('cart-counter').textContent = totalItems;
}

function renderCarritoModal() {
    const emptyMsg = document.getElementById('cart-empty-msg');
    const wrapper = document.getElementById('cart-content-wrapper');
    const list = document.getElementById('cart-items-list');
    const totalElement = document.getElementById('cart-total-usdt');

    if (state.carrito.length === 0) {
        emptyMsg.classList.remove('hidden');
        wrapper.classList.add('hidden');
        return;
    }

    emptyMsg.classList.add('hidden');
    wrapper.classList.remove('hidden');

    let total = 0;
    list.innerHTML = state.carrito.map((item, index) => {
        const subtotal = item.precio_usdt * item.cantidad;
        total += subtotal;
        return `
            <div class="cart-item">
                <div>
                    <div class="cart-item-title">${item.nombre}</div>
                    <div class="cart-item-sub">Color: ${item.color} | Talla: ${item.talla} | Cant: ${item.cantidad}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="cart-item-price">$${subtotal.toFixed(2)}</span>
                    <button class="btn-remove-item" onclick="eliminarDelCarrito(${index})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    totalElement.textContent = `$${total.toFixed(2)} USDT`;

    // Autocompletar datos del cliente si el usuario inició sesión
    if (state.usuario) {
        document.getElementById('cliente-nombre').value = state.usuario.nombre || '';
        document.getElementById('cliente-correo').value = state.usuario.correo || '';
    }
}

// ==========================================================================
// MANEJO DE EVENTOS Y BÚSQUEDA
// ==========================================================================
function setupEventListeners() {
    // Buscador
    document.getElementById('btn-buscar').addEventListener('click', () => {
        state.busquedaActual = document.getElementById('input-busqueda').value.trim();
        cargarProductos();
    });

    document.getElementById('input-busqueda').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            state.busquedaActual = e.target.value.trim();
            cargarProductos();
        }
    });

    // Modal Carrito
    document.getElementById('btn-modal-cart').addEventListener('click', () => {
        renderCarritoModal();
        abrirModal('modal-carrito');
    });
    document.getElementById('close-modal-carrito').addEventListener('click', () => cerrarModal('modal-carrito'));

    // Modal Detalle Producto
    document.getElementById('close-modal-producto').addEventListener('click', () => cerrarModal('modal-producto'));
    document.getElementById('btn-add-cart-detail').addEventListener('click', () => {
        if (state.productoDetalleActual) {
            const cant = parseInt(document.getElementById('det-cantidad').value) || 1;
            agregarAlCarrito(state.productoDetalleActual, cant);
            cerrarModal('modal-producto');
        }
    });

    // Modal Auth
    document.getElementById('btn-modal-auth').addEventListener('click', () => {
        if (state.usuario) {
            // Si el usuario es Administrador, redirige a admin.html
            if (state.usuario.rol === 'admin') {
                window.location.href = 'admin.html';
                return;
            }
            if (confirm(`Hola ${state.usuario.nombre}, ¿deseas cerrar tu sesión?`)) {
                cerrarSesion();
            }
        } else {
            abrirModal('modal-auth');
        }
    });
    document.getElementById('close-modal-auth').addEventListener('click', () => cerrarModal('modal-auth'));

    // Tabs Login / Registro
    const tabLogin = document.getElementById('tab-login');
    const tabRegistro = document.getElementById('tab-registro');
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');

    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegistro.classList.remove('active');
        formLogin.classList.remove('hidden');
        formRegistro.classList.add('hidden');
        document.getElementById('auth-mensaje').textContent = '';
    });

    tabRegistro.addEventListener('click', () => {
        tabRegistro.classList.add('active');
        tabLogin.classList.remove('active');
        formRegistro.classList.remove('hidden');
        formLogin.classList.add('hidden');
        document.getElementById('auth-mensaje').textContent = '';
    });

    // Formulario Login Submit
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const correo = document.getElementById('login-correo').value.trim();
        const clave = document.getElementById('login-clave').value.trim();
        const msg = document.getElementById('auth-mensaje');

        msg.style.color = 'var(--text-muted)';
        msg.textContent = 'Iniciando sesión...';

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, clave })
            });
            const json = await res.json();

            if (json.exito) {
                state.usuario = json.datos;
                localStorage.setItem('user_usdt', JSON.stringify(state.usuario));
                actualizarEstadoUsuario();
                cerrarModal('modal-auth');

                if (state.usuario.rol === 'admin') {
                    window.location.href = 'admin.html';
                }
            } else {
                msg.style.color = 'var(--danger-color)';
                msg.textContent = json.mensaje;
            }
        } catch (error) {
            msg.style.color = 'var(--danger-color)';
            msg.textContent = 'Error de conexión al iniciar sesión.';
        }
    });

    // Formulario Registro Submit
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('reg-nombre').value.trim();
        const correo = document.getElementById('reg-correo').value.trim();
        const clave = document.getElementById('reg-clave').value.trim();
        const msg = document.getElementById('auth-mensaje');

        msg.style.color = 'var(--text-muted)';
        msg.textContent = 'Creando cuenta...';

        try {
            const res = await fetch(`${API_BASE_URL}/auth/registro`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, correo, clave })
            });
            const json = await res.json();

            if (json.exito) {
                state.usuario = json.datos;
                localStorage.setItem('user_usdt', JSON.stringify(state.usuario));
                actualizarEstadoUsuario();
                cerrarModal('modal-auth');
            } else {
                msg.style.color = 'var(--danger-color)';
                msg.textContent = json.mensaje;
            }
        } catch (error) {
            msg.style.color = 'var(--danger-color)';
            msg.textContent = 'Error al registrar usuario.';
        }
    });

    // Formulario Checkout Submit
    document.getElementById('form-checkout').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnProc = document.getElementById('btn-procesar-pedido');
        
        const cliente_nombre = document.getElementById('cliente-nombre').value.trim();
        const cliente_correo = document.getElementById('cliente-correo').value.trim();
        const cliente_telefono = document.getElementById('cliente-telefono').value.trim();

        if (state.carrito.length === 0) return;

        btnProc.disabled = true;
        btnProc.textContent = 'Procesando Pedido... ⏳';

        try {
            const bodyData = {
                id_usuario: state.usuario ? state.usuario.id_usuario : null,
                cliente_nombre,
                cliente_correo,
                cliente_telefono,
                items: state.carrito
            };

            const res = await fetch(`${API_BASE_URL}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const json = await res.json();

            if (json.exito) {
                // Limpiar Carrito
                state.carrito = [];
                guardarCarrito();
                actualizarContadorCarrito();

                cerrarModal('modal-carrito');

                // Mostrar Modal Confirmación
                document.getElementById('conf-id-pedido').textContent = `#${json.datos.id_pedido}`;
                document.getElementById('conf-total').textContent = `$${json.datos.total_usdt.toFixed(2)} USDT`;
                document.getElementById('btn-whatsapp-confirm').href = json.datos.whatsapp_url;

                abrirModal('modal-confirmacion');
            } else {
                alert(`Error al procesar el pedido: ${json.mensaje}`);
            }
        } catch (error) {
            alert('Ocurrió un error al procesar la compra.');
            console.error(error);
        } finally {
            btnProc.disabled = false;
            btnProc.textContent = 'Procesar Pedido y Enviar a Correo 📩';
        }
    });

    // Modal Confirmación cerrar
    document.getElementById('btn-cerrar-confirmacion').addEventListener('click', () => cerrarModal('modal-confirmacion'));
}

// ==========================================================================
// FUNCIONES AUXILIARES DE UI Y USUARIO
// ==========================================================================
function actualizarEstadoUsuario() {
    const lbl = document.getElementById('lbl-usuario');
    if (state.usuario) {
        lbl.textContent = state.usuario.rol === 'admin' ? '⚙️ Admin' : state.usuario.nombre.split(' ')[0];
    } else {
        lbl.textContent = 'Ingresar';
    }
}

function cerrarSesion() {
    state.usuario = null;
    localStorage.removeItem('user_usdt');
    actualizarEstadoUsuario();
}

function abrirModal(idModal) {
    document.getElementById(idModal).classList.add('active');
}

function cerrarModal(idModal) {
    document.getElementById(idModal).classList.remove('active');
}